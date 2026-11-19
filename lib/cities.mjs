// NetCyties — city builder leve: cada IP da rede é dono de uma cidade.
// O servidor é a autoridade: guarda os mapas, aplica as obras (só do dono) e roda a simulação.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DATA } from "./paths.mjs";

export const N = 48;                       // terreno total (N×N); o dono libera aos poucos
const START_SIZE = 24, MAX_SIZE = 48;
const FILE = path.join(DATA, "cities.json");
// Tipos de tile:  . grama  ~ água  T árvore  = rua  A entrada da avenida  R/C/I zonas  P parque  E usina
export const TOOLS = {
  road: { tile: "=", cost: 10, label: "Rua" }, res: { tile: "R", cost: 50, label: "Residencial" }, com: { tile: "C", cost: 60, label: "Comercial" },
  ind: { tile: "I", cost: 60, label: "Industrial" }, park: { tile: "P", cost: 100, label: "Parque" }, power: { tile: "E", cost: 3000, label: "Usina" },
  bulldoze: { tile: ".", cost: 2, label: "Demolir" },
};

const db = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { cities: {} }; } })();
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(db), () => {}), 2000); };

// ---------- utilidades ----------
const hashStr = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 | 0) >>> 0) / 4294967296; }
const idx = (x, y) => y * N + x;
const inside = (c, x, y) => { const o = (N - c.size) / 2; return x >= o && y >= o && x < o + c.size && y < o + c.size; };

/** IP do servidor na rede (para dar uma cidade ao próprio PC da Toolbox). */
export function serverIp() {
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|WSL|docker|Loopback/i.test(name)) continue;
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return "127.0.0.1";
}
export const cityIdFor = (ip, local) => (local ? serverIp() : ip);

// ---------- criação (terreno gerado a partir do IP) ----------
function newCity(id) {
  const r = rng(hashStr(id)), t = Array(N * N).fill(".");
  // lago
  const lx = 6 + r() * (N - 12), ly = 6 + r() * (N - 12), lr = 3 + r() * 4;
  // rio de uma borda à outra
  const vertical = r() < 0.5, riverPos = 4 + r() * (N - 8), wob = r() * 6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - lx, y - ly);
    const rv = vertical ? Math.abs(x - (riverPos + Math.sin(y / 5) * wob)) : Math.abs(y - (riverPos + Math.sin(x / 5) * wob));
    if (d < lr + r() * 1.2 || rv < 1.1) t[idx(x, y)] = "~";
  }
  // bosques
  for (let k = 0; k < 7; k++) {
    const fx = r() * N, fy = r() * N, fr = 2 + r() * 4;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (t[idx(x, y)] === "." && Math.hypot(x - fx, y - fy) < fr && r() < 0.75) t[idx(x, y)] = "T";
  }
  const c = { id, name: `Cidade ${id}`, size: START_SIZE, money: 20000, tax: 7, month: 0, tiles: t.join(""), levels: "0".repeat(N * N), created: Date.now(), stats: {} };
  placeEntrance(c);
  return c;
}

/** Posição da cidade no mapa-múndi, a partir do IP (o roteador fica no centro). */
function worldPos(id) {
  const parts = id.split(".").map(Number), last = parts[3] || hashStr(id) % 255;
  const local = id.split(".").slice(0, 3).join(".") === serverIp().split(".").slice(0, 3).join(".");
  const ang = (last / 256) * Math.PI * 2;
  return { x: Math.cos(ang) * (local ? 1 : 1.7), y: Math.sin(ang) * (local ? 1 : 1.7), subnet: local ? "local" : id.split(".").slice(0, 3).join(".") };
}
/** Entrada da avenida: na borda da área liberada voltada para o roteador. */
function placeEntrance(c) {
  const t = c.tiles.split("");
  for (let i = 0; i < t.length; i++) if (t[i] === "A") t[i] = "=";
  const p = worldPos(c.id), o = (N - c.size) / 2, mid = Math.floor(N / 2);
  const dx = -p.x, dy = -p.y; // direção do roteador
  let x, y;
  if (Math.abs(dx) > Math.abs(dy)) { x = dx > 0 ? o + c.size - 1 : o; y = mid; } else { y = dy > 0 ? o + c.size - 1 : o; x = mid; }
  t[idx(x, y)] = "A";
  c.entrance = [x, y]; c.tiles = t.join("");
}

export function getCity(id, create = false) {
  if (!db.cities[id] && create) { db.cities[id] = newCity(id); save(); }
  return db.cities[id] || null;
}

// ---------- obras ----------
export function edit(id, tool, cells) {
  const c = getCity(id, true), T = TOOLS[tool];
  if (!T) throw new Error("Ferramenta inválida.");
  const t = c.tiles.split(""), lv = c.levels.split("");
  let spent = 0, done = 0;
  for (const [x, y] of (cells || []).slice(0, 400)) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inside(c, x, y)) continue;
    const i = idx(x, y), cur = t[i];
    if (cur === "A") continue;                                   // a entrada da avenida é fixa
    if (tool === "bulldoze") { if (cur === "." || cur === "~") continue; }
    else {
      if (cur === T.tile) continue;
      if (cur === "~" && tool !== "road") continue;                 // na água, só ponte (rua)
      if (cur !== "." && cur !== "T" && cur !== "~") continue;      // ocupado: demolir antes
    }
    const cost = T.cost + (cur === "T" ? 5 : 0) + (cur === "~" ? 40 : 0);
    if (c.money - spent < cost) break;
    spent += cost; done++;
    t[i] = tool === "bulldoze" ? "." : T.tile; lv[i] = "0";
  }
  c.money -= spent; c.tiles = t.join(""); c.levels = lv.join("");
  save();
  return { city: c, done, spent };
}

export function expand(id) {
  const c = getCity(id, true);
  if (c.size >= MAX_SIZE) throw new Error("A cidade já está no tamanho máximo.");
  const cost = 2000 + (c.size - START_SIZE) * 800;
  if (c.money < cost) throw new Error(`Expandir custa $${cost}.`);
  c.money -= cost; c.size = Math.min(MAX_SIZE, c.size + 4); placeEntrance(c); save();
  return c;
}
export function settings(id, { name, tax }) {
  const c = getCity(id, true);
  if (name != null) c.name = String(name).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 28) || c.name;
  if (tax != null) c.tax = Math.max(0, Math.min(20, Math.round(+tax) || 0));
  save(); return c;
}

// ---------- simulação (1 mês a cada 3 s) ----------
function roadsFromEntrance(c, t) {
  const seen = new Uint8Array(N * N), q = [c.entrance];
  if (!c.entrance) return seen;
  seen[idx(...c.entrance)] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const i = idx(nx, ny); if (!seen[i] && (t[i] === "=" || t[i] === "A")) { seen[i] = 1; q.push([nx, ny]); }
    }
  }
  return seen;
}
function tick(c) {
  const t = c.tiles, lv = c.levels.split("").map(Number), r = Math.random;
  const near = (x, y, rad, fn) => { for (let j = Math.max(0, y - rad); j <= Math.min(N - 1, y + rad); j++) for (let i = Math.max(0, x - rad); i <= Math.min(N - 1, x + rad); i++) if (fn(t[idx(i, j)], lv[idx(i, j)], i, j)) return true; return false; };
  const plants = [], counts = { R: 0, C: 0, I: 0, "=": 0, P: 0, E: 0 };
  let pop = 0, jobsC = 0, jobsI = 0;
  for (let i = 0; i < N * N; i++) {
    const k = t[i]; if (k in counts) counts[k]++;
    if (k === "E") plants.push([i % N, Math.floor(i / N)]);
    if (k === "R") pop += lv[i] * 25; else if (k === "C") jobsC += lv[i] * 18; else if (k === "I") jobsI += lv[i] * 22;
  }
  const powered = (x, y) => plants.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) <= 14);
  const connected = roadsFromEntrance(c, t), trade = [...connected].filter(Boolean).length > 1;
  // demanda R/C/I (−1 a 1): gente quer emprego, comércio quer clientes, indústria quer trabalhadores
  const clamp = v => Math.max(-1, Math.min(1, v));
  const dR = clamp(((jobsC + jobsI) * 1.15 + 120 - pop) / (pop + 200) - (c.tax - 7) * 0.04);
  const dC = clamp((pop * 0.45 - jobsC + (trade ? 60 : 0)) / (jobsC + 150) - (c.tax - 7) * 0.03);
  const dI = clamp((pop * 0.55 - jobsI + (trade ? 40 : 0)) / (jobsI + 150) - (c.tax - 7) * 0.03);
  const dem = { R: dR, C: dC, I: dI };
  let unpowered = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y), k = t[i];
    if (k !== "R" && k !== "C" && k !== "I") continue;
    const road = near(x, y, 2, z => z === "=" || z === "A"), pw = powered(x, y);
    if (!pw && lv[i] > 0) unpowered++;
    if (!road || !pw) { if (lv[i] > 0 && r() < 0.06) lv[i]--; continue; }
    let p = 0.12 + 0.25 * dem[k];
    if (k === "R") { if (near(x, y, 4, (z, l) => (z === "I" && l > 1) || z === "E")) p -= 0.15; if (near(x, y, 3, z => z === "P")) p += 0.08; }
    if (k === "C" && near(x, y, 3, z => z === "P")) p += 0.04;
    if (r() < p && lv[i] < 3) lv[i]++; else if (dem[k] < -0.35 && lv[i] > 0 && r() < 0.05) lv[i]--;
  }
  // finanças do mês
  const income = Math.round(pop * c.tax * 0.06 + (jobsC + jobsI) * c.tax * 0.03 + (trade ? jobsC * 0.15 : 0));
  const expense = Math.round(counts["="] * 0.25 + counts.P * 2 + counts.E * 35);
  c.money += income - expense; c.month++;
  c.levels = lv.join("");
  c.stats = { pop, jobs: jobsC + jobsI, income, expense, demand: dem, connected: trade, unpowered, plants: plants.length, ...counts };
}
setInterval(() => { for (const c of Object.values(db.cities)) tick(c); save(); }, 3000);

// ---------- mapa-múndi ----------
export function world() {
  const hub = { id: "roteador", name: "Roteador da rede", x: 0, y: 0 };
  const cities = Object.values(db.cities).map(c => ({ id: c.id, name: c.name, pop: c.stats?.pop || 0, connected: !!c.stats?.connected, month: c.month, ...worldPos(c.id) }));
  // avenidas: cidades da mesma sub-rede ligam direto no roteador; outras sub-redes passam por um nó próprio
  const nodes = {}, roads = [];
  for (const c of cities) {
    if (c.subnet === "local") roads.push([c.id, "roteador"]);
    else {
      const n = `rede ${c.subnet}.0`;
      if (!nodes[n]) { const a = Math.atan2(c.y, c.x); nodes[n] = { id: n, name: `Sub-rede ${c.subnet}.x`, x: Math.cos(a) * 1.25, y: Math.sin(a) * 1.25 }; roads.push([n, "roteador"]); }
      roads.push([c.id, n]);
    }
  }
  return { hub, nodes: Object.values(nodes), cities, roads };
}
