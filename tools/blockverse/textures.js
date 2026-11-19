// BlockVerse — texturas procedurais (16×16 px) num atlas 16×8 e ícones dos itens.
import { BLOCKS, ITEM } from "./shared.mjs";

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
const MAT = { 0: ["#b8884e", "#7d5a30"], 1: ["#9a9ca0", "#5a5c60"], 2: ["#e8e8ee", "#9a9ca8"] };
function drawItem(p, id) {
  p.clear();
  const it = ITEM[id];
  if (it.tool) {
    const [c, d] = MAT[(id % 5)] || MAT[0];
    for (let i = 0; i < 10; i++) p.px(3 + i, 14 - i, p.hex("#7d5a30")), p.px(4 + i, 14 - i, p.hex("#5e4022"));
    if (it.tool === "picareta") { for (let i = 0; i < 12; i++) p.px(3 + i, 2 + Math.abs(i - 6) * 0.45, p.hex(c)); for (let i = 0; i < 12; i++) p.px(3 + i, 3 + Math.abs(i - 6) * 0.45, p.hex(d)); }
    if (it.tool === "machado") { p.rect(6, 1, 11, 6, c); p.rect(6, 6, 9, 7, d); }
    if (it.tool === "pa") { p.rect(10, 1, 14, 5, c); p.rect(11, 5, 13, 6, d); }
    if (it.tool === "espada") { for (let i = 0; i < 10; i++) { p.px(5 + i, 10 - i, p.hex(c)); p.px(6 + i, 10 - i, p.hex(c)); p.px(6 + i, 11 - i, p.hex(d)); } p.rect(2, 10, 6, 11, "#5e4022"); p.rect(4, 8, 5, 13, "#5e4022"); }
    if (it.tool === "enxada") { p.rect(9, 2, 14, 3, c); p.rect(9, 4, 10, 5, d); }
    return;
  }
  switch (id) {
    case 100: for (let i = 0; i < 11; i++) { p.px(3 + i, 13 - i, p.hex("#9a7140")); p.px(4 + i, 13 - i, p.hex("#6e4b2a")); } break;
    case 101: for (let y = 4; y < 13; y++) for (let x = 4; x < 13; x++) if ((x - 8) ** 2 + (y - 8.5) ** 2 < 18 + p.r() * 6) p.px(x, y, [30 + p.r() * 30, 30 + p.r() * 30, 34 + p.r() * 30, 255]); break;
    case 102: p.rect(2, 7, 13, 11, "#d8d8e0", 14); p.rect(3, 6, 12, 6, "#ffffff"); p.rect(2, 11, 13, 11, "#8a8a96"); break;
    case 103: for (let i = 0; i < 40; i++) p.px(3 + p.r() * 10, 6 + p.r() * 8, [63, 200 + p.r() * 55, 255, 255]); break;
    case 104: for (let x = 3; x < 14; x += 3) { p.rect(x, 3, x, 14, "#d9b84a"); p.rect(x - 1, 2, x + 1, 5, "#e8cb5e"); } break;
    case 105: for (let i = 0; i < 9; i++) { const x = 3 + p.r() * 10, y = 5 + p.r() * 8; p.rect(x | 0, y | 0, (x | 0) + 1, y | 0, "#7a9a3a"); } break;
    case 106: for (let i = 0; i < 9; i++) p.rect(4 + i, 12 - i, 6 + i, 13 - i, "#f08a24"); p.rect(11, 1, 14, 4, "#4f9a2f"); break;
    case 107: for (let y = 6; y < 13; y++) for (let x = 2; x < 14; x++) if (((x - 8) / 6) ** 2 + ((y - 9.5) / 3.6) ** 2 < 1) p.px(x, y, p.hex(y < 9 ? "#c88a3a" : "#a86a2a")); break;
    case 108: case 109: { const c = id === 108 ? "#e88a8a" : "#9a5a2a"; for (let y = 4; y < 13; y++) for (let x = 3; x < 13; x++) if ((x - 8) ** 2 / 25 + (y - 8) ** 2 / 14 < 1) p.px(x, y, p.hex(c)); p.rect(11, 11, 14, 12, "#f0e8d8"); break; }
    case 111: for (let y = 5; y < 13; y++) for (let x = 3; x < 13; x++) if ((x - 8) ** 2 + (y - 9) ** 2 < 20) p.px(x, y, [130 + p.r() * 20, 140 + p.r() * 20, 160, 255]); break;
    default: p.rect(4, 4, 11, 11, "#ff3fd8");
  }
}

const ICON_TILE = { 16: "torch", 18: "wheat3", 19: "carrot3", 20: "sapling", 23: "lever", 24: "button", 27: "door", 29: "tallgrass", 30: "flower" };
const iconCache = new Map();
/** URL (data:) do ícone do item ou bloco. Blocos cúbicos aparecem em perspectiva. */
export function iconURL(id, atlas) {
  if (iconCache.has(id)) return iconCache.get(id);
  const cv = document.createElement("canvas"); cv.width = cv.height = 32;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  if (id >= 100) {
    const c16 = document.createElement("canvas"); c16.width = c16.height = 16;
    const gg = c16.getContext("2d"), img = gg.createImageData(16, 16);
    drawItem(painter(img, id * 31), id); gg.putImageData(img, 0, 0);
    g.drawImage(c16, 0, 0, 32, 32);
  } else {
    const tileXY = t => [(t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16];
    if (ICON_TILE[id] || BLOCKS[id].shape !== "cube") {
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
