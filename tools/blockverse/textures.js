// BlockVerse — texturas procedurais (16×16 px) num atlas 16×8 e ícones dos itens.
import { BLOCKS, ITEM } from "./shared.mjs";
import { drawItemSprite } from "./sprites.js";

export const ATLAS_COLS = 16, ATLAS_ROWS = 8;
const mul = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const jit = (c, r, v) => { const k = (r() - 0.5) * v; return [c[0] + k, c[1] + k, c[2] + k, c[3] ?? 255]; };

function painter(img, seed) {
  const r = mul(seed);
  const px = (u, v, c) => { u |= 0; v |= 0; if (u < 0 || v < 0 || u > 15 || v > 15) return; const o = (v * 16 + u) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] ?? 255; };
  const fill = (c, v = 24) => { const b = hex(c); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, jit(b, r, v)); };
  const spots = (c, n, size = 2) => { const b = hex(c); for (let i = 0; i < n; i++) { const x = r() * 14, y = r() * 14; for (let a = 0; a < size; a++) for (let d = 0; d < size; d++) if (r() < 0.85) px(x + a, y + d, jit(b, r, 30)); } };
  const rect = (x0, y0, x1, y1, c, v = 0) => { const b = hex(c); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, jit(b, r, v)); };
  const clear = () => img.data.fill(0);
  return { px, fill, spots, rect, clear, r, hex };
}

const T = {};
const DEFS = [];
const def = (name, fn) => { T[name] = DEFS.length; DEFS.push(fn); };

def("grass_top", p => p.fill("#5fa83a", 34));
def("grass_side", p => { p.fill("#8a5a35", 28); for (let x = 0; x < 16; x++) { const h = 3 + (p.r() * 2 | 0); for (let y = 0; y < h; y++) p.px(x, y, p.hex("#5fa83a").map((c, i) => i < 3 ? c + (p.r() - 0.5) * 30 : 255)); } });
def("dirt", p => { p.fill("#8a5a35", 30); p.spots("#6b4426", 6, 1); });
def("stone", p => { p.fill("#8b8d91", 22); p.spots("#74767a", 7, 2); });
def("sand", p => p.fill("#dccf8f", 20));
def("water", p => { p.fill("#2d64c8", 16); for (let i = 0; i < 6; i++) { const y = p.r() * 16, x = p.r() * 12; p.rect(x | 0, y | 0, (x | 0) + 3, y | 0, "#5a8ee6"); } });
def("log_side", p => { p.fill("#6e4b2a", 18); for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y++) if (p.r() < 0.7) p.px(x, y, p.hex("#4f341c")); });
def("log_top", p => { p.fill("#b88b52", 14); for (let a = 0; a < 6.28; a += 0.05) for (const rr of [7, 4.5, 2]) p.px(8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr, p.hex(rr === 7 ? "#6e4b2a" : "#9a7140")); });
def("leaves", p => { p.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.r() < 0.8) p.px(x, y, [50 + p.r() * 40, 120 + p.r() * 50, 40 + p.r() * 25, 255]); });
def("planks", p => { p.fill("#b8884e", 18); for (let y = 3; y < 16; y += 4) p.rect(0, y, 15, y, "#7d5a30"); for (let y = 0; y < 16; y += 4) p.px(((y / 4) % 2) * 8 + 3, y + 1, p.hex("#7d5a30")); });
def("cobble", p => { p.fill("#7a7c80", 30); for (let i = 0; i < 9; i++) { const x = p.r() * 13 | 0, y = p.r() * 13 | 0; p.rect(x, y, x + 3, y + 2, "#9a9ca0", 16); p.rect(x, y + 3, x + 3, y + 3, "#55575b"); } });
def("glass", p => { p.clear(); for (let i = 0; i < 16; i++) { p.px(i, 0, [220, 240, 255, 255]); p.px(i, 15, [160, 190, 210, 255]); p.px(0, i, [220, 240, 255, 255]); p.px(15, i, [160, 190, 210, 255]); } p.px(4, 4, [255, 255, 255, 255]); p.px(5, 3, [255, 255, 255, 255]); p.px(3, 5, [255, 255, 255, 255]); });
def("coal_ore", p => { p.fill("#8b8d91", 22); p.spots("#1f1f22", 6, 2); });
def("iron_ore", p => { p.fill("#8b8d91", 22); p.spots("#d8a882", 6, 2); });
def("voltite_ore", p => { p.fill("#6f7377", 18); p.spots("#3ff0ff", 7, 2); });
def("bench_top", p => { p.fill("#b8884e", 14); p.rect(0, 0, 15, 1, "#6e4b2a"); p.rect(0, 14, 15, 15, "#6e4b2a"); p.rect(2, 4, 7, 9, "#8b8d91"); p.rect(10, 3, 11, 12, "#6e4b2a"); });
def("bench_side", p => { p.fill("#9a7140", 16); p.rect(0, 0, 15, 3, "#b8884e"); p.rect(2, 6, 5, 11, "#55575b"); p.rect(9, 6, 13, 8, "#c8c8c8"); });
def("furnace_side", p => { p.fill("#7a7c80", 22); p.rect(0, 0, 15, 1, "#5a5c60"); });
def("furnace_front", p => { p.fill("#7a7c80", 22); p.rect(3, 7, 12, 13, "#1e1e22"); p.rect(3, 3, 12, 4, "#55575b"); });
def("furnace_lit", p => { p.fill("#7a7c80", 22); p.rect(3, 7, 12, 13, "#1e1e22"); for (let i = 0; i < 26; i++) p.px(4 + p.r() * 8, 9 + p.r() * 5, [255, 120 + p.r() * 120, 30, 255]); p.rect(3, 3, 12, 4, "#55575b"); });
def("torch", p => { p.clear(); p.rect(7, 6, 8, 15, "#7d5a30"); p.rect(6, 3, 9, 6, "#ffcf3f"); p.rect(7, 2, 8, 3, "#fff2a8"); });
def("farmland", p => { p.fill("#5e3c22", 22); for (let y = 1; y < 16; y += 4) p.rect(0, y, 15, y, "#3e2614"); });
for (let s = 0; s < 4; s++) def(`wheat${s}`, p => { p.clear(); const h = 4 + s * 3, c = s === 3 ? "#d9b84a" : s === 2 ? "#a6b43c" : "#5fa83a"; for (let x = 1; x < 16; x += 3) { p.rect(x, 16 - h, x, 15, c); if (s === 3) p.rect(x - 1, 16 - h, x + 1, 16 - h + 2, "#e8cb5e"); } });
for (let s = 0; s < 4; s++) def(`carrot${s}`, p => { p.clear(); const h = 3 + s * 2; for (let x = 2; x < 16; x += 4) { p.rect(x, 16 - h, x + 1, 15, "#4f9a2f"); p.px(x - 1, 16 - h + 1, p.hex("#5fb83a")); p.px(x + 2, 16 - h + 1, p.hex("#5fb83a")); if (s === 3) p.rect(x, 13, x + 1, 15, "#f08a24"); } });
def("sapling", p => { p.clear(); p.rect(7, 9, 8, 15, "#6e4b2a"); for (let i = 0; i < 40; i++) p.px(3 + p.r() * 10, 2 + p.r() * 9, [50 + p.r() * 40, 130 + p.r() * 50, 40, 255]); });
def("cable", p => { p.fill("#3a3f4a", 10); p.rect(0, 6, 15, 9, "#c8d0e0", 10); p.rect(6, 0, 9, 15, "#c8d0e0", 10); });
def("core", p => { p.fill("#2a1f4a", 14); p.rect(3, 3, 12, 12, "#3ff0ff", 30); p.rect(6, 6, 9, 9, "#ffffff"); p.rect(0, 0, 15, 0, "#ff3fd8"); p.rect(0, 15, 15, 15, "#ff3fd8"); });
def("lever", p => { p.clear(); p.rect(4, 12, 11, 15, "#7a7c80"); p.rect(7, 3, 8, 12, "#7d5a30"); p.rect(6, 2, 9, 4, "#c0303a"); });
def("button", p => { p.clear(); p.rect(5, 6, 10, 10, "#9a9ca0", 10); p.rect(5, 10, 10, 10, "#55575b"); });
def("lamp_off", p => { p.fill("#4a4436", 14); p.rect(2, 2, 13, 13, "#6b6450", 10); for (let i = 2; i < 14; i += 4) { p.rect(i, 2, i, 13, "#3a3428"); p.rect(2, i, 13, i, "#3a3428"); } });
def("lamp_on", p => { p.fill("#c89a3a", 14); p.rect(2, 2, 13, 13, "#ffe08a", 20); for (let i = 2; i < 14; i += 4) { p.rect(i, 2, i, 13, "#e8a830"); p.rect(2, i, 13, i, "#e8a830"); } });
def("inverter_top", p => { p.fill("#7a7c80", 14); p.rect(2, 2, 13, 13, "#2a2f3a"); p.rect(5, 7, 10, 8, "#ff3fd8"); p.rect(7, 4, 8, 6, "#ff3fd8"); });
def("inverter_top_on", p => { p.fill("#7a7c80", 14); p.rect(2, 2, 13, 13, "#2a2f3a"); p.rect(5, 7, 10, 8, "#3ff0ff"); p.rect(7, 4, 8, 6, "#3ff0ff"); p.rect(6, 3, 9, 3, "#ffffff"); });
def("inverter_side", p => { p.fill("#7a7c80", 14); p.rect(0, 12, 15, 15, "#55575b"); p.rect(6, 4, 9, 9, "#2a2f3a"); });
def("door", p => { p.fill("#a87a42", 14); p.rect(0, 0, 15, 0, "#6e4b2a"); p.rect(0, 15, 15, 15, "#6e4b2a"); p.rect(0, 0, 0, 15, "#6e4b2a"); p.rect(15, 0, 15, 15, "#6e4b2a"); p.rect(3, 3, 12, 6, "#8d6434"); p.rect(3, 9, 12, 12, "#8d6434"); p.rect(12, 7, 13, 8, "#d8c060"); });
def("bedrock", p => { p.fill("#3a3a3e", 40); p.spots("#18181a", 10, 2); });
def("tallgrass", p => { p.clear(); for (let x = 0; x < 16; x += 2) { const h = 5 + p.r() * 9 | 0; for (let y = 16 - h; y < 16; y++) p.px(x + (y < 9 ? (p.r() < 0.5 ? 1 : 0) : 0), y, [60 + p.r() * 30, 140 + p.r() * 50, 40, 255]); } });
def("flower", p => { p.clear(); p.rect(7, 7, 8, 15, "#3f8a2a"); p.rect(5, 9, 6, 10, "#4f9a2f"); const c = p.r() < 0.5 ? "#ff3fd8" : "#ffcf3f"; p.rect(5, 2, 10, 6, c); p.rect(7, 3, 8, 5, "#fff2a8"); });
def("snow", p => { p.fill("#f2f6fa", 10); p.spots("#dfe8f2", 6, 1); });
def("snowy_side", p => { p.fill("#8a5a35", 28); for (let x = 0; x < 16; x++) { const h = 3 + (p.r() * 3 | 0); for (let y = 0; y < h; y++) p.px(x, y, [236 + p.r() * 14, 242 + p.r() * 10, 250, 255]); } });
def("ice", p => { p.fill("#9cc8f4", 12); for (let i = 0; i < 5; i++) { const x = p.r() * 12 | 0, y = p.r() * 12 | 0; for (let k = 0; k < 4; k++) p.px(x + k, y + k, [220, 240, 255, 255]); } });
def("sandstone_top", p => { p.fill("#d8c88a", 12); });
def("sandstone_side", p => { p.fill("#d4c283", 12); p.rect(0, 0, 15, 2, "#e2d49a", 8); p.rect(0, 7, 15, 7, "#b8a668"); p.rect(0, 12, 15, 15, "#c4b276", 8); });
def("cactus_side", p => { p.fill("#3f8a2f", 14); for (let x = 1; x < 16; x += 4) p.rect(x, 0, x, 15, "#2a6a1f"); for (let i = 0; i < 10; i++) p.px(p.r() * 16, p.r() * 16, [230, 230, 200, 255]); });
def("cactus_top", p => { p.fill("#4f9a3a", 12); p.rect(2, 2, 13, 13, "#3f8a2f"); p.rect(6, 6, 9, 9, "#5fae48"); });
def("deadbush", p => { p.clear(); const c = "#8a6a3a"; for (const [x0, dx] of [[8, -1], [8, 1], [8, 0], [7, -2], [9, 2]]) { let x = x0; for (let y = 15; y > 4 + p.r() * 4; y--) { p.px(x, y, p.hex(c)); if (p.r() < 0.35) x += dx; } } });
def("pine_side", p => { p.fill("#4a3220", 14); for (let x = 0; x < 16; x += 2) for (let y = 0; y < 16; y++) if (p.r() < 0.6) p.px(x, y, p.hex("#33220f")); });
def("pine_leaves", p => { p.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.r() < 0.82) p.px(x, y, [30 + p.r() * 25, 80 + p.r() * 35, 50 + p.r() * 25, 255]); });
def("birch_side", p => { p.fill("#e8e4d8", 10); for (let i = 0; i < 7; i++) { const x = p.r() * 13 | 0, y = p.r() * 15 | 0; p.rect(x, y, x + 2 + (p.r() * 2 | 0), y, "#2a2a26"); } });
def("birch_top", p => { p.fill("#d8c08a", 12); for (let a = 0; a < 6.28; a += 0.05) p.px(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, p.hex("#e8e4d8")); for (let a = 0; a < 6.28; a += 0.08) p.px(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, p.hex("#b89a60")); });
def("birch_leaves", p => { p.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.r() < 0.8) p.px(x, y, [100 + p.r() * 40, 160 + p.r() * 40, 60 + p.r() * 25, 255]); });
def("gold_ore", p => { p.fill("#8b8d91", 22); p.spots("#f8d040", 6, 2); });
def("azurite_ore", p => { p.fill("#8b8d91", 22); p.spots("#5ad8ff", 5, 2); p.spots("#1d74b0", 3, 1); });
def("lava", p => { p.fill("#e8601a", 30); p.spots("#ffb030", 8, 2); p.spots("#c03010", 5, 2); });
def("chest_side", p => { p.fill("#a8743a", 12); p.rect(0, 0, 15, 0, "#5a3a1a"); p.rect(0, 15, 15, 15, "#5a3a1a"); p.rect(0, 0, 0, 15, "#5a3a1a"); p.rect(15, 0, 15, 15, "#5a3a1a"); p.rect(0, 5, 15, 5, "#5a3a1a"); });
def("chest_front", p => { p.fill("#a8743a", 12); p.rect(0, 0, 15, 0, "#5a3a1a"); p.rect(0, 15, 15, 15, "#5a3a1a"); p.rect(0, 0, 0, 15, "#5a3a1a"); p.rect(15, 0, 15, 15, "#5a3a1a"); p.rect(0, 5, 15, 5, "#5a3a1a"); p.rect(7, 4, 8, 7, "#d8d8e0"); p.rect(7, 7, 8, 7, "#5a5a66"); });
def("chest_top", p => { p.fill("#b07a40", 12); p.rect(0, 0, 15, 0, "#5a3a1a"); p.rect(0, 15, 15, 15, "#5a3a1a"); p.rect(0, 0, 0, 15, "#5a3a1a"); p.rect(15, 0, 15, 15, "#5a3a1a"); });
def("bed_top", p => { p.fill("#c02a2a", 14); p.rect(0, 0, 15, 4, "#f2f2f2", 8); p.rect(0, 5, 15, 5, "#8a1a1a"); });
def("bed_side", p => { p.fill("#c02a2a", 14); p.rect(0, 12, 15, 15, "#a87a42", 10); p.rect(0, 7, 3, 11, "#f2f2f2", 6); });
def("ladder", p => { p.clear(); p.rect(2, 0, 3, 15, "#9a6a34"); p.rect(12, 0, 13, 15, "#9a6a34"); for (let y = 2; y < 16; y += 4) p.rect(4, y, 11, y + 1, "#b8864a"); });
def("wool", p => { p.fill("#ececec", 14); for (let i = 0; i < 30; i++) p.px(p.r() * 16, p.r() * 16, [210, 210, 210, 255]); });
def("stonebricks", p => { p.fill("#8e8e92", 14); for (const y of [0, 8]) p.rect(0, y + 7, 15, y + 7, "#5a5a5e"); p.rect(7, 0, 7, 7, "#5a5a5e"); p.rect(0, 8, 0, 15, "#5a5a5e"); p.rect(11, 8, 11, 15, "#5a5a5e"); p.rect(1, 1, 6, 1, "#a8a8ac"); });
def("pumpkin_side", p => { p.fill("#e08a1a", 14); for (let x = 1; x < 16; x += 4) p.rect(x, 0, x, 15, "#b8680a"); });
def("pumpkin_top", p => { p.fill("#d07a14", 12); p.rect(7, 6, 9, 9, "#6a4a1a"); });
def("pumpkin_face", p => { p.fill("#e08a1a", 14); for (let x = 1; x < 16; x += 4) p.rect(x, 0, x, 15, "#b8680a"); p.rect(3, 4, 5, 6, "#2a1404"); p.rect(10, 4, 12, 6, "#2a1404"); p.rect(4, 10, 11, 11, "#2a1404"); p.rect(5, 12, 10, 12, "#2a1404"); });
def("lantern_face", p => { p.fill("#e08a1a", 14); for (let x = 1; x < 16; x += 4) p.rect(x, 0, x, 15, "#b8680a"); p.rect(3, 4, 5, 6, "#fff070"); p.rect(10, 4, 12, 6, "#fff070"); p.rect(4, 10, 11, 11, "#fff070"); p.rect(5, 12, 10, 12, "#ffd040"); });
def("gold_block", p => { p.fill("#f0c830", 10); p.rect(0, 0, 15, 0, "#fff4a0"); p.rect(0, 0, 0, 15, "#fff4a0"); p.rect(0, 15, 15, 15, "#b88a10"); p.rect(15, 0, 15, 15, "#b88a10"); p.rect(3, 3, 6, 4, "#fff8c8"); });
def("azurite_block", p => { p.fill("#3fc8f0", 10); p.rect(0, 0, 15, 0, "#c8f6ff"); p.rect(0, 0, 0, 15, "#c8f6ff"); p.rect(0, 15, 15, 15, "#1d74b0"); p.rect(15, 0, 15, 15, "#1d74b0"); for (let i = 2; i < 14; i += 4) p.rect(i, i, i + 1, i + 1, "#e8fdff"); });
def("bricks", p => { p.fill("#a0503a", 18); for (let y = 0; y < 16; y += 4) { p.rect(0, y + 3, 15, y + 3, "#d8d0c0"); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) p.rect(x, y, x, y + 2, "#d8d0c0"); } });

/** [topo, base, lados, frente] para cada bloco. */
export function faceTiles(id, meta) {
  switch (id) {
    case 1: return [T.grass_top, T.dirt, T.grass_side];
    case 2: return [T.dirt, T.dirt, T.dirt];
    case 3: return [T.stone, T.stone, T.stone];
    case 4: return [T.sand, T.sand, T.sand];
    case 5: return [T.water, T.water, T.water];
    case 6: return [T.log_top, T.log_top, T.log_side];
    case 7: return [T.leaves, T.leaves, T.leaves];
    case 8: return [T.planks, T.planks, T.planks];
    case 9: return [T.cobble, T.cobble, T.cobble];
    case 10: return [T.glass, T.glass, T.glass];
    case 11: return [T.coal_ore, T.coal_ore, T.coal_ore];
    case 12: return [T.iron_ore, T.iron_ore, T.iron_ore];
    case 13: return [T.voltite_ore, T.voltite_ore, T.voltite_ore];
    case 14: return [T.bench_top, T.planks, T.bench_side];
    case 15: return [T.furnace_side, T.furnace_side, T.furnace_side, meta & 1 ? T.furnace_lit : T.furnace_front];
    case 16: return [T.torch, T.torch, T.torch];
    case 17: return [T.farmland, T.dirt, T.dirt];
    case 18: { const t = T[`wheat${Math.min(3, meta >> 1)}`]; return [t, t, t]; }
    case 19: { const t = T[`carrot${Math.min(3, meta >> 1)}`]; return [t, t, t]; }
    case 20: return [T.sapling, T.sapling, T.sapling];
    case 21: return [T.cable, T.cable, T.cable];
    case 22: return [T.core, T.core, T.core];
    case 23: return [T.lever, T.lever, T.lever];
    case 24: return [T.button, T.button, T.button];
    case 25: return meta & 1 ? [T.lamp_on, T.lamp_on, T.lamp_on] : [T.lamp_off, T.lamp_off, T.lamp_off];
    case 26: return [meta & 1 ? T.inverter_top_on : T.inverter_top, T.inverter_side, T.inverter_side];
    case 27: return [T.door, T.door, T.door];
    case 28: return [T.bedrock, T.bedrock, T.bedrock];
    case 29: return [T.tallgrass, T.tallgrass, T.tallgrass];
    case 30: return [T.flower, T.flower, T.flower];
    case 31: return [T.bricks, T.bricks, T.bricks];
    case 32: return [T.snow, T.dirt, T.snowy_side];
    case 33: return [T.snow, T.snow, T.snow];
    case 34: return [T.ice, T.ice, T.ice];
    case 35: return [T.sandstone_top, T.sandstone_top, T.sandstone_side];
    case 36: return [T.cactus_top, T.cactus_top, T.cactus_side];
    case 37: return [T.deadbush, T.deadbush, T.deadbush];
    case 38: return [T.log_top, T.log_top, T.pine_side];
    case 39: return [T.pine_leaves, T.pine_leaves, T.pine_leaves];
    case 40: return [T.birch_top, T.birch_top, T.birch_side];
    case 41: return [T.birch_leaves, T.birch_leaves, T.birch_leaves];
    case 42: return [T.gold_ore, T.gold_ore, T.gold_ore];
    case 43: return [T.azurite_ore, T.azurite_ore, T.azurite_ore];
    case 44: return [T.lava, T.lava, T.lava];
    case 45: return [T.chest_top, T.chest_top, T.chest_side, T.chest_front];
    case 46: return [T.bed_top, T.planks, T.bed_side];
    case 47: return [T.ladder, T.ladder, T.ladder];
    case 48: return [T.wool, T.wool, T.wool];
    case 49: return [T.stonebricks, T.stonebricks, T.stonebricks];
    case 50: return [T.pumpkin_top, T.pumpkin_top, T.pumpkin_side, T.pumpkin_face];
    case 51: return [T.pumpkin_top, T.pumpkin_top, T.pumpkin_side, T.lantern_face];
    case 52: return [T.gold_block, T.gold_block, T.gold_block];
    case 53: return [T.azurite_block, T.azurite_block, T.azurite_block];
    default: return [T.stone, T.stone, T.stone];
  }
}

export function buildAtlas() {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * 16; cv.height = ATLAS_ROWS * 16;
  const g = cv.getContext("2d");
  DEFS.forEach((fn, i) => {
    const img = g.createImageData(16, 16);
    fn(painter(img, i * 7919 + 13));
    g.putImageData(img, (i % ATLAS_COLS) * 16, Math.floor(i / ATLAS_COLS) * 16);
  });
  return cv;
}

// ---------- Ícones ----------
const ICON_TILE = { 16: "torch", 18: "wheat3", 19: "carrot3", 20: "sapling", 23: "lever", 24: "button", 27: "door", 29: "tallgrass", 30: "flower", 37: "deadbush", 47: "ladder" };
const ISO = new Set(["cube", "chest", "cactus", "bed"]);
const iconCache = new Map();
/** URL (data:) do ícone do item ou bloco. Blocos cúbicos aparecem em perspectiva. */
export function iconURL(id, atlas) {
  if (iconCache.has(id)) return iconCache.get(id);
  const cv = document.createElement("canvas"); cv.width = cv.height = 32;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  if (id >= 100) {
    const c16 = document.createElement("canvas"); c16.width = c16.height = 16;
    const gg = c16.getContext("2d"), img = gg.createImageData(16, 16);
    if (!drawItemSprite(img, id, ITEM[id])) { const p = painter(img, id); p.rect(4, 4, 11, 11, "#ff3fd8"); }
    gg.putImageData(img, 0, 0);
    g.drawImage(c16, 0, 0, 32, 32);
  } else {
    const tileXY = t => [(t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16];
    if (ICON_TILE[id] || !ISO.has(BLOCKS[id].shape)) {
      const [x, y] = tileXY(T[ICON_TILE[id]] ?? faceTiles(id, 0)[2]); g.drawImage(atlas, x, y, 16, 16, 0, 0, 32, 32);
    } else {
      const [top, , side, front] = faceTiles(id, 0);
      const draw = (t, m, shade) => { g.save(); g.setTransform(...m); const [x, y] = tileXY(t); g.drawImage(atlas, x, y, 16, 16, 0, 0, 16, 16); g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(0, 0, 16, 16); g.restore(); };
      draw(top, [0.866, 0.5, -0.866, 0.5, 16, 1], 0);
      draw(side, [0.866, 0.5, 0, 1, 2.1, 9], 0.25);
      draw(front ?? side, [0.866, -0.5, 0, 1, 16, 17], 0.42);
    }
  }
  const url = cv.toDataURL(); iconCache.set(id, url); return url;
}
