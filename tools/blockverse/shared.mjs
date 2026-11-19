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
// shape: cube | cross (plantas) | slab (cabo) | small (alavanca/botão/tocha) | door | cactus | chest | bed | ladder
// solid: colide · ch: altura da colisão (padrão 1) · opaque: esconde faces vizinhas · hard: segundos para quebrar com a mão · best: ferramenta ideal
const B = (id, name, o) => ({ id, name, shape: "cube", solid: true, opaque: true, hard: 1, best: null, ...o });
export const BLOCKS = [
  B(0, "Air", { solid: false, opaque: false, hard: 0 }),
  B(1, "Grass", { hard: 0.6, best: "pa", drop: 2 }),
  B(2, "Dirt", { hard: 0.6, best: "pa" }),
  B(3, "Stone", { hard: 3, best: "picareta", needTool: 1, drop: 9 }),
  B(4, "Sand", { hard: 0.6, best: "pa" }),
  B(5, "Water", { solid: false, opaque: false, hard: -1, liquid: true }),
  B(6, "Log", { hard: 1.6, best: "machado" }),
  B(7, "Leaves", { opaque: false, hard: 0.3, cutout: true, drop: "folhas" }),
  B(8, "Planks", { hard: 1.4, best: "machado" }),
  B(9, "Cobblestone", { hard: 3, best: "picareta", needTool: 1 }),
  B(10, "Glass", { opaque: false, hard: 0.4, cutout: true, drop: 0 }),
  B(11, "Coal Ore", { hard: 3.5, best: "picareta", needTool: 1, drop: 101 }),
  B(12, "Iron Ore", { hard: 4, best: "picareta", needTool: 2 }),
  B(13, "Voltite Ore", { hard: 4, best: "picareta", needTool: 2, drop: 103, dropN: [2, 4], glow: true }),
  B(14, "Workbench", { hard: 1.6, best: "machado", use: "workbench" }),
  B(15, "Furnace", { hard: 3, best: "picareta", needTool: 1, use: "furnace" }),
  B(16, "Torch", { shape: "small", solid: false, opaque: false, hard: 0.05, glow: true }),
  B(17, "Farmland", { hard: 0.6, best: "pa", drop: 2 }),
  B(18, "Wheat Crop", { shape: "cross", solid: false, opaque: false, hard: 0.05, crop: 105, stages: 8, drop: "trigo" }),
  B(19, "Carrot Crop", { shape: "cross", solid: false, opaque: false, hard: 0.05, crop: 106, stages: 8, drop: "cenoura" }),
  B(20, "Sapling", { shape: "cross", solid: false, opaque: false, hard: 0.05, sapling: true }),
  B(21, "Power Cable", { shape: "slab", solid: false, opaque: false, hard: 0.05, energy: "cable" }),
  B(22, "Power Core", { hard: 2, best: "picareta", energy: "core", glow: true }),
  B(23, "Lever", { shape: "small", solid: false, opaque: false, hard: 0.3, energy: "lever", use: "lever" }),
  B(24, "Button", { shape: "small", solid: false, opaque: false, hard: 0.3, energy: "button", use: "button" }),
  B(25, "Lamp", { hard: 0.6, opaque: true, energy: "lamp" }),
  B(26, "Inverter", { hard: 1, best: "picareta", energy: "inverter" }),
  B(27, "Door", { shape: "door", hard: 1.5, best: "machado", energy: "door", use: "door", opaque: false }),
  B(28, "Bedrock", { hard: -1 }),
  B(29, "Tall Grass", { shape: "cross", solid: false, opaque: false, hard: 0.02, drop: "graminha", replaceable: true }),
  B(30, "Flower", { shape: "cross", solid: false, opaque: false, hard: 0.02 }),
  B(31, "Bricks", { hard: 3, best: "picareta", needTool: 1 }),
  B(32, "Snowy Grass", { hard: 0.6, best: "pa", drop: 2 }),
  B(33, "Snow", { hard: 0.5, best: "pa" }),
  B(34, "Ice", { opaque: false, hard: 0.5, best: "picareta", drop: 0, translucent: true, slip: true }),
  B(35, "Sandstone", { hard: 2.4, best: "picareta", needTool: 1 }),
  B(36, "Cactus", { shape: "cactus", opaque: false, hard: 0.4, hurts: true }),
  B(37, "Dead Bush", { shape: "cross", solid: false, opaque: false, hard: 0.02, drop: "galho", replaceable: true }),
  B(38, "Pine Log", { hard: 1.6, best: "machado" }),
  B(39, "Pine Leaves", { opaque: false, hard: 0.3, cutout: true, drop: "folhas2" }),
  B(40, "Birch Log", { hard: 1.6, best: "machado" }),
  B(41, "Birch Leaves", { opaque: false, hard: 0.3, cutout: true, drop: "folhas2" }),
  B(42, "Gold Ore", { hard: 4.5, best: "picareta", needTool: 3 }),
  B(43, "Azurite Ore", { hard: 5, best: "picareta", needTool: 3, drop: 115 }),
  B(44, "Lava", { solid: false, opaque: false, hard: -1, liquid: true, glow: true }),
  B(45, "Chest", { shape: "chest", opaque: false, hard: 1.6, best: "machado", use: "chest" }),
  B(46, "Bed", { shape: "bed", opaque: false, ch: 9 / 16, hard: 0.4, use: "bed" }),
  B(47, "Ladder", { shape: "ladder", solid: false, opaque: false, hard: 0.4, best: "machado", climb: true }),
  B(48, "Wool", { hard: 0.8 }),
  B(49, "Stone Bricks", { hard: 3, best: "picareta", needTool: 1 }),
  B(50, "Pumpkin", { hard: 1, best: "machado" }),
  B(51, "Pumpkin Lantern", { hard: 1, best: "machado", glow: true }),
  B(52, "Gold Block", { hard: 4, best: "picareta", needTool: 3 }),
  B(53, "Azurite Block", { hard: 5, best: "picareta", needTool: 3 }),
];
export const AIR = 0, WATER = 5, LAVA = 44;
export const isLiquid = id => id === WATER || id === LAVA;
/** Blocos com "frente" (fornalha, abóbora…) guardam a direção nos bits 2-3 do meta. */
export const FACING_BLOCKS = new Set([14, 15, 23, 24, 27, 45, 46, 47, 50, 51]);
export const isSolid = id => BLOCKS[id]?.solid ?? false;
export const isOpaque = id => BLOCKS[id]?.opaque ?? false;

// ---------- Itens (id ≥ 100). tool: tipo/nível · dmg: dano · food: fome recuperada ----------
const I = (id, name, o = {}) => ({ id, name, item: true, ...o });
export const ITEMS = [
  I(100, "Stick"), I(101, "Coal", { fuel: 8 }), I(102, "Iron Ingot"), I(103, "Voltite Dust"),
  I(104, "Wheat"), I(105, "Wheat Seeds", { plants: 18 }), I(106, "Carrot", { plants: 19, food: 3 }), I(107, "Bread", { food: 6 }),
  I(108, "Raw Meat", { food: 2 }), I(109, "Cooked Meat", { food: 8 }), I(110, "Feather"), I(111, "Clay"),
  I(112, "Apple", { food: 4 }), I(113, "Golden Apple", { food: 8, heal: 10 }), I(114, "Gold Ingot"), I(115, "Azurite"),
  I(116, "Bucket", { max: 16 }), I(117, "Water Bucket", { max: 1 }), I(118, "String"), I(119, "Bow", { max: 1, bow: true }),
  I(145, "Arrow"), I(146, "Pumpkin Pie", { food: 7 }),
  ...[["picareta", 120], ["machado", 125], ["pa", 130], ["espada", 135], ["enxada", 140]].flatMap(([t, base]) =>
    [["Wooden", 1], ["Stone", 2], ["Iron", 3], ["Azurite", 4]].map(([m, lvl], k) =>
      I(base + k, `${m} ${{ picareta: "Pickaxe", machado: "Axe", pa: "Shovel", espada: "Sword", enxada: "Hoe" }[t]}`, { tool: t, level: lvl, dmg: t === "espada" ? 3 + lvl : t === "machado" ? 2 + lvl : 1 + lvl / 2 }))),
];
export const ITEM = Object.fromEntries([...BLOCKS.map(b => [b.id, b]), ...ITEMS.map(i => [i.id, i])]);
export const itemName = id => ITEM[id]?.name || `#${id}`;
export const placeable = id => id > 0 && id < 100 && id !== WATER && id !== 28;
export const MAX_STACK = 64;
/** Tamanho máximo da pilha de um item. */
export const maxStack = id => ITEM[id]?.max ?? (ITEM[id]?.tool ? 1 : MAX_STACK);

/** Velocidade de quebra: multiplicador conforme a ferramenta segurada. */
export function digTime(blockId, toolId) {
  const b = BLOCKS[blockId]; if (!b || b.hard < 0) return Infinity;
  const t = ITEM[toolId];
  const ok = t?.item && t.tool && t.tool === b.best;
  return b.hard / (ok ? [1, 2, 4, 6, 9][t.level] : 1);
}
/** O que cai ao quebrar (retorna lista [id, qtd]). */
export function drops(blockId, meta, toolId, rnd = Math.random) {
  const b = BLOCKS[blockId], t = ITEM[toolId];
  if (!b || b.hard < 0) return [];
  if (b.needTool && !(t?.tool === "picareta" && t.level >= b.needTool)) return [];
  if (b.drop === "folhas") { const r = rnd(); return r < 0.08 ? [[20, 1]] : r < 0.11 ? [[112, 1]] : r < 0.16 ? [[100, 1]] : []; }
  if (b.drop === "folhas2") { const r = rnd(); return r < 0.06 ? [[20, 1]] : r < 0.11 ? [[100, 1]] : []; }
  if (b.drop === "galho") return rnd() < 0.5 ? [[100, 1 + Math.floor(rnd() * 2)]] : [];
  if (b.drop === "graminha") return rnd() < 0.15 ? [[105, 1]] : [];
  if (b.drop === "trigo") return meta >= 7 ? [[104, 1], [105, 1 + Math.floor(rnd() * 2)]] : [[105, 1]];
  if (b.drop === "cenoura") return meta >= 7 ? [[106, 2 + Math.floor(rnd() * 2)]] : [[106, 1]];
  if (b.drop === 0) return [];
  const n = b.dropN ? b.dropN[0] + Math.floor(rnd() * (b.dropN[1] - b.dropN[0] + 1)) : 1;
  return [[b.drop ?? blockId, n]];
}

// ---------- Receitas (com formato, como na grade de crafting) ----------
// shape: linhas da grade (espaço = vazio) · key: letra -> id · out: [id, qtd]
// Receitas de até 2×2 cabem na grade do inventário; as de 3 linhas/colunas precisam da bancada.
// Toda receita vale também espelhada na horizontal. "furnace" = fundição (1 item -> resultado).
const S = (out, shape, key) => ({ where: "grid", out, shape, key });
const TOOL_SHAPES = { 120: ["MMM", " S ", " S "], 125: ["MM", "MS", " S"], 130: ["M", "S", "S"], 135: ["M", "M", "S"], 140: ["MM", " S", " S"] };
const toolsOf = (mat, lvl) => Object.entries(TOOL_SHAPES).map(([base, shape]) => S([+base + lvl, 1], shape, { M: mat, S: 100 }));
const F = (out, input) => ({ where: "furnace", out, need: [[input, 1]] });
export const RECIPES = [
  S([8, 4], ["L"], { L: 6 }), S([8, 4], ["L"], { L: 38 }), S([8, 4], ["L"], { L: 40 }),
  S([100, 4], ["P", "P"], { P: 8 }),
  S([14, 1], ["PP", "PP"], { P: 8 }),
  S([16, 4], ["C", "S"], { C: 101, S: 100 }),
  S([21, 8], ["V"], { V: 103 }),
  ...toolsOf(8, 0), ...toolsOf(9, 1), ...toolsOf(102, 2), ...toolsOf(115, 3),
  S([15, 1], ["CCC", "C C", "CCC"], { C: 9 }),
  S([107, 1], ["WWW"], { W: 104 }),
  S([27, 1], ["PP", "PP", "PP"], { P: 8 }),
  S([22, 1], ["VVV", "VVV", "VVV"], { V: 103 }),
  S([23, 1], ["S", "C"], { S: 100, C: 9 }),
  S([24, 1], ["V", "C"], { V: 103, C: 9 }),
  S([25, 1], [" V ", "VGV", " V "], { V: 103, G: 10 }),
  S([26, 1], [" V ", "VSV", "CCC"], { V: 103, S: 100, C: 9 }),
  S([31, 4], ["KK", "KK"], { K: 111 }),
  S([49, 4], ["SS", "SS"], { S: 3 }),
  S([35, 1], ["SS", "SS"], { S: 4 }),
  S([45, 1], ["PPP", "P P", "PPP"], { P: 8 }),
  S([46, 1], ["WWW", "PPP"], { W: 48, P: 8 }),
  S([47, 3], ["S S", "SSS", "S S"], { S: 100 }),
  S([48, 1], ["XX", "XX"], { X: 118 }),
  S([116, 1], ["I I", " I "], { I: 102 }),
  S([119, 1], [" SX", "S X", " SX"], { S: 100, X: 118 }),
  S([145, 4], ["C", "S", "F"], { C: 9, S: 100, F: 110 }),
  S([51, 1], ["P", "T"], { P: 50, T: 16 }),
  S([146, 1], ["PW"], { P: 50, W: 104 }),
  S([113, 1], ["GGG", "GAG", "GGG"], { G: 114, A: 112 }),
  S([52, 1], ["GGG", "GGG", "GGG"], { G: 114 }), S([114, 9], ["B"], { B: 52 }),
  S([53, 1], ["AAA", "AAA", "AAA"], { A: 115 }), S([115, 9], ["B"], { B: 53 }),
  F([10, 1], 4), F([102, 1], 12), F([114, 1], 42), F([109, 1], 108), F([3, 1], 9), F([101, 1], 6), F([101, 1], 38), F([101, 1], 40), F([111, 1], 2),
];
for (const r of RECIPES) if (r.shape) { // lista de ingredientes (para o livro de receitas)
  const n = {}; for (const row of r.shape) for (const ch of row) if (ch !== " ") n[r.key[ch]] = (n[r.key[ch]] || 0) + 1;
  r.need = Object.entries(n).map(([id, q]) => [+id, q]);
  r.w = Math.max(...r.shape.map(x => x.length)); r.h = r.shape.length;
}

/** Procura a receita que a grade (size 2 ou 3, array de ids ou 0) forma. Retorna a receita ou null. */
export function matchGrid(ids, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (ids[y * size + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const at = (x, y) => ids[(y0 + y) * size + x0 + x] || 0;
  for (const r of RECIPES) {
    if (!r.shape || r.w !== w || r.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = (r.shape[y][mirror ? w - 1 - x : x] ?? " ");
        if ((ch === " " ? 0 : r.key[ch]) !== at(x, y)) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}
export const FUEL = { 101: 8, 8: 2, 6: 2, 38: 2, 40: 2, 100: 1, 47: 1, 14: 2, 45: 2 }; // unidades: cada fundição gasta 1

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
/** Bioma: "desert", "snow", "forest" ou "plains". */
export function biomeAt(x, z) {
  const t = fbm(x / 350 + 100, z / 350 - 70, 2);
  if (t > 0.3) return "desert";
  if (t < -0.3) return "snow";
  return fbm(x / 150 - 20, z / 150 + 40, 2) > 0.12 ? "forest" : "plains";
}
// ruído de valor 3D (cavernas)
const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t);
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c) * 2 - 1;
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), xf), lerp(h(0, 1, 0), h(1, 1, 0), xf), yf),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), xf), lerp(h(0, 1, 1), h(1, 1, 1), xf), yf), zf);
}
const isCave = (x, y, z) => {
  const a = noise3(x / 18, y / 11, z / 18), b = noise3(x / 18 + 31.7, y / 11 + 17.3, z / 18 - 9.1);
  return a * a + b * b < 0.018 || noise3(x / 34 - 5, y / 16, z / 34 + 8) > 0.62;
};
function treeKind(x, z) {
  const h = heightAt(x, z); if (h <= SEA + 1) return null;
  const bio = biomeAt(x, z), r = hash3(x, 7, z);
  if (bio === "desert") return r < 0.008 ? { kind: "cactus", h } : null;
  if (bio === "snow") return r < 0.014 ? { kind: "pine", h } : null;
  if (bio === "forest") return r < 0.035 ? { kind: hash3(x, 9, z) < 0.35 ? "birch" : "oak", h } : null;
  return r < 0.006 ? { kind: "oak", h } : null;
}

/** Gera um chunk (blocos + meta) a partir da semente. */
export function generateChunk(cx, cz) {
  const blocks = new Uint8Array(CS * CS * H), meta = new Uint8Array(CS * CS * H);
  const x0 = cx * CS, z0 = cz * CS;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = x0 + x, wz = z0 + z, h = heightAt(wx, wz), beach = h <= SEA + 1, bio = biomeAt(wx, wz);
    const top = beach ? 4 : bio === "desert" ? 4 : bio === "snow" ? 32 : 1;
    const under = beach ? 4 : bio === "desert" ? 35 : 2;
    const wet = h <= SEA + 3; // perto da água: sem cavernas rasas (evita vazamentos)
    for (let y = 0; y < H; y++) {
      let id = AIR;
      if (y === 0) id = 28;
      else if (y < h - 3) {
        const r = hash3(wx, y, wz); id = bio === "desert" && y > h - 7 ? 35 : 3;
        if (y < 14 && r < 0.0012) id = 43;
        else if (y < 18 && r < 0.005) id = 13;
        else if (y < 26 && r < 0.0085) id = 42;
        else if (y < 34 && r < 0.016) id = 12;
        else if (r < 0.03) id = 11;
      } else if (y < h) id = under;
      else if (y === h) id = top;
      else if (y <= SEA) id = bio === "snow" && y === SEA ? 34 : WATER;
      if (id !== AIR && id !== WATER && id !== 34 && y > 0 && y <= h && !(wet && y > h - 6) && isCave(wx, y, wz)) id = y <= 6 ? LAVA : AIR;
      blocks[idx(x, y, z)] = id;
    }
    // vegetação rasteira
    if (!beach && h + 1 < H && blocks[idx(x, h, z)] === top) {
      const r = hash3(wx, 3, wz), up = idx(x, h + 1, z);
      if (bio === "desert") { if (r < 0.02) blocks[up] = 37; }
      else if (bio !== "snow") {
        if (r < 0.07) blocks[up] = 29; else if (r < 0.08) blocks[up] = 30;
        else if (bio === "plains" && r < 0.083) { blocks[up] = 50; meta[up] = (Math.floor(hash3(wx, 5, wz) * 4)) << 2; }
      }
    }
  }
  // árvores e cactos (podem atravessar a borda do chunk: procura numa margem de 3)
  for (let tz = z0 - 3; tz < z0 + CS + 3; tz++) for (let tx = x0 - 3; tx < x0 + CS + 3; tx++) {
    const t = treeKind(tx, tz); if (!t) continue;
    const h = t.h;
    const put = (wx, y, wz, id, only) => { const x = wx - x0, z = wz - z0; if (x < 0 || z < 0 || x >= CS || z >= CS || y >= H) return; const i = idx(x, y, z); if (!only || blocks[i] === AIR || blocks[i] === 29 || blocks[i] === 30 || blocks[i] === 37) blocks[i] = id; };
    const ground = (() => { const x = tx - x0, z = tz - z0; return x < 0 || z < 0 || x >= CS || z >= CS ? -1 : blocks[idx(x, h, z)]; })();
    if (ground === AIR || ground === LAVA) continue; // a caverna comeu o chão
    if (t.kind === "cactus") { const n = 1 + Math.floor(hash3(tx, 13, tz) * 3); for (let y = h + 1; y <= h + n; y++) put(tx, y, tz, 36); continue; }
    if (t.kind === "pine") {
      const trunk = 6 + Math.floor(hash3(tx, 11, tz) * 3);
      for (let y = h + 1; y <= h + trunk; y++) put(tx, y, tz, 38);
      put(tx, h + trunk + 1, tz, 39, true);
      for (let i = 0; i < trunk - 2; i++) {
        const y = h + trunk - i, r = i % 2 === 0 ? (i === 0 ? 1 : 1) : Math.min(3, 1 + (i >> 1));
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) <= r + (r > 1 ? 0 : 1) && (dx || dz)) put(tx + dx, y, tz + dz, 39, true);
      }
      continue;
    }
    const log = t.kind === "birch" ? 40 : 6, leaf = t.kind === "birch" ? 41 : 7;
    const trunk = (t.kind === "birch" ? 5 : 4) + Math.floor(hash3(tx, 11, tz) * 2);
    for (let y = h + 1; y <= h + trunk; y++) put(tx, y, tz, log);
    for (let y = h + trunk - 1; y <= h + trunk + 1; y++) {
      const r = y > h + trunk ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) < r * 2 || r === 1) put(tx + dx, y, tz + dz, leaf, true);
    }
  }
  return { blocks, meta };
}

/** Ponto de nascimento do mundo (igual para todos). */
export const WORLD_SPAWN = { x: 8, z: 8 };
