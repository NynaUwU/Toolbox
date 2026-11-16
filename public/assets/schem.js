// Desenho de esquemas elétricos em SVG (strings). Cada componente é desenhado na horizontal
// entre (0,0) e (D,0) e depois girado/posicionado entre os dois pontos pedidos.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const wire = (...pts) => `<polyline class="w" points="${pts.map(p => p.join(",")).join(" ")}"/>`;
export const dot = (x, y) => `<circle class="node" cx="${x}" cy="${y}" r="3.2"/>`;
export const text = (x, y, s, { a = "middle", cls = "t" } = {}) => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${a}">${esc(s)}</text>`;
export const val = (x, y, s, a = "middle") => text(x, y, s, { a, cls: "v" });

function place(x1, y1, x2, y2, len, body) {
  const D = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const a = (D - len) / 2, b = (D + len) / 2;
  return `<g transform="translate(${x1} ${y1}) rotate(${ang})"><line class="w" x1="0" y1="0" x2="${a}" y2="0"/><line class="w" x1="${b}" y1="0" x2="${D}" y2="0"/>${body(a, b, (a + b) / 2)}</g>`;
}

/** Rótulo ao lado do componente: acima (horizontal) ou à direita (vertical). side=-1 inverte. */
export function label(x1, y1, x2, y2, name, value, side = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, horiz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  if (horiz) {
    const y = side > 0 ? my - 16 : my + 26;
    return text(mx, y - (value ? 13 : 0), name) + (value ? val(mx, y, value) : "");
  }
  const x = side > 0 ? mx + 18 : mx - 18, a = side > 0 ? "start" : "end";
  return text(x, my - 3, name, { a }) + (value ? val(x, my + 12, value, a) : "");
}

export const resistor = (x1, y1, x2, y2) => place(x1, y1, x2, y2, 44, a => {
  let d = `M${a} 0`;
  for (let i = 0; i < 6; i++) d += ` L${a + 3.67 + i * 7.33} ${i % 2 ? 7 : -7}`;
  return `<path class="w" d="${d} L${a + 44} 0"/>`;
});

export const capacitor = (x1, y1, x2, y2) => place(x1, y1, x2, y2, 10, (a, b) =>
  `<line class="w" x1="${a}" y1="-13" x2="${a}" y2="13" style="stroke-width:2.6"/><line class="w" x1="${b}" y1="-13" x2="${b}" y2="13" style="stroke-width:2.6"/>`);

export const inductor = (x1, y1, x2, y2) => place(x1, y1, x2, y2, 48, a =>
  `<path class="w" d="M${a} 0 ${Array.from({ length: 4 }, () => "a6 6 0 0 1 12 0").join(" ")}"/>`);

export const diode = (x1, y1, x2, y2, led = false) => place(x1, y1, x2, y2, 18, (a, b) =>
  `<path class="w sym" d="M${a} -9 L${a} 9 L${b} 0 Z"/><line class="w" x1="${b}" y1="-9" x2="${b}" y2="9"/>` +
  (led ? [0, 7].map(o => `<path class="w" d="M${a + 4 + o} -11 l7 -9 m-4 0 l4 0 l0 4"/>`).join("") : ""));

/** Fonte CC: o primeiro ponto é o polo +. */
export const battery = (x1, y1, x2, y2) => place(x1, y1, x2, y2, 10, (a, b) =>
  `<line class="w" x1="${a}" y1="-14" x2="${a}" y2="14"/><line class="w" x1="${b}" y1="-7" x2="${b}" y2="7" style="stroke-width:4"/>` +
  `<text class="t" x="${a - 7}" y="-14" text-anchor="middle">+</text>`);

export const ground = (x, y) =>
  `<line class="w" x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}"/><line class="w" x1="${x - 11}" y1="${y + 8}" x2="${x + 11}" y2="${y + 8}"/>` +
  `<line class="w" x1="${x - 7}" y1="${y + 12}" x2="${x + 7}" y2="${y + 12}"/><line class="w" x1="${x - 3}" y1="${y + 16}" x2="${x + 3}" y2="${y + 16}"/>`;

export const terminal = (x, y, name, a = "start") =>
  `<circle class="term" cx="${x}" cy="${y}" r="4"/>` + text(x + (a === "start" ? 9 : a === "end" ? -9 : 0), y + (a === "middle" ? -9 : 4), name, { a });

/** Seta de corrente ao longo de um fio horizontal. */
export const arrow = (x, y, s, dir = 1) =>
  `<path class="arr" d="M${x - 12 * dir} ${y} L${x + 8 * dir} ${y} M${x + 2 * dir} ${y - 5} L${x + 8 * dir} ${y} L${x + 2 * dir} ${y + 5}"/>` + val(x, y - 8, s);

/** Onda quadrada com ciclo ativo `duty` (0..1). */
export function square(x, y, w, h, duty, periods = 3) {
  const p = w / periods, hi = p * duty;
  let d = `M${x} ${y + h}`;
  for (let i = 0; i < periods; i++) d += ` L${x + i * p} ${y} L${x + i * p + hi} ${y} L${x + i * p + hi} ${y + h} L${x + (i + 1) * p} ${y + h}`;
  return `<path class="wave" d="${d}"/>`;
}

/** Curva exponencial de carga (k=1) ou descarga (k=0) em 5τ. */
export function expCurve(x, y, w, h, charge = true) {
  const pts = Array.from({ length: 51 }, (_, i) => { const t = i / 10, v = charge ? 1 - Math.exp(-t) : Math.exp(-t); return `${x + i / 50 * w},${y + h - v * h}`; });
  return `<polyline class="wave" points="${pts.join(" ")}"/>` +
    [1, 2, 3, 4, 5].map(n => `<line class="grid" x1="${x + n / 5 * w}" y1="${y}" x2="${x + n / 5 * w}" y2="${y + h}"/>` + text(x + n / 5 * w, y + h + 13, `${n}τ`)).join("") +
    `<line class="axis" x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}"/><line class="axis" x1="${x}" y1="${y}" x2="${x}" y2="${y + h}"/>`;
}

/** Toroide com N espiras desenhadas (até 28 visíveis). */
export function toroid(cx, cy, n) {
  const R = 46, r = 26, shown = Math.min(n, 28);
  let s = `<circle class="core" cx="${cx}" cy="${cy}" r="${R}"/><circle class="w" cx="${cx}" cy="${cy}" r="${r}" style="fill:#fff"/>`;
  for (let i = 0; i < shown; i++) {
    const t = (i / shown) * 2 * Math.PI - Math.PI / 2 + 0.25;
    const x1 = cx + Math.cos(t) * (r - 4), y1 = cy + Math.sin(t) * (r - 4), x2 = cx + Math.cos(t + 0.08) * (R + 4), y2 = cy + Math.sin(t + 0.08) * (R + 4);
    s += `<line class="coil" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return s;
}

/** Solenoide (bobina de ar) com cotas de diâmetro e comprimento. */
export function solenoid(x, y, len, dia, n) {
  const shown = Math.max(3, Math.min(n, 24)), step = len / shown;
  let s = `<rect class="former" x="${x}" y="${y}" width="${len}" height="${dia}"/>`;
  for (let i = 0; i < shown; i++) s += `<ellipse class="coil" cx="${x + step * (i + 0.5)}" cy="${y + dia / 2}" rx="${Math.max(2, step / 2 - 1)}" ry="${dia / 2 + 2}"/>`;
  s += `<path class="dim" d="M${x} ${y + dia + 16} L${x + len} ${y + dia + 16} M${x} ${y + dia + 10} v12 M${x + len} ${y + dia + 10} v12"/>`;
  s += `<path class="dim" d="M${x - 14} ${y} L${x - 14} ${y + dia} M${x - 20} ${y} h12 M${x - 20} ${y + dia} h12"/>`;
  return s;
}

/** Monta o <svg> final com as classes de estilo. */
export const svg = (w, h, body) => `<svg class="schem-svg" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;
