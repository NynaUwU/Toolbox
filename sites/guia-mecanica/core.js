// MechLab — núcleo: navegação, montagem das páginas, laço de animação e biblioteca de desenho técnico (canvas 2D).
"use strict";
const TAU = Math.PI * 2, W = 900;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const nf = (x, d = 1) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

// Cores do desenho técnico
const C = {
  ink: "#111", line: "#2b2b2b", muted: "#666", grid: "#e6e6e6", paper: "#fff",
  steel: "#a9b2bc", steelL: "#dde2e7", steelD: "#5c6670", dark: "#3a3f45",
  red: "#c62828", blue: "#1c5fd0", green: "#178a2e", orange: "#e0640a", yellow: "#f2c200", purple: "#7a3ab8",
  water: "#3a8ee8", waterL: "#a8d0f8", oil: "#d8920e", oilL: "#f6d48a", air: "#8ac8f0", airL: "#d6eefc",
  wood: "#c08a4e", woodD: "#8a5a2a", rubber: "#2a2a2a", accent: "#000080", hot: "#ff5a1a",
};

// ======================= Biblioteca de desenho =======================
const D = {
  line(g, x1, y1, x2, y2, c = C.line, w = 1.6, dash) { g.save(); g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore(); },
  path(g, pts, c = C.line, w = 1.6, close = false, fill) {
    g.save(); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (close) g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (c) { g.strokeStyle = c; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); } g.restore();
  },
  rect(g, x, y, w, h, fill, stroke = C.line, lw = 1.6) { g.save(); if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x, y, w, h); } g.restore(); },
  circle(g, x, y, r, fill, stroke = C.line, lw = 1.6) { g.save(); g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } g.restore(); },
  text(g, s, x, y, o = {}) {
    g.save(); g.font = `${o.bold ? "bold " : ""}${o.size || 13}px Tahoma, Verdana, sans-serif`; g.textAlign = o.align || "left"; g.textBaseline = o.base || "alphabetic";
    if (o.bg) { const w = g.measureText(s).width, h = (o.size || 13) + 4, ax = o.align === "center" ? w / 2 : o.align === "right" ? w : 0; g.fillStyle = o.bg; g.fillRect(x - ax - 3, y - h + 3, w + 6, h); g.strokeStyle = "#000"; g.lineWidth = 1; g.strokeRect(x - ax - 3, y - h + 3, w + 6, h); }
    g.fillStyle = o.color || C.ink; g.fillText(s, x, y); g.restore();
  },
  label(g, s, x, y, o = {}) { D.text(g, s, x, y, { bg: "#ffffe1", size: 12, ...o }); },
  arrow(g, x1, y1, x2, y2, c = C.red, w = 2.5, head = 10) {
    const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1); if (len < 1) return;
    g.save(); g.strokeStyle = g.fillStyle = c; g.lineWidth = w; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8); g.stroke();
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - Math.cos(a - 0.4) * head, y2 - Math.sin(a - 0.4) * head); g.lineTo(x2 - Math.cos(a + 0.4) * head, y2 - Math.sin(a + 0.4) * head); g.closePath(); g.fill(); g.restore();
  },
  /** Seta curva indicando rotação (dir = +1 horário, -1 anti-horário). */
  rot(g, x, y, r, dir = 1, c = C.blue, a0 = -2.2) {
    const a1 = a0 + 1.6 * dir; g.save(); g.strokeStyle = g.fillStyle = c; g.lineWidth = 2.2;
    g.beginPath(); g.arc(x, y, r, a0, a1, dir < 0); g.stroke();
    const ex = x + Math.cos(a1) * r, ey = y + Math.sin(a1) * r, t = a1 + dir * Math.PI / 2;
    g.beginPath(); g.moveTo(ex + Math.cos(t) * 8, ey + Math.sin(t) * 8); g.lineTo(ex + Math.cos(t + 2.4) * 7, ey + Math.sin(t + 2.4) * 7); g.lineTo(ex + Math.cos(t - 2.4) * 7, ey + Math.sin(t - 2.4) * 7); g.closePath(); g.fill(); g.restore();
  },
  /** Chão hachurado. */
  ground(g, x, y, w, c = C.line) { D.line(g, x, y, x + w, y, c, 2); g.save(); g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); for (let i = x; i < x + w; i += 10) { g.moveTo(i, y); g.lineTo(i - 8, y + 9); } g.stroke(); g.restore(); },
  /** Hachura de corte (peça cortada no desenho técnico). */
  hatch(g, x, y, w, h, fill = C.steelL, c = "#888", gap = 7) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.fillStyle = fill; g.fill(); g.clip(); g.strokeStyle = c; g.lineWidth = 1;
    g.beginPath(); for (let i = -h; i < w; i += gap) { g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); } g.stroke(); g.restore();
    D.rect(g, x, y, w, h, null, C.line, 1.4);
  },
  /** Mola helicoidal entre dois pontos. */
  spring(g, x1, y1, x2, y2, coils = 8, width = 14, c = C.dark, w = 2) {
    const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    g.save(); g.translate(x1, y1); g.rotate(a); g.strokeStyle = c; g.lineWidth = w; g.lineJoin = "round"; g.beginPath(); g.moveTo(0, 0);
    const lead = Math.min(8, len * 0.08), n = coils * 2;
    g.lineTo(lead, 0); for (let i = 0; i < n; i++) g.lineTo(lead + (len - 2 * lead) * (i + 0.5) / n, (i % 2 ? -1 : 1) * width / 2); g.lineTo(len - lead, 0); g.lineTo(len, 0);
    g.stroke(); g.restore();
  },
  /** Amortecedor (pistão em cilindro) entre dois pontos; o cilindro fica no ponto 1. */
  damper(g, x1, y1, x2, y2, body = 60, wd = 16) {
    const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    g.save(); g.translate(x1, y1); g.rotate(a);
    D.rect(g, 0, -wd / 2, Math.min(body, len), wd, C.steelL, C.line, 1.6);
    const px = clamp(len - body * 0.5, 10, body - 6);
    D.rect(g, px - 3, -wd / 2 + 2, 6, wd - 4, C.dark, null);
    D.line(g, px, 0, len, 0, C.steelD, 4);
    g.restore();
  },
  /** Engrenagem de dentes retos. r = raio primitivo, n = dentes, a = ângulo. */
  gear(g, x, y, r, n, a, fill = C.steel, o = {}) {
    const m = 2 * r / n, ra = r + m * 0.9, rr = r - m * 1.15, p = TAU / n;
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath();
    for (let i = 0; i < n; i++) {
      const c = i * p;
      const pts = [[rr, c - p * 0.32], [r * 0.99, c - p * 0.25], [ra, c - p * 0.13], [ra, c + p * 0.13], [r * 0.99, c + p * 0.25], [rr, c + p * 0.32], [rr, c + p * 0.68]];
      pts.forEach(([rad, ang], j) => { const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad; i === 0 && j === 0 ? g.moveTo(px, py) : g.lineTo(px, py); });
    }
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.3; g.lineJoin = "round"; g.stroke();
    if (o.spokes !== false && r > 30) {
      g.fillStyle = "rgba(0,0,0,.12)";
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, rr * 0.72, i * TAU / 4 + 0.25, i * TAU / 4 + TAU / 4 - 0.25); g.arc(0, 0, rr * 0.38, i * TAU / 4 + TAU / 4 - 0.35, i * TAU / 4 + 0.35, true); g.closePath(); g.fill(); }
    }
    D.circle(g, 0, 0, Math.max(4, r * 0.14), "#fff", C.line, 1.3);
    if (o.mark !== false) D.line(g, Math.max(6, r * 0.16), 0, rr * 0.85, 0, o.markColor || C.red, 2.5);
    g.restore();
  },
  /** Coroa de dentes internos (anel). r = raio primitivo. */
  ringGear(g, x, y, r, n, a, fill = C.steelL) {
    const m = 2 * r / n, ri = r - m * 0.9, rr = r + m * 1.15, ro = rr + m * 2.2, p = TAU / n;
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.arc(0, 0, ro, 0, TAU);
    for (let i = 0; i < n; i++) {
      const c = i * p + p / 2;
      const pts = [[rr, c - p * 0.32], [r, c - p * 0.25], [ri, c - p * 0.13], [ri, c + p * 0.13], [r, c + p * 0.25], [rr, c + p * 0.32], [rr, c + p * 0.68]];
      pts.forEach(([rad, ang], j) => { const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad; j === 0 && i === 0 ? g.moveTo(px, py) : g.lineTo(px, py); });
    }
    g.closePath(); g.fillStyle = fill; g.fill("evenodd"); g.strokeStyle = C.line; g.lineWidth = 1.3; g.stroke(); g.restore();
  },
  /** Cremalheira com dentes para cima (linha primitiva em y). p = passo, shift = deslocamento. */
  rack(g, x0, x1, y, p, shift, fill = C.steel, m) {
    m ||= p / Math.PI; const tip = y - m * 0.9, root = y + m * 1.15;
    g.save(); g.beginPath(); g.rect(x0, tip - 2, x1 - x0, root + 18 - tip); g.clip();
    g.beginPath(); g.moveTo(x0 - p * 2, root + 14); g.lineTo(x0 - p * 2, root);
    for (let k = Math.floor((x0 - shift) / p) - 2; ; k++) { const c = shift + (k + 0.5) * p; if (c - p > x1 + p) break; g.lineTo(c - p * 0.32, root); g.lineTo(c - p * 0.13, tip); g.lineTo(c + p * 0.13, tip); g.lineTo(c + p * 0.32, root); }
    g.lineTo(x1 + p * 2, root); g.lineTo(x1 + p * 2, root + 14); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.3; g.stroke(); g.restore();
  },
  /** Ângulo da engrenagem 2 que engrena com a 1 (2 está na direção phi a partir da 1). */
  mesh(a1, n1, n2, phi = 0) { return phi + Math.PI + Math.PI / n2 - (a1 - phi) * n1 / n2; },
  /** Polia (com marca para ver o giro). */
  pulley(g, x, y, r, a, fill = C.steelL) {
    D.circle(g, x, y, r, fill, C.line, 1.6); D.circle(g, x, y, r - 5, null, C.muted, 1);
    D.circle(g, x, y, Math.max(3, r * 0.15), "#fff", C.line, 1.2);
    g.save(); g.translate(x, y); g.rotate(a); D.line(g, r * 0.2, 0, r - 7, 0, C.red, 2.5); g.restore();
  },
  /** Correia aberta entre duas polias (tangentes externas). Retorna os 4 pontos de tangência. */
  belt(g, x1, y1, r1, x2, y2, r2, c = C.rubber, w = 5, t = 0, dash) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), base = Math.atan2(dy, dx), b = Math.acos(clamp((r1 - r2) / d, -1, 1));
    const p1 = [x1 + r1 * Math.cos(base + b), y1 + r1 * Math.sin(base + b)], p2 = [x2 + r2 * Math.cos(base + b), y2 + r2 * Math.sin(base + b)];
    const q1 = [x1 + r1 * Math.cos(base - b), y1 + r1 * Math.sin(base - b)], q2 = [x2 + r2 * Math.cos(base - b), y2 + r2 * Math.sin(base - b)];
    g.save(); g.strokeStyle = c; g.lineWidth = w; if (dash) { g.setLineDash(dash); g.lineDashOffset = -t; }
    g.beginPath(); g.moveTo(...q1); g.lineTo(...q2); g.arc(x2, y2, r2, base - b, base + b); g.lineTo(...p1); g.arc(x1, y1, r1, base + b, base - b + TAU); g.closePath(); g.stroke(); g.restore();
  },
  /** Linha de fluxo animada (traços andando) ao longo de uma poligonal. */
  flow(g, pts, c = C.water, w = 4, t = 0, speed = 1, dash = [8, 10]) {
    if (!speed) return; g.save(); g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.setLineDash(dash); g.lineDashOffset = -t * 40 * speed;
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore();
  },
  /** Cano com fluido: retângulo arredondado com cor de enchimento. */
  pipe(g, pts, fill = C.waterL, w = 16) {
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = C.line; g.lineWidth = w + 3; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.stroke(); g.restore();
  },
  /** Manômetro com ponteiro (v de 0 a 1). */
  gauge(g, x, y, r, v, label, c = C.red) {
    D.circle(g, x, y, r, "#fff", C.line, 2);
    g.save(); g.strokeStyle = C.muted; g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + i / 10 * Math.PI * 1.5; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); g.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); g.stroke(); }
    g.restore();
    const a = Math.PI * 0.75 + clamp(v, 0, 1) * Math.PI * 1.5; D.line(g, x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, c, 2.5); D.circle(g, x, y, 3, C.line, null);
    if (label) D.text(g, label, x, y + r + 15, { align: "center", size: 12 });
  },
  /** Gráfico simples: pts = [[x,y],…] em unidades do usuário; o = {xr:[a,b], yr:[a,b], color, title, xl, yl, mark:[x,y]}. */
  plot(g, x, y, w, h, series, o = {}) {
    D.rect(g, x, y, w, h, "#fff", C.line, 1);
    const [x0, x1] = o.xr, [y0, y1] = o.yr, X = v => x + (v - x0) / (x1 - x0) * w, Y = v => y + h - (v - y0) / (y1 - y0) * h;
    g.save(); g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(x, y + h * i / 4); g.lineTo(x + w, y + h * i / 4); g.moveTo(x + w * i / 4, y); g.lineTo(x + w * i / 4, y + h); } g.stroke();
    if (y0 < 0 && y1 > 0) { g.strokeStyle = "#999"; g.beginPath(); g.moveTo(x, Y(0)); g.lineTo(x + w, Y(0)); g.stroke(); }
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (const s of series) { g.strokeStyle = s.color || C.blue; g.lineWidth = s.w || 2; if (s.dash) g.setLineDash(s.dash); else g.setLineDash([]); g.beginPath(); s.pts.forEach(([a, b], i) => i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))); g.stroke(); }
    if (o.mark) { g.fillStyle = C.red; g.beginPath(); g.arc(X(o.mark[0]), Y(o.mark[1]), 4, 0, TAU); g.fill(); }
    if (o.vline != null) { g.strokeStyle = C.red; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(o.vline), y); g.lineTo(X(o.vline), y + h); g.stroke(); }
    g.restore();
    if (o.title) D.text(g, o.title, x + 4, y - 5, { size: 12, bold: true });
    if (o.xl) D.text(g, o.xl, x + w, y + h + 14, { size: 11, align: "right", color: C.muted });
    if (o.yl) D.text(g, o.yl, x + 4, y + 13, { size: 11, color: C.muted });
  },
  /** Pino/articulação (círculo branco com contorno). */
  pin(g, x, y, r = 5) { D.circle(g, x, y, r, "#fff", C.line, 1.6); },
  /** Barra (elo) entre dois pontos. */
  link(g, x1, y1, x2, y2, w = 12, fill = C.steel) {
    const a = Math.atan2(y2 - y1, x2 - x1), l = Math.hypot(x2 - x1, y2 - y1);
    g.save(); g.translate(x1, y1); g.rotate(a); g.beginPath(); g.arc(0, 0, w / 2, Math.PI / 2, Math.PI * 1.5); g.lineTo(l, -w / 2); g.arc(l, 0, w / 2, -Math.PI / 2, Math.PI / 2); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.4; g.stroke(); g.restore();
  },
  /** Suporte fixo (triângulo com hachura) para articulações presas ao chão. */
  anchor(g, x, y, s = 14) { D.path(g, [[x, y], [x - s, y + s * 1.3], [x + s, y + s * 1.3]], C.line, 1.4, true, C.steelL); D.ground(g, x - s - 4, y + s * 1.3, 2 * s + 8); D.pin(g, x, y); },
  /** Roda/pneu. */
  wheel(g, x, y, r, a = 0) {
    D.circle(g, x, y, r, C.rubber, C.line, 1.5); D.circle(g, x, y, r * 0.62, C.steelL, C.line, 1.2);
    g.save(); g.translate(x, y); g.rotate(a); for (let i = 0; i < 5; i++) { const b = i * TAU / 5; D.line(g, Math.cos(b) * r * 0.18, Math.sin(b) * r * 0.18, Math.cos(b) * r * 0.55, Math.sin(b) * r * 0.55, C.steelD, 3); } g.restore();
    D.circle(g, x, y, r * 0.16, C.steelD, C.line, 1);
  },
  /** Peso/carga (caixa com massa). */
  weight(g, x, y, w, h, s = "") { D.rect(g, x - w / 2, y - h, w, h, "#7a7a84", C.line, 1.6); D.rect(g, x - w / 2 + 4, y - h + 4, w - 8, 4, "#9a9aa4", null); if (s) D.text(g, s, x, y - h / 2 + 5, { align: "center", color: "#fff", bold: true, size: 13 }); },
  /** Fundo quadriculado suave. */
  paper(g, h) { g.fillStyle = "#fff"; g.fillRect(0, 0, W, h); g.save(); g.strokeStyle = "#f1f1f1"; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x += 25) { g.moveTo(x, 0); g.lineTo(x, h); } for (let y = 0; y <= h; y += 25) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); g.restore(); },
};

// ======================= Páginas =======================
const MODS = [];
const GROUP_ORDER = ["Início", "Fundamentos", "Transmissão", "Mecanismos e juntas", "Veículos e motores", "Corte e usinagem", "Hidráulica (água)", "Hidráulica (óleo)", "Pneumática", "Rolamentos e materiais"];
/** Registra uma página.
 *  { id, group, title, icon, lead, h, controls:[…], init(s), draw(g,s,dt), info(s) -> {stats:[[a,b]], cap}, explain:[[título, html]], pointer(s,x,y,type) } */
function M(def) { def.set = (k, v) => { def.s[k] = v; def.ctl?.[k]?.(v); def.change?.(def.s, k); }; MODS.push(def); }

const MechLab = (() => {
  let active = null, speed = 1, paused = false, last = 0, infoT = 0;
  const $ = s => document.querySelector(s);

  function control(mod, s, c) {
    if (c.type === "seg") {
      const box = document.createElement("div"); box.className = "seg";
      box.innerHTML = `<span>${c.label || ""}</span><div></div>`;
      for (const [v, lab] of c.options) {
        const b = document.createElement("button"); b.textContent = lab; b.dataset.v = v;
        b.onclick = () => { s[c.k] = typeof c.v === "number" ? +v : v; box.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); mod.change?.(s, c.k); };
        if (String(v) === String(s[c.k])) b.classList.add("on");
        box.lastChild.append(b);
      }
      return box;
    }
    if (c.type === "check") {
      const l = document.createElement("label"); l.className = "chk";
      const i = document.createElement("input"); i.type = "checkbox"; i.checked = !!s[c.k]; i.id = `${mod.id}_${c.k}`;
      i.onchange = () => { s[c.k] = i.checked; mod.change?.(s, c.k); };
      const t = document.createElement("label"); t.htmlFor = i.id; t.textContent = c.label;
      l.append(i, t); return l;
    }
    if (c.type === "hold" || c.type === "btn") {
      const b = document.createElement("button"); b.textContent = c.label;
      if (c.type === "hold") {
        const on = v => { s[c.k] = v; b.classList.toggle("hold", v); };
        b.onpointerdown = e => { e.preventDefault(); on(true); }; b.onpointerup = b.onpointerleave = () => on(false);
      } else b.onclick = () => c.on(s, b);
      return b;
    }
    const box = document.createElement("div"); box.className = "ctrl";
    const lab = document.createElement("label"), val = document.createElement("b");
    lab.append(c.label, val);
    const r = document.createElement("input"); r.type = "range"; r.min = c.min; r.max = c.max; r.step = c.step ?? 1; r.value = s[c.k];
    const upd = () => { s[c.k] = +r.value; val.textContent = c.fmt ? c.fmt(s[c.k], s) : `${nf(s[c.k], c.d ?? 0)}${c.unit ? " " + c.unit : ""}`; };
    r.oninput = () => { upd(); mod.change?.(s, c.k); };
    r.addEventListener("wheel", e => { e.preventDefault(); r.value = +r.value + (e.deltaY < 0 ? 1 : -1) * (+r.step || 1) * (e.shiftKey ? 5 : 1); r.oninput(); }, { passive: false });
    (mod.ctl ||= {})[c.k] = v => { r.value = v; upd(); };
    upd(); box.append(lab, r); return box;
  }

  function buildMod(mod) {
    const sec = document.createElement("section"); sec.className = "mod"; sec.id = mod.id;
    const s = mod.s = { t: 0 };
    for (const c of mod.controls || []) if (c.k) s[c.k] = c.v;
    mod.init?.(s);
    sec.innerHTML = `<h2>${mod.icon || ""} ${mod.title}</h2><p class="lead">${mod.lead || ""}</p>`;
    if (mod.home) { sec.append(mod.home()); return sec; }
    const card = document.createElement("div"); card.className = "card";
    const cv = document.createElement("canvas"); card.append(cv);
    const tools = document.createElement("div"); tools.className = "tools";
    tools.innerHTML = `<button data-sp="pause" title="Pausar a animação">⏸</button><span class="lbl">Velocidade:</span><button data-sp="0.1">🐢 0,1×</button><button data-sp="0.3">0,3×</button><button data-sp="1">1×</button><span class="hint">${mod.hint || ""}</span>`;
    card.append(tools); sec.append(card);
    mod.cv = cv; mod.g = cv.getContext("2d");
    if (mod.controls?.length) { const row = document.createElement("div"); row.className = "row"; for (const c of mod.controls) row.append(control(mod, s, c)); sec.append(row); }
    const st = document.createElement("div"); st.className = "stats"; sec.append(st); mod.statsEl = st;
    const cap = document.createElement("div"); cap.className = "cap"; sec.append(cap); mod.capEl = cap;
    if (mod.explain?.length) {
      const ex = document.createElement("div"); ex.className = "explain";
      ex.innerHTML = mod.explain.map(([t, h]) => `<div><h3>${t}</h3>${h}</div>`).join("");
      sec.append(ex);
    }
    // ponteiro (arrastar no desenho)
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * mod.h]; };
    let down = false;
    cv.addEventListener("pointerdown", e => { if (!mod.pointer) return; down = true; cv.setPointerCapture(e.pointerId); mod.pointer(s, ...pt(e), "down"); });
    cv.addEventListener("pointermove", e => { if (mod.pointer) { mod.pointer(s, ...pt(e), down ? "drag" : "move"); } });
    cv.addEventListener("pointerup", e => { if (mod.pointer && down) { down = false; mod.pointer(s, ...pt(e), "up"); } });
    if (mod.pointer) cv.style.cursor = "grab";
    return sec;
  }

  function size(mod) {
    const cv = mod.cv, dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth || 900;
    mod.h ||= 360;
    cv.style.height = `${cw * mod.h / W}px`;
    const pw = Math.round(cw * dpr), ph = Math.round(cw * mod.h / W * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    mod.g.setTransform(pw / W, 0, 0, pw / W, 0, 0);
  }

  function info(mod) {
    if (!mod.info) return;
    const r = mod.info(mod.s) || {};
    if (r.stats) mod.statsEl.innerHTML = r.stats.map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join("");
    if (r.cap != null && mod.capEl.innerHTML !== r.cap) mod.capEl.innerHTML = r.cap;
    mod.capEl.hidden = !r.cap;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const mod = active; if (!mod || !mod.draw) return;
    const dt = paused ? 0 : real * speed;
    mod.s.t += dt;
    size(mod);
    mod.g.save(); D.paper(mod.g, mod.h); mod.draw(mod.g, mod.s, dt); mod.g.restore();
    infoT -= real; if (infoT <= 0) { infoT = 0.12; info(mod); }
  }

  function show(id) {
    const mod = MODS.find(m => m.id === id) || MODS[0];
    active = mod;
    document.querySelectorAll(".mod").forEach(m => m.classList.toggle("show", m.id === mod.id));
    document.querySelectorAll(".menu [data-go]").forEach(b => b.classList.toggle("on", b.dataset.go === mod.id));
    document.querySelectorAll(".dd").forEach(d => d.querySelector(".ddb").classList.toggle("on", !!d.querySelector(".menu .on")));
    const i = MODS.indexOf(mod), p = MODS[(i + MODS.length - 1) % MODS.length], n = MODS[(i + 1) % MODS.length];
    $("#crumb").textContent = mod.group === "Início" ? `${MODS.length - 1} assuntos` : `${mod.group} › ${mod.title}`;
    $("#pager").innerHTML = `<button data-go="${p.id}">← ${p.title}</button><button data-go="${n.id}">${n.title} →</button>`;
    try { history.replaceState(null, "", "#" + mod.id); } catch {}
    window.scrollTo({ top: 0 });
    if (mod.draw) { size(mod); info(mod); }
    syncSpeed();
  }
  function syncSpeed() {
    document.querySelectorAll("[data-sp]").forEach(b => b.classList.toggle("on", b.dataset.sp === "pause" ? paused : !paused && +b.dataset.sp === speed));
  }

  function start() {
    MODS.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    const main = $("#main"), nav = $("#nav");
    for (const mod of MODS) main.append(buildMod(mod));
    const pager = document.createElement("div"); pager.id = "pager"; main.append(pager);
    for (const grp of GROUP_ORDER) {
      const list = MODS.filter(m => m.group === grp); if (!list.length) continue;
      if (grp === "Início") { nav.insertAdjacentHTML("beforeend", `<button class="ddb" data-go="${list[0].id}">🏠 Início</button>`); continue; }
      nav.insertAdjacentHTML("beforeend", `<div class="dd"><button class="ddb" aria-haspopup="true">${grp} ▾</button><div class="menu">${list.map(m => `<button data-go="${m.id}">${m.icon || ""} ${m.title}</button>`).join("")}</div></div>`);
    }
    document.addEventListener("click", e => {
      const b = e.target.closest(".ddb"), cur = b?.parentNode;
      document.querySelectorAll(".dd.open").forEach(d => { if (d !== cur) d.classList.remove("open"); });
      if (cur?.classList.contains("dd")) { cur.classList.toggle("open"); const m = cur.querySelector(".menu"); m.style.left = "0"; m.style.right = "auto"; if (m.getBoundingClientRect().right > innerWidth - 8) { m.style.left = "auto"; m.style.right = "0"; } }
      const go = e.target.closest("[data-go]"); if (go) { show(go.dataset.go); document.querySelectorAll(".dd.open").forEach(d => d.classList.remove("open")); }
      const sp = e.target.closest("[data-sp]");
      if (sp) { if (sp.dataset.sp === "pause") paused = !paused; else { speed = +sp.dataset.sp; paused = false; } syncSpeed(); }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".dd.open").forEach(d => d.classList.remove("open")); });
    addEventListener("resize", () => active?.draw && size(active));
    show((location.hash || "").slice(1) || MODS[0].id);
    requestAnimationFrame(frame);
  }
  return { start, show, get speed() { return speed; } };
})();

// ======================= Página inicial =======================
M({
  id: "inicio", group: "Início", title: "Início", icon: "🏠",
  lead: "Escolha um assunto. Cada página tem um desenho animado que você controla, números ao vivo e explicações curtas.",
  home() {
    const box = document.createElement("div"); box.className = "home";
    for (const grp of GROUP_ORDER.slice(1)) {
      const list = MODS.filter(m => m.group === grp); if (!list.length) continue;
      box.insertAdjacentHTML("beforeend", `<h3>${grp}</h3><div class="tiles">${list.map(m => `<button class="tile" data-go="${m.id}"><i>${m.icon || "⚙️"}</i><b>${m.title}</b><small>${(m.short || m.lead || "").replace(/<[^>]+>/g, "")}</small></button>`).join("")}</div>`);
    }
    return box;
  },
});
