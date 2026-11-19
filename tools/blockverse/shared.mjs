// BlockVerse — definições compartilhadas por servidor e navegador:
// blocos, itens, receitas, fundição e o gerador de terreno (determinístico pela semente).

export const CS = 16, H = 64, SEA = 22, SEED = 1337;
export const DAY_MS = 10 * 60 * 1000;                // um dia completo = 10 minutos
export const REACH = 6.5;
/** Luz do dia 0–1 (0 = noite). t=0 amanhecer, 0,25 meio-dia, 0,5 pôr do sol, 0,75 meia-noite. */
export const daylight = time => { const t = (time % DAY_MS) / DAY_MS; return Math.max(0, Math.min(1, Math.sin(t * Math.PI * 2) * 2.2 + 0.4)); };
export const idx = (x, y, z) => (y * CS + z) * CS + x;
export const ckey = (cx, cz) => `${cx},${cz}`;

// ---------- Blocos ----------
// shape: cube | cross (plantas) | slab (cabo) | small (alavanca/botão/tocha) | door
// solid: colide · opaque: esconde faces vizinhas · hard: segundos para quebrar com a mão · tool: ferramenta ideal
const B = (id, name, o) => ({ id, name, shape: "cube", solid: true, opaque: true, hard: 1, tool: null, ...o });
export const BLOCKS = [
  B(0, "Air", { solid: false, opaque: false, hard: 0 }),
  B(1, "Grass", { hard: 0.6, tool: "pa", drop: 2 }),
  B(2, "Dirt", { hard: 0.6, tool: "pa" }),
  B(3, "Stone", { hard: 3, tool: "picareta", needTool: 1, drop: 9 }),
  B(4, "Sand", { hard: 0.6, tool: "pa" }),
  B(5, "Water", { solid: false, opaque: false, hard: -1, liquid: true }),
  B(6, "Log", { hard: 1.6, tool: "machado" }),
  B(7, "Leaves", { opaque: false, hard: 0.3, cutout: true, drop: "folhas" }),
  B(8, "Planks", { hard: 1.4, tool: "machado" }),
  B(9, "Cobblestone", { hard: 3, tool: "picareta", needTool: 1 }),
  B(10, "Glass", { opaque: false, hard: 0.4, cutout: true, drop: 0 }),
  B(11, "Coal Ore", { hard: 3.5, tool: "picareta", needTool: 1, drop: 101 }),
  B(12, "Iron Ore", { hard: 4, tool: "picareta", needTool: 2 }),
  B(13, "Voltite Ore", { hard: 4, tool: "picareta", needTool: 2, drop: 103, dropN: [2, 4], glow: true }),
  B(14, "Workbench", { hard: 1.6, tool: "machado", use: "workbench" }),
  B(15, "Furnace", { hard: 3, tool: "picareta", needTool: 1, use: "furnace" }),
  B(16, "Torch", { shape: "small", solid: false, opaque: false, hard: 0.05, glow: true }),
  B(17, "Farmland", { hard: 0.6, tool: "pa", drop: 2 }),
  B(18, "Wheat Crop", { shape: "cross", solid: false, opaque: false, hard: 0.05, crop: 105, stages: 8, drop: "trigo" }),
  B(19, "Carrot Crop", { shape: "cross", solid: false, opaque: false, hard: 0.05, crop: 106, stages: 8, drop: "cenoura" }),
  B(20, "Sapling", { shape: "cross", solid: false, opaque: false, hard: 0.05, sapling: true }),
  B(21, "Power Cable", { shape: "slab", solid: false, opaque: false, hard: 0.05, energy: "cable" }),
  B(22, "Power Core", { hard: 2, tool: "picareta", energy: "core", glow: true }),
  B(23, "Lever", { shape: "small", solid: false, opaque: false, hard: 0.3, energy: "lever", use: "lever" }),
  B(24, "Button", { shape: "small", solid: false, opaque: false, hard: 0.3, energy: "button", use: "button" }),
  B(25, "Lamp", { hard: 0.6, opaque: true, energy: "lamp" }),
  B(26, "Inverter", { hard: 1, tool: "picareta", energy: "inverter" }),
  B(27, "Door", { shape: "door", hard: 1.5, tool: "machado", energy: "door", use: "door", opaque: false }),
  B(28, "Bedrock", { hard: -1 }),
  B(29, "Tall Grass", { shape: "cross", solid: false, opaque: false, hard: 0.02, drop: "graminha", replaceable: true }),
  B(30, "Flower", { shape: "cross", solid: false, opaque: false, hard: 0.02 }),
  B(31, "Bricks", { hard: 3, tool: "picareta", needTool: 1 }),
];
export const AIR = 0, WATER = 5;
export const isSolid = id => BLOCKS[id]?.solid ?? false;
export const isOpaque = id => BLOCKS[id]?.opaque ?? false;

// ---------- Itens (id ≥ 100). tool: tipo/nível · dmg: dano · food: fome recuperada ----------
const I = (id, name, o = {}) => ({ id, name, item: true, ...o });
export const ITEMS = [
  I(100, "Stick"), I(101, "Coal", { fuel: 8 }), I(102, "Iron Ingot"), I(103, "Voltite Dust"),
  I(104, "Wheat"), I(105, "Wheat Seeds", { plants: 18 }), I(106, "Carrot", { plants: 19, food: 3 }), I(107, "Bread", { food: 6 }),
  I(108, "Raw Meat", { food: 2 }), I(109, "Cooked Meat", { food: 8 }), I(111, "Clay"),
  ...[["picareta", 120], ["machado", 125], ["pa", 130], ["espada", 135], ["enxada", 140]].flatMap(([t, base]) =>
    [["Wooden", 1], ["Stone", 2], ["Iron", 3]].map(([m, lvl], k) =>
      I(base + k, `${m} ${{ picareta: "Pickaxe", machado: "Axe", pa: "Shovel", espada: "Sword", enxada: "Hoe" }[t]}`, { tool: t, level: lvl, dmg: t === "espada" ? 3 + lvl : t === "machado" ? 2 + lvl : 1 + lvl / 2 }))),
];
export const ITEM = Object.fromEntries([...BLOCKS.map(b => [b.id, b]), ...ITEMS.map(i => [i.id, i])]);
export const itemName = id => ITEM[id]?.name || `#${id}`;
export const placeable = id => id > 0 && id < 100 && id !== WATER && id !== 28;
export const MAX_STACK = 64;

/** Velocidade de quebra: multiplicador conforme a ferramenta segurada. */
export function digTime(blockId, toolId) {
  const b = BLOCKS[blockId]; if (!b || b.hard < 0) return Infinity;
  const t = ITEM[toolId];
  const ok = t?.tool && t.tool === b.tool;
  return b.hard / (ok ? [1, 2, 4, 6][t.level] : 1);
}
/** O que cai ao quebrar (retorna lista [id, qtd]). */
export function drops(blockId, meta, toolId, rnd = Math.random) {
  const b = BLOCKS[blockId], t = ITEM[toolId];
  if (!b || b.hard < 0) return [];
  if (b.needTool && !(t?.tool === "picareta" && t.level >= b.needTool)) return [];
  if (b.drop === "folhas") return rnd() < 0.08 ? [[20, 1]] : rnd() < 0.05 ? [[100, 1]] : [];
  if (b.drop === "graminha") return rnd() < 0.15 ? [[105, 1]] : [];
  if (b.drop === "trigo") return meta >= 7 ? [[104, 1], [105, 1 + Math.floor(rnd() * 2)]] : [[105, 1]];
  if (b.drop === "cenoura") return meta >= 7 ? [[106, 2 + Math.floor(rnd() * 2)]] : [[106, 1]];
  if (b.drop === 0) return [];
  const n = b.dropN ? b.dropN[0] + Math.floor(rnd() * (b.dropN[1] - b.dropN[0] + 1)) : 1;
  return [[b.drop ?? blockId, n]];
}

// ---------- Receitas ----------
// where: "hand" (inventário), "workbench" (perto de uma bancada), "furnace". need: [[id, qtd], …] · out: [id, qtd]
const R = (where, out, need) => ({ where, out, need });
const toolsOf = (mat, matName, lvlBase) => [
  R("workbench", [120 + lvlBase, 1], [[mat, 3], [100, 2]]), R("workbench", [125 + lvlBase, 1], [[mat, 3], [100, 2]]),
  R("workbench", [130 + lvlBase, 1], [[mat, 1], [100, 2]]), R("workbench", [135 + lvlBase, 1], [[mat, 2], [100, 1]]),
  R("workbench", [140 + lvlBase, 1], [[mat, 2], [100, 2]]),
];
export const RECIPES = [
  R("hand", [8, 4], [[6, 1]]), R("hand", [100, 4], [[8, 2]]), R("hand", [14, 1], [[8, 4]]), R("hand", [16, 4], [[101, 1], [100, 1]]),
  R("hand", [21, 8], [[103, 1]]),
  ...toolsOf(8, "madeira", 0), ...toolsOf(9, "pedra", 1), ...toolsOf(102, "ferro", 2),
  R("workbench", [15, 1], [[9, 8]]), R("workbench", [107, 1], [[104, 3]]), R("workbench", [27, 1], [[8, 6]]),
  R("workbench", [22, 1], [[103, 9]]), R("workbench", [23, 1], [[100, 1], [9, 1]]), R("workbench", [24, 1], [[9, 1], [103, 1]]),
  R("workbench", [25, 1], [[103, 4], [10, 1]]), R("workbench", [26, 1], [[103, 2], [100, 1], [9, 1]]), R("workbench", [31, 4], [[111, 4]]),
  R("furnace", [10, 1], [[4, 1]]), R("furnace", [102, 1], [[12, 1]]), R("furnace", [109, 1], [[108, 1]]),
  R("furnace", [3, 1], [[9, 1]]), R("furnace", [101, 1], [[6, 1]]), R("furnace", [111, 1], [[2, 1]]),
];
export const FUEL = { 101: 8, 8: 2, 6: 2, 100: 1 }; // unidades: cada fundição gasta 1

// ---------- Ruído simplex 2D (determinístico) ----------
const perm = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i); let s = SEED;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return Uint8Array.from([...p, ...p]);
})();
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function simplex(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1), G = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G;
  const x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G, y1 = y0 - j1 + G, x2 = x0 - 1 + 2 * G, y2 = y0 - 1 + 2 * G, ii = i & 255, jj = j & 255;
  const c = (x, y, g) => { let tt = 0.5 - x * x - y * y; if (tt < 0) return 0; tt *= tt; const gr = G2[g % 8]; return tt * tt * (gr[0] * x + gr[1] * y); };
  return 70 * (c(x0, y0, perm[ii + perm[jj]]) + c(x1, y1, perm[ii + i1 + perm[jj + j1]]) + c(x2, y2, perm[ii + 1 + perm[jj + 1]]));
}
const fbm = (x, z, oct = 4) => { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * simplex(x * f, z * f); n += a; a *= 0.5; f *= 2; } return s / n; };
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ SEED; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function heightAt(x, z) {
  const base = fbm(x / 90, z / 90), mount = Math.max(0, fbm(x / 260 + 50, z / 260 - 30) - 0.15);
  return Math.max(4, Math.min(H - 8, Math.round(SEA + 3 + base * 9 + mount * 46)));
}
const treeAt = (x, z) => { const h = heightAt(x, z); return h > SEA + 1 && hash3(x, 7, z) < 0.012 ? h : 0; };

/** Gera um chunk (blocos + meta) a partir da semente. */
export function generateChunk(cx, cz) {
  const blocks = new Uint8Array(CS * CS * H), meta = new Uint8Array(CS * CS * H);
  const x0 = cx * CS, z0 = cz * CS;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = x0 + x, wz = z0 + z, h = heightAt(wx, wz), beach = h <= SEA + 1;
    for (let y = 0; y < H; y++) {
      let id = AIR;
      if (y === 0) id = 28;
      else if (y < h - 3) {
        const r = hash3(wx, y, wz); id = 3;
        if (y < 18 && r < 0.004) id = 13; else if (y < 34 && r < 0.008) id = 12; else if (r < 0.013) id = 11;
      } else if (y < h) id = beach ? 4 : 2;
      else if (y === h) id = beach ? 4 : 1;
      else if (y <= SEA) id = WATER;
      blocks[idx(x, y, z)] = id;
    }
    // vegetação rasteira
    if (!beach && h + 1 < H) { const r = hash3(wx, 3, wz); if (r < 0.07) blocks[idx(x, h + 1, z)] = 29; else if (r < 0.08) blocks[idx(x, h + 1, z)] = 30; }
  }
  // árvores (podem atravessar a borda do chunk: procura numa margem de 2)
  for (let tz = z0 - 2; tz < z0 + CS + 2; tz++) for (let tx = x0 - 2; tx < x0 + CS + 2; tx++) {
    const h = treeAt(tx, tz); if (!h) continue;
    const trunk = 4 + Math.floor(hash3(tx, 11, tz) * 2);
    const put = (wx, y, wz, id, only) => { const x = wx - x0, z = wz - z0; if (x < 0 || z < 0 || x >= CS || z >= CS || y >= H) return; const i = idx(x, y, z); if (!only || blocks[i] === AIR || blocks[i] === 29 || blocks[i] === 30) blocks[i] = id; };
    for (let y = h + 1; y <= h + trunk; y++) put(tx, y, tz, 6);
    for (let y = h + trunk - 1; y <= h + trunk + 1; y++) {
      const r = y > h + trunk ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) < r * 2 || r === 1) put(tx + dx, y, tz + dz, 7, true);
    }
  }
  return { blocks, meta };
}

/** Faixa de casa de cada IP (terreno protegido): em anel em volta do centro, como no NetCyties. */
export function homeFor(ip) {
  const parts = String(ip).split(".").map(Number), last = parts[3] ?? 0;
  const ang = (last / 256) * Math.PI * 2, r = 96;
  return { x: Math.round(Math.cos(ang) * r), z: Math.round(Math.sin(ang) * r), r: 12 };
}
