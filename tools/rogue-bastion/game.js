// Rogue Bastion — tower defense roguelite (canvas 2D). Tudo roda no navegador; só o progresso permanente vai para o servidor.
const $ = id => document.getElementById(id);
const COLS = 26, ROWS = 15, T = 32, CW = COLS * T, CH = ROWS * T;
const cv = $("cv"), ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ======================= Definições =======================
// Armas: stats por tier (1–5). air = acerta voadores. pierce = ignora armadura.
const WEAPONS = {
  gun: { name: "Blaster", key: "1", cost: 50, unlock: 0, air: true, color: "#3a7ad8", desc: "Tiros rápidos. Acerta voadores.",
    tiers: [{ dmg: 6, rate: 2.5, range: 96 }, { dmg: 10, rate: 3, range: 104 }, { dmg: 17, rate: 3.5, range: 112 }, { dmg: 28, rate: 4.2, range: 124 }, { dmg: 46, rate: 5, range: 138 }] },
  cannon: { name: "Cannon", key: "2", cost: 90, unlock: 140, air: false, color: "#5a5a60", desc: "Explosão em área. Só no chão.",
    tiers: [{ dmg: 18, rate: 0.8, range: 100, splash: 36 }, { dmg: 30, rate: 0.9, range: 108, splash: 40 }, { dmg: 52, rate: 1, range: 116, splash: 46 }, { dmg: 88, rate: 1.1, range: 126, splash: 52 }, { dmg: 145, rate: 1.3, range: 138, splash: 60 }] },
  frost: { name: "Frost", key: "3", cost: 70, unlock: 120, air: false, color: "#4ad8f0", desc: "Pulso que deixa os inimigos lentos.",
    tiers: [{ dmg: 2, rate: 1.1, range: 72, slow: 0.35 }, { dmg: 4, rate: 1.2, range: 80, slow: 0.45 }, { dmg: 7, rate: 1.3, range: 88, slow: 0.54 }, { dmg: 12, rate: 1.4, range: 96, slow: 0.62 }, { dmg: 20, rate: 1.6, range: 108, slow: 0.7 }] },
  tesla: { name: "Tesla", key: "4", cost: 120, unlock: 200, air: true, color: "#b05aff", desc: "Raio que pula entre inimigos. Dobro contra escudo.",
    tiers: [{ dmg: 12, rate: 1, range: 88, chain: 3 }, { dmg: 20, rate: 1.1, range: 96, chain: 4 }, { dmg: 33, rate: 1.25, range: 104, chain: 5 }, { dmg: 54, rate: 1.4, range: 114, chain: 6 }, { dmg: 88, rate: 1.6, range: 126, chain: 8 }] },
  sniper: { name: "Sniper", key: "5", cost: 140, unlock: 220, air: true, pierce: true, color: "#6a8a5a", desc: "Longo alcance, ignora armadura.",
    tiers: [{ dmg: 60, rate: 0.45, range: 220 }, { dmg: 110, rate: 0.5, range: 250 }, { dmg: 190, rate: 0.55, range: 280 }, { dmg: 320, rate: 0.62, range: 320 }, { dmg: 540, rate: 0.7, range: 380 }] },
  flamer: { name: "Flamer", key: "6", cost: 110, unlock: 180, air: false, pierce: true, color: "#f07a1a", desc: "Fogo contínuo em cone curto, ignora armadura.",
    tiers: [{ dps: 26, range: 64 }, { dps: 42, range: 68 }, { dps: 68, range: 72 }, { dps: 110, range: 78 }, { dps: 175, range: 86 }] },
  missile: { name: "Missile", key: "7", cost: 180, unlock: 300, air: true, color: "#c83a3a", desc: "Míssil teleguiado com explosão. Chão e ar.",
    tiers: [{ dmg: 40, rate: 0.6, range: 150, splash: 40 }, { dmg: 70, rate: 0.68, range: 162, splash: 44 }, { dmg: 120, rate: 0.76, range: 174, splash: 48 }, { dmg: 200, rate: 0.86, range: 186, splash: 54 }, { dmg: 330, rate: 1, range: 200, splash: 60 }] },
  laser: { name: "Laser", key: "8", cost: 160, unlock: 280, air: true, pierce: true, color: "#ff3a6a", desc: "Feixe que esquenta (até 3×) no mesmo alvo.",
    tiers: [{ dps: 20, range: 110 }, { dps: 34, range: 118 }, { dps: 56, range: 126 }, { dps: 92, range: 136 }, { dps: 150, range: 148 }] },
};
const WKEYS = Object.keys(WEAPONS);
const UP_COST = [0, 0.8, 1.5, 2.6, 4.5]; // custo de subir para o tier N+1 (× custo da torre)
const TIER_PRICE = [0, 0, 90, 180, 320, 560]; // loja: liberar tier N
const ROMAN = ["", "I", "II", "III", "IV", "V"];

// Inimigos. cost = peso no orçamento da wave · from = wave em que aparece
const ENEMY = {
  grunt: { name: "Grunt", hp: 30, speed: 46, reward: 3, armor: 0, r: 7, cost: 1, from: 1, color: "#d84a3a", desc: "comum" },
  scout: { name: "Scout", hp: 18, speed: 88, reward: 2, armor: 0, r: 6, cost: 0.8, from: 2, color: "#f0c83a", desc: "rápido e frágil" },
  swarm: { name: "Swarm", hp: 8, speed: 64, reward: 1, armor: 0, r: 4, cost: 0.3, from: 3, color: "#5ac83a", group: 5, desc: "vem em bando" },
  brute: { name: "Brute", hp: 120, speed: 30, reward: 8, armor: 4, r: 10, cost: 3, from: 4, color: "#5a5a64", desc: "lento e blindado (tira 2 vidas)" },
  flyer: { name: "Flyer", hp: 40, speed: 52, reward: 5, armor: 0, r: 7, cost: 2, from: 5, color: "#e8f0ff", air: true, desc: "voa em linha reta; só armas antiaéreas" },
  shield: { name: "Warden", hp: 60, speed: 44, reward: 6, armor: 0, r: 8, cost: 2.5, from: 7, color: "#8a4ad8", shield: 60, desc: "escudo que se regenera" },
  healer: { name: "Mender", hp: 50, speed: 41, reward: 7, armor: 0, r: 8, cost: 2.5, from: 9, color: "#f07ab8", desc: "cura quem está perto" },
  splitter: { name: "Splitter", hp: 80, speed: 39, reward: 5, armor: 1, r: 9, cost: 2.5, from: 11, color: "#f0902a", desc: "vira 3 Swarms ao morrer" },
  boss: { name: "Overlord", hp: 1500, speed: 23, reward: 80, armor: 6, r: 16, cost: 0, from: 10, color: "#a01830", boss: true, desc: "chefe a cada 10 waves (tira 5 vidas)" },
};
const hpMul = w => Math.pow(1.1, w - 1) * (1 + 0.04 * (w - 1));
const rewardMul = w => 1 + 0.05 * (w - 1);

// Melhorias da run (loja)
const RUN_UPS = {
  dmg: { name: "Overclock", desc: "+10% de dano em todas as armas", base: 110 },
  rate: { name: "Autoloader", desc: "+8% de cadência de tiro", base: 100 },
  range: { name: "Optics", desc: "+8% de alcance", base: 80 },
  coin: { name: "Tax Collector", desc: "+15% no valor das moedas", base: 90 },
  magnet: { name: "Magnet", desc: "+18 px no raio de coleta do mouse", base: 60 },
  interest: { name: "Bank", desc: "+2% de juros sobre o dinheiro no fim da wave", base: 120 },
  lives: { name: "Repair Kit", desc: "+4 vidas", base: 70 },
  cost: { name: "Contractor", desc: "-6% no custo de construir e melhorar", base: 110 },
  crit: { name: "Targeting AI", desc: "+5% de chance de dano dobrado", base: 100 },
};
// Upgrades permanentes (Laboratório). Caros de propósito: o 1º nível ≈ uma run mediana.
const META = {
  startMoney: { name: "Starting Funds", eff: l => `+${40 * l} de dinheiro inicial`, cost: [90, 160, 280, 480, 800] },
  lives: { name: "Reinforced Core", eff: l => `+${3 * l} vidas iniciais`, cost: [100, 180, 310, 520, 860] },
  damage: { name: "Calibration", eff: l => `+${6 * l}% de dano`, cost: [120, 200, 330, 540, 880, 1400, 2200, 3400] },
  magnet: { name: "Magnet Coil", eff: l => `+${14 * l} px no raio de coleta`, cost: [80, 150, 270, 460] },
  coinLife: { name: "Coin Stabilizer", eff: l => `moedas duram +${3 * l} s`, cost: [70, 140, 260] },
  haggle: { name: "Haggler", eff: l => `-${5 * l}% nos preços da loja`, cost: [110, 190, 320, 530, 860] },
  slots: { name: "Wider Market", eff: l => `+${l} oferta(s) na loja`, cost: [220, 480] },
  interest: { name: "Compound Interest", eff: l => `+${l}% de juros por wave`, cost: [90, 170, 300, 500, 820] },
  arsenal: { name: "Field Arsenal", eff: l => l ? `começa com ${["Cannon", "Frost", "Tesla", "Sniper"].slice(0, l).join(", ")}` : "começa só com o Blaster", cost: [150, 300, 550, 900] },
  veteran: { name: "Veteran Crews", eff: l => `armas liberadas começam com +${l} no teto de tier`, cost: [260, 600] },
};

// calibrado com simulações: um jogador mediano chega perto da wave 20 e ganha ~240 ◆ — o 1º nível custa quase isso
for (const u of Object.values(META)) u.cost = u.cost.map(c => Math.round(c * 1.6 / 10) * 10);

// ======================= Save permanente =======================
let meta = { data: 0, lv: {}, best: 0, runs: 0, kills: 0 };
const lv = k => meta.lv[k] || 0;
async function loadMeta() {
  let local = null; try { local = JSON.parse(localStorage.getItem("rb-meta")); } catch {}
  try { const r = await fetch("/api/save/rogue-bastion").then(r => r.json()); if (r.save) { meta = { ...meta, ...r.save }; return; } } catch {}
  if (local) meta = { ...meta, ...local };
}
function saveMeta() {
  try { localStorage.setItem("rb-meta", JSON.stringify(meta)); } catch {}
  fetch("/api/save/rogue-bastion", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ save: meta }) }).catch(() => {});
}

// ======================= Mapa aleatório =======================
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const THEMES = [
  { name: "Meadow", ground: ["#4f8a3a", "#5a9842", "#467c33", "#52903c"], path: ["#b08c5c", "#a07e52", "#bc9a6a"], edge: "#6a5232", deco: ["tree", "tree", "rock", "bush"] },
  { name: "Dunes", ground: ["#d8c07a", "#cfb46c", "#e2cc8a", "#d4ba72"], path: ["#a07a48", "#946e40", "#b08a58"], edge: "#7a5a30", deco: ["cactus", "rock", "cactus", "bones"] },
  { name: "Tundra", ground: ["#e4ecf2", "#d4e0e8", "#eef4f8", "#dae4ec"], path: ["#8a9aa8", "#7a8a98", "#9aaab8"], edge: "#5a6a78", deco: ["pine", "pine", "ice", "rock"] },
  { name: "Ashlands", ground: ["#3e3638", "#4a4042", "#363032", "#423a3c"], path: ["#6e4c3a", "#5e4032", "#7e5844"], edge: "#2a1a14", deco: ["lava", "rock", "rock", "crystal"] },
];
function genPath(rnd) {
  const k = (x, y) => y * COLS + x;
  for (let attempt = 0; attempt < 2000; attempt++) {
    let x = 0, y = 2 + Math.floor(rnd() * (ROWS - 4));
    const path = [[x, y]], on = new Set([k(x, y)]);
    let dir = [1, 0], run = 0, ok = true;
    const can = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > COLS - 1 || ny < 1 || ny > ROWS - 2 || on.has(k(nx, ny))) return false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = k(nx + ax, ny + ay); if (kk !== k(x, y) && on.has(kk)) return false; }
      return true;
    };
    while (x < COLS - 1) {
      let next = null;
      if (run < 2 && can(...dir)) next = dir;
      else {
        const opts = [[[1, 0], 3], [[0, 1], 2.2], [[0, -1], 2.2], [[-1, 0], x > 3 && x < COLS - 4 ? 1.2 : 0]].filter(([d, w]) => w > 0 && can(...d));
        if (!opts.length) { ok = false; break; }
        if (can(...dir) && rnd() < 0.35) next = dir;
        else { let tot = opts.reduce((a, o) => a + o[1], 0), r = rnd() * tot; for (const [d, w] of opts) { r -= w; if (r <= 0) { next = d; break; } } next ||= opts[0][0]; }
      }
      if (next !== dir && (next[0] !== dir[0] || next[1] !== dir[1])) run = 0;
      dir = next; x += dir[0]; y += dir[1]; run++;
      path.push([x, y]); on.add(k(x, y));
      if (path.length > 120) { ok = false; break; }
    }
    if (ok && path.length >= 54) return path;
  }
  return Array.from({ length: COLS }, (_, i) => [i, 7]); // nunca deve acontecer
}
function genMap(seed) {
  const rnd = mulberry(seed), theme = THEMES[Math.floor(rnd() * THEMES.length)];
  const path = genPath(rnd), grid = new Uint8Array(COLS * ROWS), deco = new Map();
  for (const [x, y] of path) grid[y * COLS + x] = 1;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (grid[y * COLS + x] || rnd() > 0.085) continue;
    const near = path.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) <= 1);
    if (near && rnd() < 0.6) continue;
    grid[y * COLS + x] = 2; deco.set(y * COLS + x, theme.deco[Math.floor(rnd() * theme.deco.length)]);
  }
  const pts = path.map(([x, y]) => [x * T + T / 2, y * T + T / 2]);
  pts[0] = [-T / 2, pts[0][1]]; pts.push([CW + T / 2, pts[pts.length - 1][1]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const fly = { a: [pts[0][0], pts[0][1]], b: [pts[pts.length - 1][0], pts[pts.length - 1][1]] };
  fly.len = Math.hypot(fly.b[0] - fly.a[0], fly.b[1] - fly.a[1]);
  const m = { seed, theme, path, grid, deco, pts, cum, total: cum[cum.length - 1], fly };
  m.bg = renderBackground(m, mulberry(seed ^ 0x9e3779b9));
  return m;
}
function posAt(m, d) {
  const { pts, cum } = m; if (d <= 0) return pts[0];
  let lo = 0, hi = cum.length - 1; if (d >= cum[hi]) return pts[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const f = (d - cum[lo]) / (cum[hi] - cum[lo]);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
}

// ---------- Desenho do cenário (pré-renderizado) ----------
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c})`; };
function renderBackground(m, rnd) {
  const c = document.createElement("canvas"); c.width = CW; c.height = CH; const g = c.getContext("2d");
  const th = m.theme, P = 4;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const isPath = m.grid[y * COLS + x] === 1, pal = isPath ? th.path : th.ground;
    for (let py = 0; py < T; py += P) for (let px = 0; px < T; px += P) { g.fillStyle = pal[Math.floor(rnd() * pal.length)]; g.fillRect(x * T + px, y * T + py, P, P); }
  }
  // bordas da estrada
  g.fillStyle = th.edge;
  for (const [x, y] of m.path) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || m.grid[ny * COLS + nx] === 1) continue;
    if (dx === 1) g.fillRect(x * T + T - 2, y * T, 2, T); if (dx === -1) g.fillRect(x * T, y * T, 2, T);
    if (dy === 1) g.fillRect(x * T, y * T + T - 2, T, 2); if (dy === -1) g.fillRect(x * T, y * T, T, 2);
  }
  for (const [i, kind] of m.deco) drawDeco(g, kind, (i % COLS) * T, Math.floor(i / COLS) * T, rnd);
  // grade sutil
  g.fillStyle = "rgba(0,0,0,.06)";
  for (let x = 0; x <= COLS; x++) g.fillRect(x * T, 0, 1, CH);
  for (let y = 0; y <= ROWS; y++) g.fillRect(0, y * T, CW, 1);
  return c;
}
function drawDeco(g, kind, x, y, rnd) {
  const cx = x + 16, cy = y + 16, px = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  if (kind === "tree" || kind === "bush") {
    if (kind === "tree") px(14, 20, 4, 9, "#5a3a1c");
    const r = kind === "tree" ? 11 : 8, oy = kind === "tree" ? 13 : 19;
    g.fillStyle = "#1e4a1a"; g.beginPath(); g.arc(cx, y + oy, r + 1, 0, 7); g.fill();
    g.fillStyle = "#2f7a2a"; g.beginPath(); g.arc(cx, y + oy, r, 0, 7); g.fill();
    g.fillStyle = "#4a9a3a"; g.beginPath(); g.arc(cx - 3, y + oy - 3, r * 0.5, 0, 7); g.fill();
  } else if (kind === "pine") {
    px(14, 23, 4, 6, "#4a3220");
    for (const [w, top] of [[22, 12], [16, 7], [10, 3]]) { g.fillStyle = "#1f4a3a"; g.beginPath(); g.moveTo(cx, y + top - 1); g.lineTo(cx - w / 2 - 1, y + top + 12); g.lineTo(cx + w / 2 + 1, y + top + 12); g.fill(); g.fillStyle = "#2f6a4a"; g.beginPath(); g.moveTo(cx, y + top); g.lineTo(cx - w / 2, y + top + 11); g.lineTo(cx + w / 2, y + top + 11); g.fill(); }
    px(12, 8, 8, 2, "#f2f6fa");
  } else if (kind === "cactus") {
    px(13, 6, 6, 22, "#2a6a20"); px(14, 6, 4, 22, "#3f8a2f"); px(6, 12, 4, 8, "#3f8a2f"); px(6, 18, 8, 3, "#3f8a2f"); px(22, 9, 4, 8, "#3f8a2f"); px(18, 15, 8, 3, "#3f8a2f");
  } else if (kind === "rock") {
    g.fillStyle = "#3a3a40"; g.beginPath(); g.ellipse(cx, cy + 4, 12, 9, 0, 0, 7); g.fill();
    g.fillStyle = "#7a7a84"; g.beginPath(); g.ellipse(cx, cy + 3, 11, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#9a9aa4"; g.beginPath(); g.ellipse(cx - 3, cy, 5, 3, 0, 0, 7); g.fill();
  } else if (kind === "ice") {
    g.fillStyle = "#6ab0d8"; g.beginPath(); g.moveTo(cx, y + 4); g.lineTo(x + 26, cy + 6); g.lineTo(cx, y + 28); g.lineTo(x + 6, cy + 6); g.fill();
    g.fillStyle = "#c8eeff"; g.beginPath(); g.moveTo(cx, y + 6); g.lineTo(x + 22, cy + 4); g.lineTo(cx, cy + 2); g.fill();
  } else if (kind === "bones") {
    px(8, 18, 16, 3, "#f0e8d0"); px(6, 16, 4, 7, "#f0e8d0"); px(22, 16, 4, 7, "#f0e8d0"); px(12, 8, 8, 7, "#f0e8d0"); px(14, 10, 2, 2, "#3a2a1a"); px(17, 10, 2, 2, "#3a2a1a");
  } else if (kind === "lava") {
    g.fillStyle = "#2a1a14"; g.beginPath(); g.ellipse(cx, cy + 2, 13, 10, 0, 0, 7); g.fill();
    g.fillStyle = "#e8501a"; g.beginPath(); g.ellipse(cx, cy + 2, 10, 7, 0, 0, 7); g.fill();
    g.fillStyle = "#ffb030"; g.beginPath(); g.ellipse(cx - 2, cy, 5, 3, 0, 0, 7); g.fill();
  } else if (kind === "crystal") {
    for (const [ox, h, c] of [[-6, 16, "#8a4ad8"], [2, 22, "#b07aff"], [8, 12, "#6a3ab8"]]) { g.fillStyle = c; g.beginPath(); g.moveTo(cx + ox, cy + 12 - h); g.lineTo(cx + ox + 4, cy + 12); g.lineTo(cx + ox - 4, cy + 12); g.fill(); }
  }
}

// ---------- Desenho das torres e inimigos ----------
function bevel(g, x, y, w, h) {
  g.fillStyle = "#c0c0c0"; g.fillRect(x, y, w, h);
  g.fillStyle = "#ffffff"; g.fillRect(x, y, w - 1, 1); g.fillRect(x, y, 1, h - 1);
  g.fillStyle = "#dfdfdf"; g.fillRect(x + 1, y + 1, w - 3, 1); g.fillRect(x + 1, y + 1, 1, h - 3);
  g.fillStyle = "#0a0a0a"; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = "#808080"; g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, h - 2);
}
function drawTower(g, type, level, ang, cx, cy, flash = 0) {
  bevel(g, cx - 14, cy - 14, 28, 28);
  const W = WEAPONS[type];
  g.save(); g.translate(cx, cy);
  if (type === "frost") {
    g.fillStyle = "#1a6a8a"; g.beginPath(); g.moveTo(0, -10); g.lineTo(8, 0); g.lineTo(0, 10); g.lineTo(-8, 0); g.fill();
    g.fillStyle = "#8af0ff"; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 0); g.lineTo(0, 8); g.lineTo(-6, 0); g.fill();
    g.fillStyle = "#e8feff"; g.fillRect(-2, -5, 3, 3);
  } else if (type === "tesla") {
    g.fillStyle = "#2a1a3a"; g.fillRect(-7, -7, 14, 14);
    for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? "#e8c83a" : "#8a4ad8"; g.fillRect(-6 + i, -6 + i * 4, 12 - i * 2, 3); }
    g.fillStyle = flash > 0 ? "#ffffff" : "#d8b0ff"; g.beginPath(); g.arc(0, -8, 3, 0, 7); g.fill();
  } else {
    g.rotate(ang);
    const body = { gun: "#2a4a7a", cannon: "#3a3a40", sniper: "#3a4a32", flamer: "#7a3a10", missile: "#5a1a1a", laser: "#4a0a1a" }[type];
    g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
    g.fillStyle = body; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    g.fillStyle = W.color;
    if (type === "gun") { if (level >= 3) { g.fillRect(4, -5, 11, 3); g.fillRect(4, 2, 11, 3); } else g.fillRect(4, -2, 12, 4); }
    if (type === "cannon") { g.fillStyle = "#1a1a1e"; g.fillRect(3, -4, 13, 8); g.fillStyle = "#7a7a84"; g.fillRect(3, -3, 13, 2); }
    if (type === "sniper") { g.fillStyle = "#1a2a14"; g.fillRect(2, -1.5, 17, 3); g.fillStyle = W.color; g.fillRect(-3, -5, 8, 3); }
    if (type === "flamer") { g.fillStyle = "#2a1a10"; g.fillRect(3, -3, 10, 6); g.fillStyle = flash > 0 ? "#ffe060" : W.color; g.fillRect(12, -2, 3, 4); }
    if (type === "missile") { g.fillStyle = "#2a2a2e"; g.fillRect(-2, -7, 14, 14); g.fillStyle = W.color; g.fillRect(10, -6, 4, 4); g.fillRect(10, 2, 4, 4); }
    if (type === "laser") { g.fillStyle = "#2a2a2e"; g.fillRect(2, -3, 11, 6); g.fillStyle = flash > 0 ? "#ffffff" : W.color; g.fillRect(12, -2, 3, 4); }
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-5, -6, 4, 3);
  }
  g.restore();
  // marcas de tier (quadradinhos azul-marinho)
  for (let i = 0; i < level; i++) { g.fillStyle = "#000080"; g.fillRect(cx - 12 + i * 5, cy + 9, 4, 3); }
}
function drawEnemy(g, e, x, y) {
  const d = ENEMY[e.type], r = d.r * (e.big || 1);
  const outline = () => { g.strokeStyle = "#000"; g.lineWidth = 1.5; g.stroke(); };
  if (d.air) { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + 12, r, r * 0.4, 0, 0, 7); g.fill(); y -= 6; }
  g.fillStyle = e.hitFlash > 0 ? "#ffffff" : d.color;
  g.beginPath();
  if (e.type === "scout") { g.moveTo(x + r, y); g.lineTo(x - r, y - r); g.lineTo(x - r * 0.5, y); g.lineTo(x - r, y + r); g.closePath(); }
  else if (e.type === "brute") g.rect(x - r, y - r, r * 2, r * 2);
  else if (e.type === "splitter") { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
  else if (e.type === "flyer") { g.moveTo(x + r, y); g.lineTo(x - r * 0.4, y - r * 1.4); g.lineTo(x - r * 0.6, y); g.lineTo(x - r * 0.4, y + r * 1.4); g.closePath(); }
  else g.arc(x, y, r, 0, 7);
  g.fill(); outline();
  if (e.type === "brute") { g.fillStyle = "#8a8a94"; g.fillRect(x - r + 2, y - r + 2, r * 2 - 4, 3); }
  if (e.type === "healer") { g.fillStyle = "#fff"; g.fillRect(x - 1.5, y - 5, 3, 10); g.fillRect(x - 5, y - 1.5, 10, 3); }
  if (e.type === "grunt" || e.type === "boss" || e.type === "shield") { g.fillStyle = "#000"; g.fillRect(x + r * 0.2, y - r * 0.35, 2, 2); g.fillRect(x + r * 0.2, y + r * 0.15, 2, 2); }
  if (e.type === "boss") { g.fillStyle = "#f0c830"; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 6 - 4, y - r + 2); g.lineTo(x + i * 6, y - r - 7); g.lineTo(x + i * 6 + 4, y - r + 2); g.fill(); } }
  if (e.shield > 0) { g.strokeStyle = `rgba(90,160,255,${0.4 + 0.6 * e.shield / e.maxShield})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.stroke(); }
  if (e.slowT > 0) { g.fillStyle = "rgba(120,220,255,.45)"; g.beginPath(); g.arc(x, y, r + 1, 0, 7); g.fill(); }
  if (e.hp < e.maxHp || e.boss) { // barra de vida estilo Win98
    const w = Math.max(16, r * 2.4), bx = x - w / 2, by = y - r - (e.boss ? 14 : 8);
    g.fillStyle = "#000"; g.fillRect(bx - 1, by - 1, w + 2, 5);
    g.fillStyle = "#fff"; g.fillRect(bx, by, w, 3);
    g.fillStyle = "#000080"; g.fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 3);
  }
}
const iconCache = {};
function iconOf(kind, id) {
  const k = kind + id; if (iconCache[k]) return iconCache[k];
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
  if (kind === "w") drawTower(g, id, 1, -0.6, 16, 16);
  else if (kind === "e") drawEnemy(g, { type: id, hp: 1, maxHp: 1, shield: 0, maxShield: 1, slowT: 0, hitFlash: 0, big: id === "boss" ? 0.8 : 1.3 }, 16, 18);
  else if (kind === "u") {
    bevel(g, 2, 2, 28, 28); g.font = "16px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText({ dmg: "💥", rate: "⏩", range: "🔭", coin: "💰", magnet: "🧲", interest: "🏦", lives: "❤", cost: "🔧", crit: "🎯" }[id] || "⭐", 16, 17);
  }
  return (iconCache[k] = c.toDataURL());
}

// ======================= Estado da run =======================
let run = null, speed = 1, paused = false, buildType = null, selected = null, hoverCell = null, mouse = null, time = 0;
let shop = { offers: [], rerolls: 0 };
function newRun() {
  const arsenal = ["cannon", "frost", "tesla", "sniper"].slice(0, lv("arsenal"));
  const unlocked = { gun: true }; for (const w of arsenal) unlocked[w] = true;
  const cap = {}; for (const w of WKEYS) cap[w] = 2 + lv("veteran");
  run = {
    map: genMap((Math.random() * 2 ** 31) | 0), wave: 0, lives: 15 + 3 * lv("lives"), money: 150 + 40 * lv("startMoney"),
    towers: [], enemies: [], shots: [], coins: [], fx: [], queue: [], waveActive: false, spawnT: 0,
    unlocked, cap, up: Object.fromEntries(Object.keys(RUN_UPS).map(k => [k, 0])), kills: 0, bosses: 0, leaked: 0, earned: 0, over: false,
  };
  buildType = null; selected = null; shop = { offers: [], rerolls: 0 };
  closeAll(); drawWeapons(); drawSelected(); prepareWave();
  banner(`${run.map.theme.name} — wave 1`);
}
const costMul = () => 1 - 0.06 * run.up.cost;
const buildCost = w => Math.round(WEAPONS[w].cost * costMul());
const upCost = t => Math.round(WEAPONS[t.type].cost * UP_COST[t.level] * costMul());
const magnetR = () => 26 + 14 * lv("magnet") + 18 * run.up.magnet;
const coinLife = () => 9 + 3 * lv("coinLife");
function stats(t) {
  const base = WEAPONS[t.type].tiers[t.level - 1], s = { ...base };
  const dm = (1 + 0.1 * run.up.dmg) * (1 + 0.06 * lv("damage"));
  if (s.dmg) s.dmg *= dm; if (s.dps) s.dps *= dm;
  if (s.rate) s.rate *= 1 + 0.08 * run.up.rate;
  s.range *= 1 + 0.08 * run.up.range;
  return s;
}

// ---------- Waves ----------
function makeWave(w) {
  const list = [];
  let budget = 8 + w * 5 + Math.pow(w, 1.45);
  if (w % 10 === 0) { list.push({ type: "boss", gap: 2.5, big: 1 + (w / 10 - 1) * 0.15 }); budget *= 0.6; }
  const pool = Object.entries(ENEMY).filter(([k, e]) => e.from <= w && k !== "boss");
  const rnd = Math.random;
  while (budget > 0.3) {
    const weights = pool.map(([k]) => (k === "grunt" ? 3 : 1.6));
    let r = rnd() * weights.reduce((a, b) => a + b, 0), pick = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { pick = pool[i]; break; } }
    const [k, e] = pick, n = e.group || (rnd() < 0.5 ? 2 : 3);
    for (let i = 0; i < n && budget > 0.3; i++) { list.push({ type: k, gap: e.group ? 0.18 : 0.55 + rnd() * 0.5 }); budget -= e.cost; }
    list[list.length - 1].gap += 0.8;
  }
  return list;
}
function prepareWave() { run.next = makeWave(run.wave + 1); drawWavePanel(); updateStatus(); }
function startWave() {
  if (!run || run.waveActive || run.over) return;
  closeDlg("dShop");
  run.wave++; run.waveActive = true; run.queue = run.next.slice(); run.spawnT = 1;
  banner(`Wave ${run.wave}${run.wave % 10 === 0 ? " — CHEFE!" : ""}`);
  drawWavePanel(); updateStatus();
}
function spawn(item) {
  const d = ENEMY[item.type], w = run.wave, hp = d.hp * hpMul(w) * (item.big || 1) * (item.big ? 1 + (item.big - 1) * 3 : 1);
  const e = { type: item.type, hp, maxHp: hp, shield: (d.shield || 0) * hpMul(w), maxShield: (d.shield || 0) * hpMul(w) || 1, speed: d.speed * (1 + 0.01 * w),
    armor: d.armor * (1 + 0.05 * w), air: !!d.air, boss: !!d.boss, d: item.d || 0, slow: 0, slowT: 0, lastHit: -9, healT: 1, hitFlash: 0, big: item.big || 1,
    reward: d.reward * rewardMul(w), x: 0, y: 0 };
  placeEnemy(e); run.enemies.push(e); return e;
}
function placeEnemy(e) {
  const m = run.map;
  if (e.air) { const f = Math.min(1, e.d / m.fly.len); e.x = m.fly.a[0] + (m.fly.b[0] - m.fly.a[0]) * f; e.y = m.fly.a[1] + (m.fly.b[1] - m.fly.a[1]) * f; e.prog = f; }
  else { const p = posAt(m, e.d); e.x = p[0]; e.y = p[1]; e.prog = e.d / m.total; }
}

// ---------- Dano, mortes e moedas ----------
function hit(e, dmg, o = {}) {
  if (e.dead) return;
  let d = dmg;
  if (Math.random() < 0.05 * run.up.crit) d *= 2;
  if (!o.pierce && e.armor) d = Math.max(d * 0.25, d - e.armor);
  if (e.shield > 0) { const mult = o.tesla ? 2 : 1, absorbed = Math.min(e.shield, d * mult); e.shield -= absorbed; d -= absorbed / mult; }
  e.hp -= d; e.lastHit = time; e.hitFlash = 0.06;
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; run.kills++;
  if (e.boss) run.bosses++;
  const total = e.reward * (1 + 0.15 * run.up.coin), n = total > 30 ? 5 : total > 8 ? 3 : total > 3 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 20 + Math.random() * 40;
    run.coins.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v: total / n, t: coinLife(), fly: false });
  }
  run.fx.push({ k: "pop", x: e.x, y: e.y, t: 0.3, max: 0.3, r: ENEMY[e.type].r * e.big, c: ENEMY[e.type].color });
  if (e.type === "splitter") for (let i = 0; i < 3; i++) { const s = spawn({ type: "swarm", d: Math.max(0, e.d - i * 8) }); s.air = false; placeEnemy(s); }
}
function collect(c) { if (c.fly) return; c.fly = true; }

// ======================= Simulação =======================
function step(dt) {
  if (!run || run.over) return;
  time += dt;
  // nascimento
  if (run.waveActive && run.queue.length) {
    run.spawnT -= dt;
    while (run.spawnT <= 0 && run.queue.length) { const it = run.queue.shift(); spawn(it); run.spawnT += it.gap; }
  }
  const m = run.map;
  for (const e of run.enemies) {
    if (e.dead) continue;
    e.hitFlash -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    e.d += e.speed * (1 - e.slow) * dt;
    placeEnemy(e);
    if (e.maxShield > 1 && time - e.lastHit > 2) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.25 * dt);
    if (e.type === "healer" && (e.healT -= dt) <= 0) {
      e.healT = 1;
      for (const o of run.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 64) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.06); }
      run.fx.push({ k: "ring", x: e.x, y: e.y, t: 0.4, max: 0.4, r: 64, c: "rgba(240,122,184," });
    }
    if ((e.air ? e.d >= m.fly.len : e.d >= m.total)) {
      e.dead = true; e.leaked = true;
      const loss = e.boss ? 5 : e.type === "brute" ? 2 : 1;
      run.lives -= loss; run.leaked += loss;
      run.fx.push({ k: "flash", t: 0.25, max: 0.25 });
      if (run.lives <= 0) { run.lives = 0; gameOver(); return; }
    }
  }
  // torres
  for (const t of run.towers) towerStep(t, dt);
  // projéteis
  for (const s of run.shots) shotStep(s, dt);
  run.shots = run.shots.filter(s => !s.done);
  run.enemies = run.enemies.filter(e => !e.dead);
  // moedas
  const R = magnetR();
  for (const c of run.coins) {
    if (c.fly) {
      const tx = mouse ? mouse.x : 0, ty = mouse ? mouse.y : 0, dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy);
      if (dist < 8 || !mouse || run.sweep) { c.done = true; run.money += c.v; run.earned += c.v; moneyPop(c.v, c.x, c.y); continue; }
      const sp = Math.max(260, dist * 8); c.x += dx / dist * sp * dt; c.y += dy / dist * sp * dt; continue;
    }
    c.vx *= Math.exp(-dt * 4); c.vy *= Math.exp(-dt * 4); c.x += c.vx * dt; c.y += c.vy * dt;
    c.t -= dt; if (c.t <= 0) { c.done = true; continue; }
    if (mouse && Math.hypot(mouse.x - c.x, mouse.y - c.y) < R) collect(c);
  }
  run.coins = run.coins.filter(c => !c.done);
  for (const f of run.fx) f.t -= dt;
  run.fx = run.fx.filter(f => f.t > 0);
  // fim da wave
  if (run.waveActive && !run.queue.length && !run.enemies.length) endWave();
}
let popAcc = 0, popAt = null;
function moneyPop(v, x, y) { popAcc += v; popAt = [x, y]; }
function flushPops() { if (popAcc >= 1 && popAt) { run.fx.push({ k: "text", x: popAt[0], y: popAt[1] - 8, t: 0.8, max: 0.8, s: `+$${Math.round(popAcc)}`, c: "#ffe060" }); popAcc = 0; } }

function inRange(t, e, range) { return Math.hypot(e.x - (t.x * T + 16), e.y - (t.y * T + 16)) <= range; }
function pickTarget(t, range, air) {
  let best = null, score = -Infinity;
  for (const e of run.enemies) {
    if (e.dead || (e.air && !air) || !inRange(t, e, range)) continue;
    const s = t.mode === "last" ? -e.prog : t.mode === "strong" ? e.hp : t.mode === "close" ? -Math.hypot(e.x - (t.x * T + 16), e.y - (t.y * T + 16)) : e.prog;
    if (s > score) { score = s; best = e; }
  }
  return best;
}
function aim(t, e, dt) { const a = Math.atan2(e.y - (t.y * T + 16), e.x - (t.x * T + 16)); let d = a - t.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); t.ang += d * Math.min(1, dt * 14); }
function towerStep(t, dt) {
  const W = WEAPONS[t.type], s = stats(t), cx = t.x * T + 16, cy = t.y * T + 16;
  t.cd -= dt; t.flash -= dt;
  if (t.type === "frost") {
    if (t.cd > 0) return;
    const hits = run.enemies.filter(e => !e.dead && !e.air && inRange(t, e, s.range));
    if (!hits.length) return;
    t.cd = 1 / s.rate; t.flash = 0.15;
    for (const e of hits) { hit(e, s.dmg); e.slow = Math.max(e.slow, s.slow * (e.boss ? 0.5 : 1)); e.slowT = 1.6; }
    run.fx.push({ k: "ring", x: cx, y: cy, t: 0.35, max: 0.35, r: s.range, c: "rgba(138,240,255," });
    return;
  }
  const target = pickTarget(t, s.range, W.air);
  if (t.type === "laser") {
    if (!target) { t.beam = null; t.ramp = 1; return; }
    aim(t, target, dt);
    t.ramp = t.beam === target ? Math.min(3, (t.ramp || 1) + dt * 0.8) : 1; t.beam = target;
    hit(target, s.dps * t.ramp * dt, { pierce: true }); t.flash = 0.05;
    return;
  }
  if (t.type === "flamer") {
    if (!target) { t.firing = false; return; }
    aim(t, target, dt); t.firing = true; t.flash = 0.05;
    for (const e of run.enemies) {
      if (e.dead || e.air || !inRange(t, e, s.range)) continue;
      let da = Math.atan2(e.y - cy, e.x - cx) - t.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.6) hit(e, s.dps * dt, { pierce: true });
    }
    if (Math.random() < dt * 40) run.fx.push({ k: "flame", x: cx + Math.cos(t.ang) * 14, y: cy + Math.sin(t.ang) * 14, vx: Math.cos(t.ang + (Math.random() - 0.5) * 0.9) * s.range * 2.2, vy: Math.sin(t.ang + (Math.random() - 0.5) * 0.9) * s.range * 2.2, t: 0.4, max: 0.4 });
    return;
  }
  if (!target) return;
  aim(t, target, dt);
  if (t.cd > 0) return;
  t.cd = 1 / s.rate; t.flash = 0.08;
  const mx = cx + Math.cos(t.ang) * 14, my = cy + Math.sin(t.ang) * 14;
  if (t.type === "gun") run.shots.push({ k: "bullet", x: mx, y: my, target, sp: 520, dmg: s.dmg });
  else if (t.type === "cannon") run.shots.push({ k: "shell", x: mx, y: my, tx: target.x, ty: target.y, sp: 300, dmg: s.dmg, splash: s.splash });
  else if (t.type === "missile") run.shots.push({ k: "missile", x: mx, y: my, ang: t.ang, target, sp: 210, dmg: s.dmg, splash: s.splash, life: 4 });
  else if (t.type === "sniper") { hit(target, s.dmg, { pierce: true }); run.fx.push({ k: "line", x: mx, y: my, x2: target.x, y2: target.y, t: 0.12, max: 0.12, c: "#fff6c0", w: 2 }); }
  else if (t.type === "tesla") {
    let cur = target, dmg = s.dmg; const done = new Set(), pts = [[cx, cy - 8]];
    for (let i = 0; i < s.chain && cur; i++) {
      hit(cur, dmg, { tesla: true }); done.add(cur); pts.push([cur.x, cur.y]); dmg *= 0.85;
      let nxt = null, bd = 72; for (const e of run.enemies) if (!e.dead && !done.has(e) && (W.air || !e.air)) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; nxt = e; } }
      cur = nxt;
    }
    run.fx.push({ k: "bolt", pts, t: 0.15, max: 0.15 });
  }
}
function splash(x, y, r, dmg, air) {
  for (const e of run.enemies) if (!e.dead && (air || !e.air) && Math.hypot(e.x - x, e.y - y) <= r + ENEMY[e.type].r) hit(e, dmg);
  run.fx.push({ k: "boom", x, y, t: 0.3, max: 0.3, r });
}
function shotStep(s, dt) {
  if (s.k === "bullet") {
    const e = s.target; if (!e.dead) { s.tx = e.x; s.ty = e.y; }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
    if (d < s.sp * dt + 4) { if (!e.dead) hit(e, s.dmg); s.done = true; return; }
    s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt;
  } else if (s.k === "shell") {
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
    if (d < s.sp * dt + 2) { splash(s.tx, s.ty, s.splash, s.dmg, false); s.done = true; return; }
    s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt;
  } else if (s.k === "missile") {
    s.life -= dt; if (s.life <= 0) { splash(s.x, s.y, s.splash, s.dmg, true); s.done = true; return; }
    if (s.target.dead) s.target = pickTarget({ x: s.x / T - 0.5, y: s.y / T - 0.5, mode: "close" }, 400, true) || s.target;
    const e = s.target;
    if (!e.dead) { const a = Math.atan2(e.y - s.y, e.x - s.x); let da = a - s.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); s.ang += Math.max(-6 * dt, Math.min(6 * dt, da)); }
    s.sp = Math.min(420, s.sp + 300 * dt);
    s.x += Math.cos(s.ang) * s.sp * dt; s.y += Math.sin(s.ang) * s.sp * dt;
    if (Math.random() < dt * 30) run.fx.push({ k: "smoke", x: s.x, y: s.y, t: 0.5, max: 0.5 });
    if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < ENEMY[e.type].r + 4) { splash(s.x, s.y, s.splash, s.dmg, true); s.done = true; }
  }
}
function endWave() {
  run.waveActive = false; run.sweep = true;
  for (const c of run.coins) { run.money += c.v; run.earned += c.v; } run.coins = []; run.sweep = false;
  const bonus = 15 + 3 * run.wave, rate = 0.02 * run.up.interest + 0.01 * lv("interest");
  const interest = Math.min(Math.floor(run.money * rate), 25 + 5 * run.wave);
  run.money += bonus + interest;
  run.lastIncome = { bonus, interest };
  meta.best = Math.max(meta.best, run.wave); saveMetaSoon();
  shop.rerolls = 0; rollOffers();
  prepareWave(); openShop();
}

// ======================= Loja =======================
const haggle = () => 1 - 0.05 * lv("haggle");
function offerPrice(o) {
  let p;
  if (o.kind === "unlock") p = WEAPONS[o.w].unlock;
  else if (o.kind === "tier") p = TIER_PRICE[o.to] * (o.w === "gun" ? 1 : 1.25);
  else p = RUN_UPS[o.key].base * Math.pow(1.45, run.up[o.key]);
  return Math.round(p * haggle() * (1 + 0.02 * run.wave));
}
function rollOffers() {
  const pool = [];
  for (const w of WKEYS) {
    if (!run.unlocked[w]) pool.push({ kind: "unlock", w, weight: 1.4 });
    else if (run.cap[w] < 5) pool.push({ kind: "tier", w, to: run.cap[w] + 1, weight: 1.6 });
  }
  for (const key of Object.keys(RUN_UPS)) if (!(key === "magnet" && run.up.magnet >= 5)) pool.push({ kind: "up", key, weight: 1 });
  const n = 4 + lv("slots"), out = [];
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((a, o) => a + o.weight, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].weight; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  for (const o of out) o.price = offerPrice(o);
  shop.offers = out;
}
const rerollPrice = () => Math.round((15 + 10 * shop.rerolls) * haggle());
function buyOffer(o) {
  if (o.sold || run.money < o.price || run.waveActive) return;
  run.money -= o.price; o.sold = true;
  if (o.kind === "unlock") { run.unlocked[o.w] = true; toast(`${WEAPONS[o.w].name} liberado!`); }
  else if (o.kind === "tier") { run.cap[o.w] = o.to; toast(`${WEAPONS[o.w].name}: tier ${ROMAN[o.to]} liberado.`); }
  else { run.up[o.key]++; if (o.key === "lives") run.lives += 4; toast(`${RUN_UPS[o.key].name} comprado.`); }
  for (const x of shop.offers) if (!x.sold) x.price = offerPrice(x);
  drawShop(); drawWeapons(); drawSelected(); updateStatus();
}
function openShop() { if (!run || run.waveActive || run.over) return; drawShop(); openDlg("dShop"); }
function drawShop() {
  $("shopTitle").textContent = `Loja — depois da wave ${run.wave}`;
  const inc = run.lastIncome;
  $("shopIncome").textContent = inc ? `Bônus da wave: $${inc.bonus}${inc.interest ? ` · Juros: $${inc.interest}` : ""}. Você também pode construir e melhorar torres antes de iniciar a próxima wave.` : "";
  $("cards").replaceChildren(...shop.offers.map(o => {
    const b = document.createElement("button"); b.className = `card ${o.sold ? "sold" : run.money < o.price ? "cant" : ""}`; b.disabled = !!o.sold;
    const head = document.createElement("div"); head.className = "head";
    const im = new Image(); im.src = o.kind === "up" ? iconOf("u", o.key) : iconOf("w", o.w);
    const tt = document.createElement("div");
    const kind = document.createElement("div"); kind.className = "kind"; kind.textContent = o.kind === "unlock" ? "NOVA ARMA" : o.kind === "tier" ? "NOVO TIER" : `MELHORIA${run.up[o.key] ? ` (tem ${run.up[o.key]})` : ""}`;
    const name = document.createElement("b"); name.textContent = o.kind === "unlock" ? WEAPONS[o.w].name : o.kind === "tier" ? `${WEAPONS[o.w].name} ${ROMAN[o.to]}` : RUN_UPS[o.key].name;
    tt.append(kind, name); head.append(im, tt);
    const desc = document.createElement("div"); desc.className = "desc";
    if (o.kind === "unlock") desc.textContent = `${WEAPONS[o.w].desc} Constrói por $${buildCost(o.w)}.`;
    else if (o.kind === "tier") { const a = WEAPONS[o.w].tiers[o.to - 1]; desc.textContent = `Permite melhorar ${WEAPONS[o.w].name} até o tier ${ROMAN[o.to]} (${a.dmg ? `dano ${a.dmg}` : `dano/s ${a.dps}`}, alcance ${a.range}).`; }
    else desc.textContent = RUN_UPS[o.key].desc + ".";
    const pr = document.createElement("div"); pr.className = "price"; pr.textContent = o.sold ? "Comprado" : `$${o.price}`;
    b.append(head, desc, pr);
    b.onclick = () => buyOffer(o);
    return b;
  }));
  $("shopMoney").textContent = `Dinheiro: $${Math.floor(run.money)}`;
  $("btnReroll").textContent = `🎲 Trocar ofertas ($${rerollPrice()})`; $("btnReroll").disabled = run.money < rerollPrice();
  $("btnShopWave").textContent = `▶ Iniciar wave ${run.wave + 1}`;
}
$("btnReroll").onclick = () => { const p = rerollPrice(); if (run.money < p) return; run.money -= p; shop.rerolls++; rollOffers(); drawShop(); updateStatus(); };
$("btnShopWave").onclick = () => startWave();

// ======================= Fim da run e Laboratório =======================
let saveT = null;
function saveMetaSoon() { clearTimeout(saveT); saveT = setTimeout(saveMeta, 500); }
function gameOver(giveUp = false) {
  if (!run || run.over) return;
  run.over = true; run.waveActive = false; run.fx = []; run.shots = [];
  const cleared = Math.max(0, run.wave - 1), waveData = cleared * (cleared + 1) / 2, bossData = 20 * run.bosses, killData = Math.floor(run.kills / 50);
  const total = waveData + bossData + killData;
  meta.data += total; meta.runs++; meta.kills += run.kills; meta.best = Math.max(meta.best, cleared);
  saveMeta();
  $("overWhy").textContent = giveUp ? `Você desistiu na wave ${run.wave}.` : `Caiu na wave ${run.wave} (mapa ${run.map.theme.name}).`;
  const rows = [["Waves completas", cleared], ["Inimigos destruídos", run.kills], ["Chefes derrotados", run.bosses], ["Dinheiro coletado", `$${Math.floor(run.earned)}`],
    ["◆ pelas waves (1+2+…)", waveData], ["◆ pelos chefes (20 cada)", bossData], ["◆ pelas mortes (1 a cada 50)", killData]];
  $("overSum").replaceChildren(...rows.flatMap(([a, b]) => { const s = document.createElement("span"); s.textContent = a; const v = document.createElement("b"); v.textContent = b; return [s, v]; }));
  $("overData").innerHTML = `Você ganhou <b>◆ ${total} Data</b>. Total: <b>◆ ${meta.data}</b>.`;
  closeAll(); openDlg("dOver"); updateStatus();
}
function drawLab() {
  $("labData").innerHTML = `Você tem <b>◆ ${meta.data} Data</b>.`;
  $("labStats").textContent = `Runs: ${meta.runs} · Recorde: wave ${meta.best} · Abates: ${meta.kills}`;
  $("labRows").replaceChildren(...Object.entries(META).map(([k, u]) => {
    const l = lv(k), max = u.cost.length, tr = document.createElement("tr");
    const price = l < max ? u.cost[l] : null;
    const td = (txt, cls) => { const c = document.createElement("td"); c.textContent = txt; if (cls) c.className = cls; return c; };
    const btn = document.createElement("button"); btn.textContent = price == null ? "Máximo" : "Comprar"; btn.disabled = price == null || meta.data < price;
    btn.onclick = () => { if (price == null || meta.data < price) return; meta.data -= price; meta.lv[k] = l + 1; saveMeta(); drawLab(); updateStatus(); };
    const b = document.createElement("td"); b.append(btn);
    tr.append(td(u.name), td("■".repeat(l) + "□".repeat(max - l), "lv"), td(`${u.eff(l)}${l < max ? ` → ${u.eff(l + 1)}` : ""}`), td(price == null ? "—" : `◆ ${price}`), b);
    return tr;
  }));
}

// ======================= Interface =======================
let toastT = null, bannerT = null;
function toast(t) { const el = $("toast"); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 2200); }
function banner(t) { const el = $("banner"); el.textContent = t; el.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => el.style.opacity = 0, 1600); }
function openDlg(id) { $(id).hidden = false; if (id === "dLab") drawLab(); }
function closeDlg(id) { $(id).hidden = true; }
function closeAll() { document.querySelectorAll(".back").forEach(d => d.hidden = true); }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { closeDlg(b.dataset.close); if (!run) openDlg("dTitle"); }));
function drawWeapons() {
  $("weapons").replaceChildren(...WKEYS.map(w => {
    const W = WEAPONS[w], b = document.createElement("button"); b.className = `wbtn ${buildType === w ? "on" : ""}`;
    const ok = run?.unlocked[w];
    b.disabled = !ok; b.title = ok ? `${W.desc} Tecla ${W.key}. Teto de tier: ${ROMAN[run.cap[w]]}` : "Libere na loja";
    const im = new Image(); im.src = iconOf("w", w);
    const s = document.createElement("span"); const n = document.createElement("b"); n.textContent = W.name;
    const c = document.createElement("small"); c.textContent = ok ? `$${buildCost(w)} · até ${ROMAN[run.cap[w]]}` : "🔒 loja";
    s.append(n, c); b.append(im, s);
    b.onclick = () => { buildType = buildType === w ? null : w; selected = null; drawWeapons(); drawSelected(); };
    return b;
  }));
}
let selUp = null;
function drawSelected() {
  const box = $("selInfo"); selUp = null;
  if (!selected || !run?.towers.includes(selected)) { selected = null; box.innerHTML = `<p style="margin:2px 0;color:#808080">Clique numa torre para ver, melhorar ou vender.</p>`; return; }
  const t = selected, W = WEAPONS[t.type], s = stats(t), cap = run.cap[t.type];
  const next = t.level < 5 ? W.tiers[t.level] : null;
  const lines = [["Tier", `${ROMAN[t.level]} / ${ROMAN[cap]} (máx. V)`]];
  if (s.dmg) lines.push(["Dano", `${s.dmg.toFixed(0)}${next ? ` → ${(s.dmg / W.tiers[t.level - 1].dmg * next.dmg).toFixed(0)}` : ""}`]);
  if (s.dps) lines.push(["Dano/s", `${s.dps.toFixed(0)}${next ? ` → ${(s.dps / W.tiers[t.level - 1].dps * next.dps).toFixed(0)}` : ""}`]);
  if (s.rate) lines.push(["Tiros/s", s.rate.toFixed(2)]);
  lines.push(["Alcance", s.range.toFixed(0)]);
  if (s.splash) lines.push(["Explosão", s.splash]); if (s.slow) lines.push(["Lentidão", `${Math.round(s.slow * 100)}%`]); if (s.chain) lines.push(["Saltos", s.chain]);
  lines.push(["Antiaéreo", W.air ? "sim" : "não"]);
  box.innerHTML = "";
  const h = document.createElement("b"); h.textContent = `${W.name} `; const p = document.createElement("span"); p.className = "pips"; p.textContent = "■".repeat(t.level) + "□".repeat(5 - t.level); box.append(h, p);
  const st = document.createElement("div"); st.className = "stats";
  for (const [a, b] of lines) { const x = document.createElement("span"); x.textContent = a; const y = document.createElement("b"); y.textContent = b; st.append(x, y); }
  box.append(st);
  const sel = document.createElement("select"); sel.style.width = "100%";
  for (const [v, n] of [["first", "Alvo: o mais adiantado"], ["last", "Alvo: o mais atrasado"], ["strong", "Alvo: o mais forte"], ["close", "Alvo: o mais perto"]]) { const o = document.createElement("option"); o.value = v; o.textContent = n; o.selected = t.mode === v; sel.append(o); }
  sel.onchange = () => { t.mode = sel.value; };
  if (t.type !== "frost") box.append(sel);
  const row = document.createElement("div"); row.className = "row";
  const up = document.createElement("button");
  if (t.level >= 5) { up.textContent = "Tier máximo"; up.disabled = true; }
  else if (t.level >= cap) { up.textContent = `🔒 Tier ${ROMAN[t.level + 1]} (loja)`; up.disabled = true; }
  else { const c = upCost(t); up.textContent = `⬆ Tier ${ROMAN[t.level + 1]} ($${c})`; up.disabled = run.money < c; up.onclick = () => upgrade(t); selUp = { btn: up, cost: c }; }
  const sell = document.createElement("button"); sell.textContent = `Vender ($${Math.floor(t.spent * 0.6)})`; sell.onclick = () => sellTower(t);
  row.append(up, sell); box.append(row);
}
function upgrade(t) {
  if (!t || t.level >= 5 || t.level >= run.cap[t.type]) return;
  const c = upCost(t); if (run.money < c) return toast("Dinheiro insuficiente.");
  run.money -= c; t.spent += c; t.level++; drawSelected(); updateStatus();
}
function sellTower(t) {
  run.money += Math.floor(t.spent * 0.6); run.towers = run.towers.filter(x => x !== t); selected = null; drawSelected(); updateStatus();
}
function drawWavePanel() {
  if (!run) return;
  const counts = {};
  for (const it of run.next || []) counts[it.type] = (counts[it.type] || 0) + 1;
  $("waveLegend").textContent = run.waveActive ? `Wave ${run.wave} em andamento` : `Próxima: wave ${run.wave + 1}`;
  $("wavePrev").replaceChildren(...Object.entries(counts).map(([k, n]) => { const s = document.createElement("span"); s.title = `${ENEMY[k].name}: ${ENEMY[k].desc}`; const im = new Image(); im.src = iconOf("e", k); s.append(im, `×${n}`); return s; }));
  $("btnWave").textContent = run.waveActive ? `Wave ${run.wave}…` : `▶ Iniciar wave ${run.wave + 1}`;
  $("btnWave").disabled = run.waveActive || run.over;
  $("btnShop").disabled = run.waveActive || run.over || !shop.offers.length;
}
function updateStatus() {
  if (!run) { $("stData").textContent = `◆ ${meta.data} Data`; $("stBest").textContent = `Recorde: wave ${meta.best}`; return; }
  $("stWave").textContent = `Wave ${run.wave}${run.waveActive ? "" : " (preparação)"}`;
  $("stLives").textContent = `♥ ${run.lives} vidas`;
  $("stMoney").textContent = `$ ${Math.floor(run.money)}`;
  $("stEnemies").textContent = `Inimigos: ${run.enemies.length + run.queue.length}`;
  $("stData").textContent = `◆ ${meta.data} Data`;
  $("stBest").textContent = `Recorde: wave ${meta.best}`;
}
$("btnWave").onclick = () => startWave();
$("btnShop").onclick = () => openShop();
document.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => setSpeed(+b.dataset.sp));
$("btnPause").onclick = () => togglePause();
function setSpeed(s) { speed = s; paused = false; refreshSpeed(); }
function togglePause() { paused = !paused; refreshSpeed(); toast(paused ? "Pausado" : "Continuando"); }
function refreshSpeed() {
  document.querySelectorAll("[data-sp]").forEach(b => b.classList.toggle("on", +b.dataset.sp === speed && !paused));
  $("btnPause").classList.toggle("on", paused);
  for (const i of [1, 2, 3]) $(`mS${i}`).classList.toggle("check", speed === i);
}

// ---------- Menus e janela ----------
function closeMenus() { document.querySelectorAll(".dropdown").forEach(d => d.hidden = true); document.querySelectorAll(".menubar .mi").forEach(m => m.classList.remove("open")); }
document.querySelectorAll(".menubar .mi").forEach(mi => {
  const open = () => { closeMenus(); const d = $(mi.dataset.menu); d.hidden = false; d.style.left = `${mi.offsetLeft}px`; mi.classList.add("open"); };
  mi.onmousedown = e => { e.stopPropagation(); mi.classList.contains("open") ? closeMenus() : open(); };
  mi.onmouseenter = () => { if (document.querySelector(".menubar .mi.open")) open(); };
});
document.addEventListener("mousedown", e => { if (!e.target.closest(".dropdown")) closeMenus(); }, true);
function act(a) {
  closeMenus();
  if (a === "new") { if (run && !run.over && !confirm("Começar uma nova run? A atual será perdida sem ganhar Data.")) return; newRun(); }
  else if (a === "newnow") newRun();
  else if (a === "pause") togglePause();
  else if (a === "lab") { closeDlg("dOver"); openDlg("dLab"); }
  else if (a === "giveup") { if (run && !run.over && confirm("Desistir da run? Você ganha o Data das waves completas.")) gameOver(true); }
  else if (a === "close") closeGame();
  else if (a.startsWith("speed")) setSpeed(+a.slice(5));
  else if (a === "help") openDlg("dHelp");
  else if (a === "about") openDlg("dAbout");
}
document.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => act(el.dataset.act)));
$("tbMin").onclick = () => { if (!paused) togglePause(); };
$("tbMax").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else $("app").requestFullscreen?.().catch(() => { try { parent.document.getElementById("btn-max")?.click(); } catch {} }); };
$("tbClose").onclick = () => closeGame();
function closeGame() { try { if (window.top !== window) { window.top.location.hash = "#/"; return; } } catch {} history.back(); }

// ---------- Mouse e teclado no mapa ----------
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * CW, y: (e.clientY - r.top) / r.height * CH }; }
cv.addEventListener("mousemove", e => { mouse = toCanvas(e); hoverCell = [Math.floor(mouse.x / T), Math.floor(mouse.y / T)]; });
cv.addEventListener("mouseleave", () => { mouse = null; hoverCell = null; });
cv.addEventListener("contextmenu", e => { e.preventDefault(); buildType = null; drawWeapons(); });
cv.addEventListener("mousedown", e => {
  if (!run || run.over || e.button !== 0) return;
  const p = toCanvas(e), x = Math.floor(p.x / T), y = Math.floor(p.y / T);
  const tw = run.towers.find(t => t.x === x && t.y === y);
  if (tw) { selected = tw; buildType = null; drawWeapons(); drawSelected(); return; }
  if (buildType) {
    if (!canBuild(x, y)) return toast("Não dá para construir aqui.");
    const c = buildCost(buildType); if (run.money < c) return toast("Dinheiro insuficiente.");
    run.money -= c;
    const t = { type: buildType, x, y, level: 1, cd: 0, ang: -Math.PI / 2, mode: buildType === "sniper" ? "strong" : "first", spent: c, flash: 0 };
    run.towers.push(t); if (!e.shiftKey) { buildType = null; drawWeapons(); } selected = t; drawSelected(); updateStatus();
    return;
  }
  selected = null; drawSelected();
});
const canBuild = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && run.map.grid[y * COLS + x] === 0 && !run.towers.some(t => t.x === x && t.y === y);
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (!run || run.over) return;
  const w = WKEYS.find(k => WEAPONS[k].key === e.key); if (w && run.unlocked[w]) { buildType = buildType === w ? null : w; selected = null; drawWeapons(); drawSelected(); }
  if (e.key === "Escape") { buildType = null; selected = null; drawWeapons(); drawSelected(); }
  if (e.key === "u" || e.key === "U") upgrade(selected);
  if ((e.key === "s" || e.key === "S" || e.key === "Delete") && selected) sellTower(selected);
  if (e.code === "Space") { e.preventDefault(); if (!run.waveActive) startWave(); }
  if (e.key === "p" || e.key === "P") togglePause();
  if (e.key === "f" || e.key === "F") setSpeed(speed % 3 + 1);
});

// ======================= Render =======================
function render() {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH);
  if (!run) return;
  const m = run.map;
  ctx.drawImage(m.bg, 0, 0);
  // portal e núcleo
  const a = m.pts[1], b = m.pts[m.pts.length - 2], pulse = (Math.sin(time * 4) + 1) / 2;
  ctx.fillStyle = `rgba(176,90,255,${0.35 + pulse * 0.3})`; ctx.beginPath(); ctx.arc(a[0] - T, a[1], 14 + pulse * 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a0a4a"; ctx.beginPath(); ctx.arc(a[0] - T, a[1], 8, 0, 7); ctx.fill();
  bevel(ctx, b[0] - 14, b[1] - 14, 28, 28);
  ctx.fillStyle = run.lives > 5 ? "#3ad8ff" : "#ff4a4a"; ctx.beginPath(); ctx.moveTo(b[0], b[1] - 9); ctx.lineTo(b[0] + 7, b[1]); ctx.lineTo(b[0], b[1] + 9); ctx.lineTo(b[0] - 7, b[1]); ctx.fill();
  // fantasma da construção
  if (buildType && hoverCell) {
    const [x, y] = hoverCell, ok = canBuild(x, y), s = stats({ type: buildType, level: 1 });
    ctx.fillStyle = ok ? "rgba(0,255,0,.18)" : "rgba(255,0,0,.25)"; ctx.fillRect(x * T, y * T, T, T);
    ring(x * T + 16, y * T + 16, s.range, ok ? "rgba(255,255,255,.6)" : "rgba(255,80,80,.6)");
    ctx.globalAlpha = 0.6; drawTower(ctx, buildType, 1, -Math.PI / 2, x * T + 16, y * T + 16); ctx.globalAlpha = 1;
  }
  // torres
  for (const t of run.towers) {
    const cx = t.x * T + 16, cy = t.y * T + 16;
    if (t === selected) { ring(cx, cy, stats(t).range, "rgba(255,255,255,.75)"); ctx.strokeStyle = "#ffff00"; ctx.setLineDash([2, 2]); ctx.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2); ctx.setLineDash([]); }
    drawTower(ctx, t.type, t.level, t.ang, cx, cy, t.flash);
    if (t.type === "laser" && t.beam && !t.beam.dead) {
      ctx.strokeStyle = `rgba(255,${80 - (t.ramp - 1) * 30},${120 - (t.ramp - 1) * 50},.9)`; ctx.lineWidth = 1 + t.ramp; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(t.ang) * 14, cy + Math.sin(t.ang) * 14); ctx.lineTo(t.beam.x, t.beam.y - (t.beam.air ? 6 : 0)); ctx.stroke();
    }
  }
  if (hoverCell && !buildType) { const t = run.towers.find(t => t.x === hoverCell[0] && t.y === hoverCell[1]); if (t && t !== selected) ring(t.x * T + 16, t.y * T + 16, stats(t).range, "rgba(255,255,255,.35)"); }
  // inimigos (voadores por cima)
  for (const e of run.enemies) if (!e.air) drawEnemy(ctx, e, e.x, e.y);
  for (const e of run.enemies) if (e.air) drawEnemy(ctx, e, e.x, e.y);
  // projéteis
  for (const s of run.shots) {
    if (s.k === "bullet") { ctx.fillStyle = "#ffe060"; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); }
    else if (s.k === "shell") { ctx.fillStyle = "#1a1a1e"; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill(); }
    else if (s.k === "missile") { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang); ctx.fillStyle = "#e8e8ee"; ctx.fillRect(-5, -2, 10, 4); ctx.fillStyle = "#c83a3a"; ctx.fillRect(3, -2, 3, 4); ctx.fillStyle = "#ffb030"; ctx.fillRect(-8, -1, 3, 2); ctx.restore(); }
  }
  // efeitos
  for (const f of run.fx) {
    const k = f.t / f.max;
    if (f.k === "ring") { ctx.strokeStyle = `${f.c}${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.6), 0, 7); ctx.stroke(); }
    else if (f.k === "boom") { ctx.fillStyle = `rgba(255,${150 + 100 * k},40,${k * 0.7})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.1 - k * 0.5), 0, 7); ctx.fill(); }
    else if (f.k === "pop") { ctx.strokeStyle = f.c; ctx.globalAlpha = k; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (2 - k), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.k === "line") { ctx.strokeStyle = f.c; ctx.globalAlpha = k; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.k === "bolt") {
      ctx.strokeStyle = `rgba(220,190,255,${k})`; ctx.lineWidth = 2; ctx.beginPath();
      f.pts.forEach(([x, y], i) => { if (!i) ctx.moveTo(x, y); else { const [px, py] = f.pts[i - 1]; for (let s = 1; s <= 4; s++) ctx.lineTo(px + (x - px) * s / 4 + (s < 4 ? (Math.random() - 0.5) * 10 : 0), py + (y - py) * s / 4 + (s < 4 ? (Math.random() - 0.5) * 10 : 0)); } });
      ctx.stroke();
    }
    else if (f.k === "flame") { f.x += f.vx * 0.016; f.y += f.vy * 0.016; ctx.fillStyle = `rgba(255,${120 + 120 * k},30,${k})`; ctx.fillRect(f.x - 3, f.y - 3, 6, 6); }
    else if (f.k === "smoke") { ctx.fillStyle = `rgba(200,200,200,${k * 0.5})`; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); }
    else if (f.k === "text") { ctx.font = "bold 12px 'Pixelated MS Sans Serif', Arial"; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText(f.s, f.x + 1, f.y - (1 - k) * 18 + 1); ctx.fillStyle = f.c; ctx.fillText(f.s, f.x, f.y - (1 - k) * 18); }
    else if (f.k === "flash") { ctx.fillStyle = `rgba(255,0,0,${k * 0.35})`; ctx.fillRect(0, 0, CW, CH); }
  }
  // moedas
  for (const c of run.coins) {
    if (!c.fly && c.t < 3 && Math.floor(c.t * 6) % 2) continue; // piscam antes de sumir
    const bob = c.fly ? 0 : Math.sin(time * 6 + c.x) * 1.5, r = c.v >= 10 ? 6 : 5;
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(c.x, c.y + bob, r + 1, 0, 7); ctx.fill();
    ctx.fillStyle = "#f0c830"; ctx.beginPath(); ctx.arc(c.x, c.y + bob, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff6a8"; ctx.fillRect(c.x - 2, c.y + bob - 3, 2, 2);
    ctx.fillStyle = "#a8820a"; ctx.fillRect(c.x - 1, c.y + bob - 1, 2, 4);
  }
  // raio do ímã
  if (mouse && run.coins.length) ring(mouse.x, mouse.y, magnetR(), "rgba(255,230,100,.35)");
  if (paused) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, CW, CH); ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("PAUSADO", CW / 2, CH / 2); }
}
function ring(x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); }

// ---------- Escala do canvas (mantém a proporção, pixels nítidos) ----------
function fit() {
  const f = $("field"), w = f.clientWidth - 4, h = f.clientHeight - 4, s = Math.min(w / CW, h / CH);
  cv.style.width = `${Math.floor(CW * s)}px`; cv.style.height = `${Math.floor(CH * s)}px`;
}
new ResizeObserver(fit).observe($("field"));

// ======================= Laço =======================
let last = performance.now(), acc = 0, uiT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (run && !paused && !run.over) {
    acc += real * speed;
    const h = 1 / 60;
    while (acc >= h) { step(h); acc -= h; }
  } else acc = 0;
  render();
  uiT -= real; if (uiT <= 0) { uiT = 0.2; if (run) { flushPops(); updateStatus(); if (selected) refreshUpButton(); if (!$("dShop").hidden) { $("shopMoney").textContent = `Dinheiro: $${Math.floor(run.money)}`; } } }
}
function refreshUpButton() { if (selUp) selUp.btn.disabled = run.money < selUp.cost; }

// ======================= Início =======================
const logo = iconOf("w", "cannon");
$("titleIco").src = logo; $("logo").src = $("logo2").src = logo;
$("helpEnemies").replaceChildren(...Object.values(ENEMY).flatMap(e => { const b = document.createElement("b"); b.textContent = e.name; const s = document.createElement("span"); s.textContent = `${e.desc}${e.from > 1 ? ` (a partir da wave ${e.from})` : ""}`; return [b, s]; }));
refreshSpeed(); fit(); drawWeapons();
loadMeta().then(() => updateStatus());
requestAnimationFrame(loop);
window.__rb = { get run() { return run; }, get meta() { return meta; }, newRun, startWave, step, WEAPONS, ENEMY, setMouse: p => { mouse = p; } };
