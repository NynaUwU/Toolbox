// BlockVerse — servidor autoritativo do mundo de blocos (WebSocket /ws/blockverse).
// Mundo: chunks gerados pela semente (tools/blockverse/shared.mjs) + alterações salvas em data/blockverse.
// Simula: criaturas, plantações, mudas, fornalhas, circuitos de energia, fome e vida. O mundo é de todos; cada IP é um jogador.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA } from "./paths.mjs";
import { isLocal, clientIp } from "./access.mjs";
import { serverIp } from "./cities.mjs";
import {
  CS, H, DAY_MS, REACH, idx, ckey, BLOCKS, ITEM, AIR, WATER, LAVA, MAX_STACK, RECIPES, FUEL,
  generateChunk, drops, placeable, daylight, matchGrid, WORLD_SPAWN, maxStack, FACING_BLOCKS,
} from "../tools/blockverse/shared.mjs";

const DIR = path.join(DATA, "blockverse"), CDIR = path.join(DIR, "chunks");
fs.mkdirSync(CDIR, { recursive: true });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch { return d; } };
const state = readJson("world.json", { time: DAY_MS * 0.3, players: {}, furnaces: {} });
state.chests ||= {};

// ---------------- Chunks ----------------
const chunks = new Map();
const energy = new Set(), crops = new Set(), saplings = new Set();
const K = (x, y, z) => `${x},${y},${z}`;
const unK = k => k.split(",").map(Number);
const pendingSets = [];

function getChunk(cx, cz) {
  const key = ckey(cx, cz);
  let c = chunks.get(key);
  if (c) return c;
  const file = path.join(CDIR, `${cx}_${cz}.bin`);
  if (fs.existsSync(file)) {
    const buf = zlib.gunzipSync(fs.readFileSync(file)), n = CS * CS * H;
    c = { blocks: new Uint8Array(buf.subarray(0, n)), meta: new Uint8Array(buf.subarray(n, 2 * n)) };
  } else c = generateChunk(cx, cz);
  c.cx = cx; c.cz = cz; c.dirty = false;
  chunks.set(key, c);
  for (let i = 0; i < c.blocks.length; i++) {
    const b = BLOCKS[c.blocks[i]]; if (!b || !(b.energy || b.crop || b.sapling)) continue;
    const x = i % CS, z = Math.floor(i / CS) % CS, y = Math.floor(i / (CS * CS)), k = K(cx * CS + x, y, cz * CS + z);
    (b.energy ? energy : b.crop ? crops : saplings).add(k);
  }
  return c;
}
const locate = (x, y, z) => { const cx = Math.floor(x / CS), cz = Math.floor(z / CS); return [getChunk(cx, cz), idx(x - cx * CS, y, z - cz * CS)]; };
function getB(x, y, z) { if (y < 0 || y >= H) return AIR; const [c, i] = locate(x, y, z); return c.blocks[i]; }
function getM(x, y, z) { if (y < 0 || y >= H) return 0; const [c, i] = locate(x, y, z); return c.meta[i]; }
function setB(x, y, z, id, meta = 0) {
  if (y < 0 || y >= H) return;
  const [c, i] = locate(x, y, z);
  if (c.blocks[i] === id && c.meta[i] === meta) return;
  c.blocks[i] = id; c.meta[i] = meta; c.dirty = true;
  const k = K(x, y, z), b = BLOCKS[id];
  for (const s of [energy, crops, saplings]) s.delete(k);
  if (b.energy) energy.add(k); else if (b.crop) crops.add(k); else if (b.sapling) saplings.add(k);
  pendingSets.push([x, y, z, id, meta]);
}
const solidAt = (x, y, z) => { const id = getB(x, y, z); if (id === 27) return !(getM(x, y, z) & 1); return BLOCKS[id].solid; };
function topY(x, z) { for (let y = H - 1; y > 0; y--) { const id = getB(x, y, z); if (id !== AIR && BLOCKS[id].solid) return y; if (id === WATER || id === LAVA) return -y; } return 0; }
const skyOpen = (x, y, z) => { for (let yy = y + 1; yy < H; yy++) if (BLOCKS[getB(x, yy, z)].opaque) return false; return true; };

function saveAll() {
  for (const c of chunks.values()) if (c.dirty) {
    const buf = Buffer.concat([Buffer.from(c.blocks), Buffer.from(c.meta)]);
    fs.writeFileSync(path.join(CDIR, `${c.cx}_${c.cz}.bin`), zlib.gzipSync(buf)); c.dirty = false;
  }
  fs.writeFileSync(path.join(DIR, "world.json"), JSON.stringify(state));
}
setInterval(saveAll, 20000).unref();
process.on("exit", () => { try { saveAll(); } catch {} });

// descarrega chunks longe de todos os jogadores (mantém a memória baixa)
setInterval(() => {
  const near = [...online.values()].map(s => s.p);
  for (const [key, c] of chunks) {
    if (near.some(p => Math.abs(c.cx * CS + 8 - p.x) < 200 && Math.abs(c.cz * CS + 8 - p.z) < 200)) continue;
    if (c.dirty) { fs.writeFileSync(path.join(CDIR, `${c.cx}_${c.cz}.bin`), zlib.gzipSync(Buffer.concat([Buffer.from(c.blocks), Buffer.from(c.meta)]))); }
    for (let i = 0; i < c.blocks.length; i++) {
      const b = BLOCKS[c.blocks[i]]; if (!b.energy && !b.crop && !b.sapling) continue;
      const k = K(c.cx * CS + i % CS, Math.floor(i / (CS * CS)), c.cz * CS + Math.floor(i / CS) % CS);
      energy.delete(k); crops.delete(k); saplings.delete(k);
    }
    chunks.delete(key);
  }
}, 60000).unref();

// ---------------- Jogadores ----------------
const online = new Map(); // key(ip) -> { ws, p }
let nextMobId = 1;
const mobs = new Map();

function newPlayer(key, name) {
  const p = { name, hp: 20, food: 20, exhaust: 0, creative: false, inv: Array(36).fill(null), x: 0, y: 0, z: 0, yaw: 0, pitch: 0, dead: false };
  spawnAt(p);
  p.inv[0] = [120, 1]; // picareta de madeira para começar
  p.inv[1] = [109, 4];
  return p;
}
function spawnAt(p) {
  if (p.spawn && getB(p.spawn.x, p.spawn.y, p.spawn.z) === 46) { // cama
    const { x, y, z } = p.spawn;
    p.x = x + 0.5; p.y = y + 0.6; p.z = z + 0.5; return;
  }
  const sx = WORLD_SPAWN.x, sz = WORLD_SPAWN.z;
  let y = topY(sx, sz);
  if (y <= 0) { // nascimento no mar: cria uma plataforma
    y = Math.abs(y) || 22;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) setB(sx + dx, y, sz + dz, 8);
  }
  p.x = sx + 0.5; p.y = y + 1.01; p.z = sz + 0.5;
}
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const toAll = o => { const s = JSON.stringify(o); for (const { ws } of online.values()) if (ws.readyState === 1) ws.send(s); };
const msg = (ws, text) => send(ws, { type: "msg", text });
const sendInv = s => send(s.ws, { type: "inv", inv: s.p.inv });
const sendStat = s => send(s.ws, { type: "stat", hp: s.p.hp, food: s.p.food, air: s.p.air ?? 15, creative: s.p.creative, dead: s.p.dead, why: s.p.why || "" });
function addItem(p, id, n) {
  const max = maxStack(id);
  for (const s of p.inv) if (s && s[0] === id && s[1] < max && n > 0) { const t = Math.min(n, max - s[1]); s[1] += t; n -= t; }
  for (let i = 0; i < p.inv.length && n > 0; i++) if (!p.inv[i]) { const t = Math.min(n, max); p.inv[i] = [id, t]; n -= t; }
  return n; // o que não coube
}
const countItem = (p, id) => p.inv.reduce((a, s) => a + (s && s[0] === id ? s[1] : 0), 0);
function takeItem(p, id, n) {
  for (let i = p.inv.length - 1; i >= 0 && n > 0; i--) { const s = p.inv[i]; if (s && s[0] === id) { const t = Math.min(n, s[1]); s[1] -= t; n -= t; if (!s[1]) p.inv[i] = null; } }
}
function useSlot(p, slot) { const s = p.inv[slot]; if (!s || p.creative) return; if (--s[1] <= 0) p.inv[slot] = null; }
const near = (p, x, y, z, r = REACH + 1.5) => Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 1.6), z + 0.5 - p.z) <= r;

function hurt(s, dmg, why) {
  const p = s.p; if (p.creative || p.dead || dmg <= 0) return;
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hp <= 0) { p.dead = true; p.why = why; p.air = 15; toAll({ type: "chat", from: "★", text: `${p.name} ${why}` }); }
  sendStat(s); send(s.ws, { type: "hurt" });
}

// ---------------- Quebrar / colocar / usar ----------------
const SUPPORT = id => ["cross", "slab", "small", "door", "cactus"].includes(BLOCKS[id].shape); // precisa de bloco embaixo
function breakAt(s, x, y, z, giveDrops = true) {
  const p = s.p, id = getB(x, y, z), m = getM(x, y, z);
  if (id === 27) { const oy = m & 2 ? y - 1 : y + 1; if (getB(x, oy, z) === 27) setB(x, oy, z, AIR); }
  if (id === 15) { const f = state.furnaces[K(x, y, z)]; if (f) { for (const k of ["in", "fuel", "out"]) if (f[k]) addItem(p, ...f[k]); delete state.furnaces[K(x, y, z)]; } }
  if (id === 45) { const c = state.chests[K(x, y, z)]; if (c) { for (const st of c) if (st) addItem(p, ...st); delete state.chests[K(x, y, z)]; } }
  setB(x, y, z, AIR);
  if (giveDrops && !p.creative) for (const [d, n] of drops(id, m, p.inv[p.sel]?.[0])) addItem(p, d, n);
  // o que estava apoiado em cima cai junto
  const up = getB(x, y + 1, z);
  if (up !== AIR && up !== WATER && SUPPORT(up) && !(up === 27 && getM(x, y + 1, z) & 2)) breakAt(s, x, y + 1, z, giveDrops);
  if (id === 17) return; // terra arada: já tratou a planta acima
}

function place(s, m) {
  const p = s.p, { x, y, z } = m, slot = m.slot | 0, st = p.inv[slot];
  if (!st || !near(p, x, y, z) || y <= 0 || y >= H - 1) return;
  const here = getB(x, y, z);
  if (!(here === AIR || here === WATER || BLOCKS[here].replaceable)) return;
  let id = st[0], meta = 0;
  const below = getB(x, y - 1, z);
  if (id === 117) { // balde com água
    if (here === WATER) return;
    setB(x, y, z, WATER);
    if (!p.creative) p.inv[slot] = [116, 1];
    return sendInv(s);
  }
  if (ITEM[id]?.plants) { if (below !== 17) return msg(s.ws, "Plante em terra arada (use uma enxada)."); id = ITEM[id].plants; }
  else if (!placeable(id)) return;
  if (id === 36 && below !== 4 && below !== 36) return msg(s.ws, "Cactos só crescem na areia.");
  if (id === 47) { // escada: presa na parede do bloco clicado
    const n = Array.isArray(m.n) ? m.n : [0, 1, 0];
    const dir = n[0] === 1 ? 0 : n[0] === -1 ? 1 : n[2] === 1 ? 2 : n[2] === -1 ? 3 : -1;
    if (dir < 0 || !BLOCKS[getB(x - n[0], y, z - n[2])].solid) return msg(s.ws, "A escada precisa de uma parede atrás.");
    meta = dir << 2;
  }
  if (id === 20 && below !== 1 && below !== 2) return msg(s.ws, "Mudas vão em grama ou terra.");
  if (SUPPORT(id) && !BLOCKS[below].solid) return;
  if (BLOCKS[id].solid) { // não colocar dentro de alguém
    for (const o of online.values()) if (o !== s && !o.p.dead && Math.abs(o.p.x - (x + 0.5)) < 0.8 && Math.abs(o.p.z - (z + 0.5)) < 0.8 && o.p.y < y + 1 && o.p.y + 1.8 > y) return;
    for (const mb of mobs.values()) if (Math.abs(mb.x - (x + 0.5)) < 0.5 + mb.w / 2 && Math.abs(mb.z - (z + 0.5)) < 0.5 + mb.w / 2 && mb.y < y + 1 && mb.y + mb.h > y) return;
  }
  const facing = ((Math.round(-(m.yaw || 0) / (Math.PI / 2)) % 4) + 4) % 4;
  if (id === 27) { if (getB(x, y + 1, z) !== AIR) return; meta = facing << 2; setB(x, y + 1, z, 27, meta | 2); }
  if (FACING_BLOCKS.has(id) && id !== 27 && id !== 47) meta = facing << 2;
  setB(x, y, z, id, meta);
  if (id === 15) state.furnaces[K(x, y, z)] = { in: null, fuel: null, out: null, burn: 0, prog: 0 };
  if (id === 45) state.chests[K(x, y, z)] = Array(27).fill(null);
  useSlot(p, slot); sendInv(s);
}

function use(s, m) {
  const p = s.p, { x, y, z } = m; if (!near(p, x, y, z)) return;
  const id = getB(x, y, z), meta = getM(x, y, z), slot = m.slot | 0, held = p.inv[slot]?.[0];
  if (held === 116 && id === WATER) { // encher o balde
    setB(x, y, z, AIR);
    if (!p.creative) { const st = p.inv[slot]; if (st[1] > 1) { st[1]--; if (addItem(p, 117, 1)) msg(s.ws, "Inventário cheio."); } else p.inv[slot] = [117, 1]; }
    return sendInv(s);
  }
  if (id === 45) {
    closeUI(s);
    const k = K(x, y, z); state.chests[k] ||= Array(27).fill(null);
    s.chest = k; send(s.ws, { type: "open", ui: "chest" }); return sendUI(s);
  }
  if (id === 46) return sleep(s, x, y, z);
  if (id === 14) { closeUI(s); s.gridSize = 3; send(s.ws, { type: "open", ui: "workbench" }); return sendUI(s); }
  if (id === 15) {
    closeUI(s);
    const k = K(x, y, z); state.furnaces[k] ||= { in: null, fuel: null, out: null, burn: 0, prog: 0 };
    s.furnace = k; send(s.ws, { type: "open", ui: "furnace" }); return sendUI(s);
  }
  if (id === 23) return setB(x, y, z, 23, meta ^ 1);
  if (id === 24) return setB(x, y, z, 24, (meta & 0xC) | 1), buttonTimers.set(K(x, y, z), 15);
  if (id === 27) { const oy = meta & 2 ? y - 1 : y + 1; setB(x, y, z, 27, meta ^ 1); if (getB(x, oy, z) === 27) setB(x, oy, z, 27, getM(x, oy, z) ^ 1); return; }
  if (ITEM[held]?.tool === "enxada" && (id === 1 || id === 2) && getB(x, y + 1, z) === AIR) { setB(x, y, z, 17); return; }
  if (ITEM[held]?.food) return eat(s, m.slot | 0);
}
function eat(s, slot) {
  const p = s.p, st = p.inv[slot], it = ITEM[st?.[0]], f = it?.food; if (!f) return;
  if (p.food >= 20 && !(it.heal && p.hp < 20)) return msg(s.ws, "Você está sem fome.");
  p.food = Math.min(20, p.food + f); p.exhaust = 0;
  if (it.heal) p.hp = Math.min(20, p.hp + it.heal);
  if (--st[1] <= 0) p.inv[slot] = null;
  sendInv(s); sendStat(s);
}

// ---------------- Cama ----------------
function sleep(s, x, y, z) {
  s.p.spawn = { x, y, z };
  if (!isNight()) return msg(s.ws, "Ponto de renascer salvo nesta cama. Só dá para dormir à noite.");
  s.sleepAt = Date.now();
  const all = [...online.values()].filter(o => !o.p.dead);
  const asleep = all.filter(o => o.sleepAt && Date.now() - o.sleepAt < 12000);
  if (asleep.length >= all.length) {
    state.time = (Math.floor(state.time / DAY_MS) + 1) * DAY_MS + 1000;
    for (const o of all) o.sleepAt = 0;
    toAll({ type: "chat", from: "★", text: "Todos dormiram — bom dia!" });
  } else msg(s.ws, `Ponto de renascer salvo. Esperando os outros dormirem (${asleep.length}/${all.length})…`);
}

// ---------------- Fornalha ----------------
const smeltOf = id => RECIPES.find(r => r.where === "furnace" && r.need[0][0] === id);
const SMELT_S = 5, FUEL_S = 5;
function furnaceTick(dt) {
  for (const [k, f] of Object.entries(state.furnaces)) {
    const [x, y, z] = unK(k);
    if (!chunks.has(ckey(Math.floor(x / CS), Math.floor(z / CS)))) continue;
    const r = f.in && smeltOf(f.in[0]);
    const room = r && (!f.out || (f.out[0] === r.out[0] && f.out[1] + r.out[1] <= MAX_STACK));
    let changed = false;
    if (room && f.burn <= 0 && f.fuel) { f.burn = (FUEL[f.fuel[0]] || 0) * FUEL_S; if (--f.fuel[1] <= 0) f.fuel = null; changed = true; }
    if (room && f.burn > 0) {
      f.prog += dt;
      if (f.prog >= SMELT_S) { f.prog = 0; f.out = f.out ? [f.out[0], f.out[1] + r.out[1]] : [...r.out]; if (--f.in[1] <= 0) f.in = null; changed = true; }
    } else if (f.prog) { f.prog = 0; changed = true; }
    if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
    const lit = f.burn > 0 ? 1 : 0, m = getM(x, y, z);
    if (getB(x, y, z) === 15 && (m & 1) !== lit) setB(x, y, z, 15, (m & ~1) | lit);
    if (changed || f.burn > 0) for (const o of online.values()) if (o.furnace === k) send(o.ws, { type: "furnace", f });
  }
}
// ---------------- Inventário com cursor + grade de crafting (2×2 no inventário, 3×3 na bancada) ----------------
const maxOf = maxStack;
function slotRef(s, id) {
  const p = s.p;
  if (Number.isInteger(id)) return id >= 0 && id < 36 ? { get: () => p.inv[id], set: v => { p.inv[id] = v; }, kind: "inv", i: id } : null;
  if (/^g[0-8]$/.test(id)) { const i = +id[1]; return i < s.gridSize ** 2 ? { get: () => s.grid[i], set: v => { s.grid[i] = v; }, kind: "grid" } : null; }
  if (/^k\d+$/.test(id)) { const c = state.chests[s.chest], i = +id.slice(1); return c && i < 27 ? { get: () => c[i], set: v => { c[i] = v; }, kind: "chest" } : null; }
  const fk = { fin: "in", ffuel: "fuel", fout: "out" }[id], f = state.furnaces[s.furnace];
  if (fk && f) return { get: () => f[fk], set: v => { f[fk] = v; }, kind: id, accept: id === "fin" ? x => !!smeltOf(x) : id === "ffuel" ? x => !!FUEL[x] : () => false };
  return null;
}
/** Junta a pilha nos espaços indicados (primeiro onde já tem o mesmo item). Devolve o que sobrou. */
function stackInto(p, st, slots) {
  let n = st[1]; const max = maxOf(st[0]);
  for (const i of slots) { const t = p.inv[i]; if (t && t[0] === st[0] && t[1] < max && n) { const k = Math.min(n, max - t[1]); t[1] += k; n -= k; } }
  for (const i of slots) if (!p.inv[i] && n) { const k = Math.min(n, max); p.inv[i] = [st[0], k]; n -= k; }
  return n;
}
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const gridIds = s => Array.from({ length: s.gridSize ** 2 }, (_, i) => s.grid[i]?.[0] || 0);
const gridResult = s => matchGrid(gridIds(s), s.gridSize);
function consumeGrid(s) { for (let i = 0; i < 9; i++) { const g = s.grid[i]; if (g && --g[1] <= 0) s.grid[i] = null; } }
function takeResult(s, shift) {
  const p = s.p;
  for (let made = 0; made < 64; made++) {
    const r = gridResult(s); if (!r) return;
    const [id, n] = r.out;
    if (shift) {
      const left = stackInto(p, [id, n], [...range(9, 36), ...range(0, 9)]);
      if (left) { msg(s.ws, "Inventário cheio."); return; }
    } else {
      if (s.cursor && (s.cursor[0] !== id || s.cursor[1] + n > maxOf(id))) return;
      s.cursor = s.cursor ? [id, s.cursor[1] + n] : [id, n];
    }
    consumeGrid(s);
    if (!shift) return;
  }
}
function quickMove(s, ref) {
  const st = ref.get(); if (!st) return;
  const p = s.p;
  if (ref.kind === "inv") {
    const c = state.chests[s.chest];
    if (c) { // inventário -> baú
      let n = st[1]; const max = maxOf(st[0]);
      for (const t of c) if (t && t[0] === st[0] && t[1] < max && n) { const k = Math.min(n, max - t[1]); t[1] += k; n -= k; }
      for (let i = 0; i < 27 && n; i++) if (!c[i]) { const k = Math.min(n, max); c[i] = [st[0], k]; n -= k; }
      ref.set(n ? [st[0], n] : null); return;
    }
    const f = state.furnaces[s.furnace];
    if (f) {
      const to = smeltOf(st[0]) ? "in" : FUEL[st[0]] ? "fuel" : null;
      if (to && (!f[to] || f[to][0] === st[0])) { const k = Math.min(st[1], MAX_STACK - (f[to]?.[1] || 0)); f[to] = [st[0], (f[to]?.[1] || 0) + k]; st[1] -= k; if (!st[1]) ref.set(null); }
      return;
    }
    const left = stackInto(p, [...st], ref.i < 9 ? range(9, 36) : range(0, 9));
    ref.set(left ? [st[0], left] : null);
  } else {
    const left = stackInto(p, [...st], [...range(9, 36), ...range(0, 9)]);
    ref.set(left ? [st[0], left] : null);
  }
}
function clickSlot(s, m) {
  if (m.slot === "trash") { s.cursor = null; return; }
  if (m.slot === "out") return takeResult(s, m.shift);
  const ref = slotRef(s, m.slot); if (!ref) return;
  if (m.shift) return quickMove(s, ref);
  const st = ref.get(), c = s.cursor, right = m.button === 2;
  if (!c) { // pegar (direito: metade)
    if (!st) return;
    if (right) { const h = Math.ceil(st[1] / 2); s.cursor = [st[0], h]; st[1] -= h; if (!st[1]) ref.set(null); }
    else { s.cursor = st; ref.set(null); }
    return;
  }
  if (ref.kind === "fout") { // saída da fornalha: só pega
    if (st && st[0] === c[0]) { const k = Math.min(st[1], maxOf(c[0]) - c[1]); c[1] += k; st[1] -= k; if (!st[1]) ref.set(null); }
    return;
  }
  if (ref.accept && !ref.accept(c[0])) return msg(s.ws, m.slot === "ffuel" ? "Isso não serve de combustível." : "Isso não pode ser fundido.");
  if (!st) { if (right) { ref.set([c[0], 1]); c[1]--; } else { ref.set(c); s.cursor = null; } }
  else if (st[0] === c[0]) { const k = Math.min(maxOf(st[0]) - st[1], right ? 1 : c[1]); st[1] += k; c[1] -= k; }
  else { ref.set(c); s.cursor = st; }
  if (s.cursor && s.cursor[1] <= 0) s.cursor = null;
}
/** Livro de receitas: põe os ingredientes na grade (se o jogador tiver). */
function fillRecipe(s, ri) {
  const r = RECIPES[ri], p = s.p; if (!r?.shape) return;
  if (r.w > s.gridSize || r.h > s.gridSize) return msg(s.ws, "Essa receita precisa da bancada (3×3).");
  clearGrid(s);
  if (!r.need.every(([id, n]) => countItem(p, id) >= n)) { sendInv(s); return msg(s.ws, "Faltam ingredientes."); }
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const ch = r.shape[y][x] ?? " "; if (ch === " ") continue;
    takeItem(p, r.key[ch], 1); s.grid[y * s.gridSize + x] = [r.key[ch], 1];
  }
}
function clearGrid(s) {
  for (let i = 0; i < 9; i++) if (s.grid[i]) { const left = addItem(s.p, ...s.grid[i]); if (left) msg(s.ws, "Inventário cheio: itens perdidos."); s.grid[i] = null; }
}
function closeUI(s) {
  clearGrid(s);
  if (s.cursor) { addItem(s.p, ...s.cursor); s.cursor = null; }
  s.gridSize = 2; s.furnace = null; s.chest = null;
}
function sendUI(s) {
  const r = gridResult(s);
  send(s.ws, { type: "ui", cursor: s.cursor, grid: s.grid, size: s.gridSize, result: r ? r.out : null, f: state.furnaces[s.furnace] || null, chest: state.chests[s.chest] || null });
  sendInv(s);
}

// ---------------- Energia ----------------
// Fonte, alavanca ligada, botão pressionado e inversor sem energia embaixo emitem 15.
// O cabo leva o sinal perdendo 1 por bloco; lâmpadas acendem e portas abrem quando tocam algo energizado.
const buttonTimers = new Map();
const doorPowered = new Map();
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function emits(x, y, z) {
  const id = getB(x, y, z), m = getM(x, y, z);
  return id === 22 || (id === 23 && m & 1) || (id === 24 && m & 1) || (id === 26 && m & 1);
}
const poweredCell = (x, y, z) => emits(x, y, z) || (getB(x, y, z) === 21 && getM(x, y, z) > 0);
function energyTick() {
  for (const [k, t] of buttonTimers) { if (t <= 1) { buttonTimers.delete(k); const [x, y, z] = unK(k); if (getB(x, y, z) === 24) setB(x, y, z, 24, getM(x, y, z) & ~1); } else buttonTimers.set(k, t - 1); }
  const list = [...energy].map(unK);
  // inversores (usam o estado do tick anterior do que está embaixo)
  for (const [x, y, z] of list) if (getB(x, y, z) === 26) {
    const on = poweredCell(x, y - 1, z) ? 0 : 1, m = getM(x, y, z);
    if ((m & 1) !== on) setB(x, y, z, 26, (m & ~1) | on);
  }
  const power = new Map(), q = [];
  for (const [x, y, z] of list) if (emits(x, y, z)) for (const [dx, dy, dz] of N6) {
    if (getB(x, y, z) === 26 && dy === -1) continue;
    q.push([x + dx, y + dy, z + dz, 15]);
  }
  while (q.length) {
    const [x, y, z, lv] = q.pop(); if (lv <= 0 || getB(x, y, z) !== 21) continue;
    const k = K(x, y, z); if ((power.get(k) || 0) >= lv) continue;
    power.set(k, lv);
    for (const [dx, dy, dz] of N6) q.push([x + dx, y + dy, z + dz, lv - 1]);
  }
  for (const [x, y, z] of list) {
    const id = getB(x, y, z), k = K(x, y, z);
    if (id === 21) { const lv = power.get(k) || 0; if (getM(x, y, z) !== lv) setB(x, y, z, 21, lv); continue; }
    if (id !== 25 && id !== 27) continue;
    const on = N6.some(([dx, dy, dz]) => { const kk = K(x + dx, y + dy, z + dz); return (power.get(kk) || 0) > 0 || emits(x + dx, y + dy, z + dz) || (id === 27 && getB(x + dx, y + dy, z + dz) === 27 && doorPowered.get(kk)); });
    if (id === 25) { if ((getM(x, y, z) & 1) !== +on) setB(x, y, z, 25, +on); continue; }
    const was = !!doorPowered.get(k);
    if (on !== was) { doorPowered.set(k, on); const m = getM(x, y, z); setB(x, y, z, 27, on ? m | 1 : m & ~1); }
  }
}

// ---------------- Plantas ----------------
const nearWater = (x, y, z) => { for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (getB(x + dx, y, z + dz) === WATER) return true; return false; };
function growTree(x, y, z) {
  for (let i = 1; i <= 5; i++) if (getB(x, y + i, z) !== AIR) return false;
  const t = 4 + (Math.random() < 0.5);
  for (let i = 0; i < t; i++) setB(x, y + i, z, 6);
  for (let yy = y + t - 2; yy <= y + t; yy++) { const r = yy === y + t ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (getB(x + dx, yy, z + dz) === AIR && (Math.abs(dx) + Math.abs(dz) < r * 2 || r === 1)) setB(x + dx, yy, z + dz, 7); }
  return true;
}
function plantTick() {
  for (const k of crops) {
    const [x, y, z] = unK(k), id = getB(x, y, z), m = getM(x, y, z);
    if (getB(x, y - 1, z) !== 17) { setB(x, y, z, AIR); continue; }
    if (m >= 7) continue;
    if (Math.random() < (nearWater(x, y - 1, z) ? 1 / 6 : 1 / 14)) setB(x, y, z, id, m + 1);
  }
  for (const k of saplings) { if (Math.random() < 1 / 50) { const [x, y, z] = unK(k); setB(x, y, z, AIR); if (!growTree(x, y, z)) setB(x, y, z, 20); } }
}

// ---------------- Criaturas ----------------
const MOB = {
  capybara: { hp: 10, speed: 1.4, w: 0.9, h: 0.9, drops: [[108, 1, 2]] },
  chicken: { hp: 4, speed: 1.7, w: 0.5, h: 0.7, drops: [[108, 1, 1]] },
  sheep: { hp: 8, speed: 1.3, w: 0.9, h: 1.2, drops: [[48, 1, 2], [108, 1, 1]] },
  shade: { hp: 20, speed: 3.2, w: 0.6, h: 1.9, hostile: true, dmg: 3, burns: true, drops: [[101, 0, 2], [103, 0, 1]], kill: "foi pego por uma Shade." },
  crawler: { hp: 12, speed: 3.6, w: 1.1, h: 0.6, hostile: true, dmg: 2, drops: [[118, 0, 2]], kill: "foi mordido por um Crawler." },
};
MOB.chicken.drops = [[108, 1, 1], [110, 0, 2]];
const LIGHTS = new Set([16, 22, 44, 51]);
/** Há luz (tocha, lâmpada acesa, lava…) a até 6 blocos? Criaturas hostis não nascem perto da luz. */
function litNear(x, y, z) {
  for (let dy = -4; dy <= 4; dy++) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
    const id = getB(x + dx, y + dy, z + dz);
    if (LIGHTS.has(id) || ((id === 25 || id === 15) && getM(x + dx, y + dy, z + dz) & 1)) return true;
  }
  return false;
}
const isNight = () => daylight(state.time) < 0.25;

function collides(e, x, y, z) {
  const hw = e.w / 2;
  for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw - 1e-6); bx++)
    for (let by = Math.floor(y); by <= Math.floor(y + e.h - 1e-6); by++)
      for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw - 1e-6); bz++) if (solidAt(bx, by, bz)) return true;
  return false;
}
function moveEnt(e, dt) {
  e.vy -= 25 * dt; if (e.vy < -30) e.vy = -30;
  const inWater = getB(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z)) === WATER;
  if (inWater) e.vy = Math.max(e.vy, 1.5);
  let blocked = false;
  const nx = e.x + e.vx * dt; if (!collides(e, nx, e.y, e.z)) e.x = nx; else blocked = true;
  const nz = e.z + e.vz * dt; if (!collides(e, e.x, e.y, nz)) e.z = nz; else blocked = true;
  const dy = e.vy * dt;
  e.onGround = false;
  if (!collides(e, e.x, e.y + dy, e.z)) e.y += dy;
  else {
    const st = Math.sign(dy) * 0.05; let yy = e.y;
    while (Math.abs(yy - e.y) < Math.abs(dy) && !collides(e, e.x, yy + st, e.z)) yy += st;
    e.y = yy; if (e.vy < 0) e.onGround = true; e.vy = 0;
  }
  if (blocked && (e.onGround || inWater)) e.vy = 7.2;
  if (e.y < -20) e.hp = 0;
}
function spawnMob(type, x, z, yy) {
  let ty = yy ?? topY(x, z); if (ty <= 0) return;
  const g = getB(x, ty, z), d = MOB[type];
  if (!d.hostile && g !== 1 && g !== 32) return;
  if (d.hostile && (g === LAVA || g === WATER || litNear(x, ty + 1, z))) return;
  const id = nextMobId++;
  mobs.set(id, { id, type, x: x + 0.5, y: ty + 1, z: z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, hp: d.hp, w: d.w, h: d.h, t: 0, flee: 0, cd: 0, hurtT: 0 });
}
function mobTick(dt) {
  const players = [...online.values()].filter(s => !s.p.dead);
  for (const m of mobs.values()) {
    const d = MOB[m.type];
    m.t -= dt; m.cd -= dt; m.flee -= dt; m.hurtT -= dt;
    let target = null;
    if (d.hostile) { let best = 16; for (const s of players) { if (s.p.creative) continue; const dist = Math.hypot(s.p.x - m.x, s.p.z - m.z); if (dist < best) { best = dist; target = s; } } }
    let speed = 0;
    if (target) {
      m.yaw = Math.atan2(target.p.x - m.x, target.p.z - m.z); speed = d.speed;
      if (Math.hypot(target.p.x - m.x, target.p.z - m.z) < 0.8 + m.w / 2 && Math.abs(target.p.y - m.y) < 1.6) { speed = 0; if (m.cd <= 0) { m.cd = 1; hurt(target, d.dmg, d.kill); send(target.ws, { type: "knock", x: Math.sin(m.yaw) * 6, z: Math.cos(m.yaw) * 6 }); } }
    } else {
      if (m.t <= 0) { m.t = 2 + Math.random() * 5; m.walk = Math.random() < 0.55; m.yaw += (Math.random() - 0.5) * 3; }
      speed = m.flee > 0 ? d.speed * 2 : m.walk ? d.speed * 0.5 : 0;
    }
    m.vx = Math.sin(m.yaw) * speed; m.vz = Math.cos(m.yaw) * speed;
    if (m.type === "chicken" && m.vy < -2) m.vy = -2; // galinha plana
    moveEnt(m, dt);
    if (d.burns && !isNight() && skyOpen(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z)) && Math.random() < dt) { m.hp -= 4; m.hurtT = 0.3; m.burn = true; }
    const far = !players.length || players.every(s => Math.hypot(s.p.x - m.x, s.p.z - m.z) > 80);
    if (getB(Math.floor(m.x), Math.floor(m.y + 0.2), Math.floor(m.z)) === LAVA) m.hp -= 2;
    if (m.hp <= 0 || far) mobs.delete(m.id);
  }
  // nascimento
  if (Math.random() < dt / 2) for (const s of players) {
    const around = [...mobs.values()].filter(m => Math.hypot(m.x - s.p.x, m.z - s.p.z) < 48);
    const ang = Math.random() * 6.28, r = 18 + Math.random() * 20, x = Math.floor(s.p.x + Math.cos(ang) * r), z = Math.floor(s.p.z + Math.sin(ang) * r);
    const hostiles = around.filter(m => MOB[m.type].hostile).length;
    const top = topY(x, z), under = s.p.y < Math.abs(top) - 6; // jogador numa caverna
    if (under && hostiles < 5) { // cavernas: procura um espaço livre perto da altura do jogador
      for (let y = Math.floor(s.p.y) - 8; y < s.p.y + 8; y++) if (solidAt(x, y, z) && getB(x, y + 1, z) === AIR && getB(x, y + 2, z) === AIR && !skyOpen(x, y + 1, z)) { spawnMob(Math.random() < 0.5 ? "crawler" : "shade", x, z, y); break; }
    } else if (isNight() && hostiles < 5) spawnMob(Math.random() < 0.7 ? "shade" : "crawler", x, z);
    else if (around.filter(m => !MOB[m.type].hostile).length < 7) spawnMob(["capybara", "chicken", "sheep"][Math.floor(Math.random() * 3)], x, z);
  }
}
function attack(s, m) {
  const mob = mobs.get(m.mob | 0), p = s.p; if (!mob || p.dead) return;
  if (Math.hypot(mob.x - p.x, mob.y - p.y, mob.z - p.z) > 5) return;
  const it = ITEM[p.inv[m.slot | 0]?.[0]];
  damageMob(s, mob, it?.item ? it.dmg || 1 : 1, Math.atan2(mob.x - p.x, mob.z - p.z));
}
function damageMob(s, mob, dmg, a) {
  const p = s.p;
  mob.hp -= dmg; mob.hurtT = 0.3;
  mob.vy = 5; mob.x += Math.sin(a) * 0.6; mob.z += Math.cos(a) * 0.6;
  if (collides(mob, mob.x, mob.y, mob.z)) { mob.x -= Math.sin(a) * 0.6; mob.z -= Math.cos(a) * 0.6; }
  if (!MOB[mob.type].hostile) { mob.flee = 4; mob.yaw = a; }
  if (mob.hp <= 0) {
    mobs.delete(mob.id);
    if (!p.creative) { for (const [id, a0, a1] of MOB[mob.type].drops) { const n = a0 + Math.floor(Math.random() * (a1 - a0 + 1)); if (n) addItem(p, id, n); } sendInv(s); }
  }
}

// ---------------- Flechas ----------------
const arrows = new Map();
let nextArrow = 1;
function shoot(s, m) {
  const p = s.p, now = Date.now();
  if (ITEM[p.inv[m.slot | 0]?.[0]]?.bow !== true || (s.shotAt && now - s.shotAt < 450)) return;
  const d = Array.isArray(m.dir) ? m.dir.map(Number) : null; if (!d || d.some(v => !Number.isFinite(v))) return;
  const len = Math.hypot(...d) || 1, power = Math.max(0.3, Math.min(1, +m.power || 1));
  if (!p.creative) { if (!countItem(p, 145)) return msg(s.ws, "Sem flechas."); takeItem(p, 145, 1); sendInv(s); }
  s.shotAt = now;
  const v = 34 * power;
  arrows.set(nextArrow, { id: nextArrow++, s, x: p.x + d[0] / len * 0.6, y: p.y + 1.55 + d[1] / len * 0.6, z: p.z + d[2] / len * 0.6, vx: d[0] / len * v, vy: d[1] / len * v, vz: d[2] / len * v, life: 6, dmg: Math.round(3 + 5 * power) });
}
function arrowTick(dt) {
  for (const a of arrows.values()) {
    a.life -= dt; if (a.life <= 0) { arrows.delete(a.id); continue; }
    for (let k = 0; k < 4; k++) {
      const h = dt / 4;
      a.vy -= 16 * h; a.x += a.vx * h; a.y += a.vy * h; a.z += a.vz * h;
      if (solidAt(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) { a.vx = a.vy = a.vz = 0; a.life = Math.min(a.life, 1.5); a.stuck = true; break; }
      let hit = null;
      for (const mb of mobs.values()) if (Math.abs(mb.x - a.x) < mb.w / 2 + 0.15 && Math.abs(mb.z - a.z) < mb.w / 2 + 0.15 && a.y > mb.y && a.y < mb.y + mb.h) { hit = mb; break; }
      if (hit) { if (online.has(a.s.key)) damageMob(a.s, hit, a.dmg, Math.atan2(a.vx, a.vz)); arrows.delete(a.id); break; }
    }
  }
}

// ---------------- Ambiente: lava, cacto, afogamento ----------------
function envTick(s) {
  const p = s.p; if (p.dead || p.creative) { if (p.air !== 15) { p.air = 15; sendStat(s); } return; }
  const fx = Math.floor(p.x), fz = Math.floor(p.z), fy = Math.floor(p.y + 0.1), hy = Math.floor(p.y + 1.6);
  if (getB(fx, fy, fz) === LAVA || getB(fx, hy - 1, fz) === LAVA) hurt(s, 4, "tentou nadar na lava.");
  let cactus = false;
  for (let bx = Math.floor(p.x - 0.42); bx <= Math.floor(p.x + 0.42); bx++) for (let bz = Math.floor(p.z - 0.42); bz <= Math.floor(p.z + 0.42); bz++)
    for (let by = Math.floor(p.y - 0.05); by <= Math.floor(p.y + 1.7); by++) if (getB(bx, by, bz) === 36) cactus = true;
  if (cactus) hurt(s, 1, "abraçou um cacto.");
  const air0 = p.air ?? 15;
  if (getB(fx, hy, fz) === WATER) { p.air = Math.max(0, air0 - 1); if (p.air === 0) hurt(s, 2, "se afogou."); }
  else p.air = Math.min(15, air0 + 3);
  if (p.air !== air0) sendStat(s);
}

// ---------------- Laço principal ----------------
let acc1 = 0;
setInterval(() => {
  const dt = 0.1;
  state.time += dt * 1000;
  if (!online.size) return;
  mobTick(dt); energyTick(); furnaceTick(dt); arrowTick(dt);
  acc1 += dt;
  if (acc1 >= 1) {
    acc1 = 0; plantTick();
    for (const s of online.values()) {
      envTick(s);
      const p = s.p; if (p.dead || p.creative) continue;
      p.exhaust += (s.sprint ? 1 / 15 : 1 / 45);
      let ch = false;
      if (p.exhaust >= 1) { p.exhaust = 0; if (p.food > 0) { p.food--; ch = true; } }
      p.tick = (p.tick || 0) + 1;
      if (p.tick % 4 === 0) {
        if (p.food >= 18 && p.hp < 20) { p.hp++; ch = true; }
        else if (p.food === 0 && p.hp > 1) { hurt(s, 1, "morreu de fome."); }
      }
      if (ch) sendStat(s);
    }
  }
  // estados para os clientes
  const pl = [...online.entries()].filter(([, s]) => !s.p.dead).map(([k, s]) => [k, s.p.name, +s.p.x.toFixed(2), +s.p.y.toFixed(2), +s.p.z.toFixed(2), +s.p.yaw.toFixed(2), +s.p.pitch.toFixed(2)]);
  const mb = [...mobs.values()].map(m => [m.id, m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), m.hurtT > 0 ? 1 : 0]);
  const ar = [...arrows.values()].map(a => [a.id, +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.vx.toFixed(1), +a.vy.toFixed(1), +a.vz.toFixed(1)]);
  const sets = pendingSets.splice(0);
  const base = { type: "tick", time: Math.round(state.time) };
  for (const s of online.values()) {
    const o = { ...base, players: pl.filter(r => r[0] !== s.key && Math.hypot(r[2] - s.p.x, r[4] - s.p.z) < 160), mobs: mb.filter(r => Math.hypot(r[2] - s.p.x, r[4] - s.p.z) < 96) };
    if (sets.length) o.sets = sets;
    if (ar.length) o.arrows = ar;
    send(s.ws, o);
  }
}, 100).unref();

// ---------------- Conexão ----------------
const clean = (t, n) => String(t ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);
export function attachBlockverse(ws, req) {
  const key = isLocal(req) ? serverIp() : clientIp(req);
  let s = null;
  ws.on("message", (raw, bin) => {
    if (bin) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === "hello") {
      const old = online.get(key); if (old && old.ws !== ws) { send(old.ws, { type: "kicked" }); old.ws.close(); }
      const p = state.players[key] ||= newPlayer(key, clean(m.name, 20) || `Jogador ${key.split(".").pop()}`);
      if (m.name) p.name = clean(m.name, 20) || p.name;
      p.sel = 0; delete p.home;
      s = { ws, key, p, grid: Array(9).fill(null), gridSize: 2, cursor: null, furnace: null };
      online.set(key, s);
      send(ws, { type: "welcome", id: key, p: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch }, name: p.name, time: state.time, dayMs: DAY_MS });
      sendInv(s); sendStat(s);
      toAll({ type: "chat", from: "★", text: `${p.name} entrou no mundo.` });
      return;
    }
    if (!s) return;
    const p = s.p;
    switch (m.type) {
      case "chunks":
        for (const [cx, cz] of (m.list || []).slice(0, 24)) {
          if (Math.abs(cx * CS - p.x) > 220 || Math.abs(cz * CS - p.z) > 220) continue;
          const c = getChunk(cx | 0, cz | 0), head = Buffer.alloc(12);
          head.writeUInt8(1, 0); head.writeInt32LE(cx | 0, 4); head.writeInt32LE(cz | 0, 8);
          if (ws.readyState === 1) ws.send(Buffer.concat([head, Buffer.from(c.blocks), Buffer.from(c.meta)]));
        }
        break;
      case "pos":
        if (p.dead) break;
        for (const k of ["x", "y", "z", "yaw", "pitch"]) if (Number.isFinite(m[k])) p[k] = m[k];
        s.sprint = !!m.sprint;
        if (p.y < -16) hurt(s, 100, "caiu do mundo.");
        break;
      case "sel": p.sel = Math.max(0, Math.min(8, m.slot | 0)); break;
      case "fall": hurt(s, Math.min(40, m.dmg | 0), "caiu de muito alto."); break;
      case "break": {
        const { x, y, z } = m; p.sel = m.slot | 0;
        if (p.dead || !near(p, x, y, z)) break;
        const id = getB(x, y, z); if (id === AIR || BLOCKS[id].liquid || BLOCKS[id].hard < 0) break;
        breakAt(s, x, y, z); sendInv(s); break;
      }
      case "place": if (!p.dead) place(s, m); break;
      case "use": if (!p.dead) use(s, m); break;
      case "eat": eat(s, m.slot | 0); break;
      case "click": {
        clickSlot(s, m); sendUI(s);
        if (s.chest) for (const o of online.values()) if (o !== s && o.chest === s.chest) sendUI(o); // outros olhando o mesmo baú
        break;
      }
      case "shoot": if (!p.dead) shoot(s, m); break;
      case "fill": fillRecipe(s, m.r | 0); sendUI(s); break;
      case "openinv": closeUI(s); sendUI(s); break;
      case "close": closeUI(s); sendInv(s); break;
      case "attack": attack(s, m); break;
      case "give": if (p.creative && ITEM[m.id | 0]) { s.cursor = [m.id | 0, maxOf(m.id | 0)]; sendUI(s); } break;
      case "mode": p.creative = !!m.creative; if (p.creative) { p.hp = 20; p.food = 20; } sendStat(s); break;
      case "respawn": if (p.dead) { p.dead = false; p.hp = 20; p.food = 20; p.air = 15; spawnAt(p); send(ws, { type: "tp", x: p.x, y: p.y, z: p.z }); sendStat(s); } break;
      case "home": spawnAt(p); send(ws, { type: "tp", x: p.x, y: p.y, z: p.z }); break;
      case "name": p.name = clean(m.name, 20) || p.name; break;
      case "chat": { const t = clean(m.text, 200); if (t) toAll({ type: "chat", from: p.name, text: t }); break; }
    }
  });
  ws.on("close", () => {
    if (s && online.get(key) === s) { closeUI(s); online.delete(key); toAll({ type: "chat", from: "★", text: `${s.p.name} saiu.` }); }
  });
}
