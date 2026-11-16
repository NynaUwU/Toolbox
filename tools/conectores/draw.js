// Desenhos dos conectores o mais próximo possível do formato real (vista frontal).
// Cada família recebe o conector e devolve { W, H, body } em SVG. Todo contato fica num
// <g class="pin" data-pin="…"> para o clique sincronizar com a tabela.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const KIND = { pwr: ["#d00000", "Alimentação"], gnd: ["#222", "Terra"], data: ["#1060e0", "Dados"], ctl: ["#0a8a0a", "Controle"],
  vid: ["#8a2be2", "Vídeo"], aud: ["#c07000", "Áudio"], sh: ["#888", "Blindagem"], nc: ["#ccc", "Não ligado"] };

// ---------- cores e materiais ----------
const DEFS = `<defs>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eeeeee"/><stop offset=".5" stop-color="#b9b9b9"/><stop offset="1" stop-color="#8c8c8c"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#c9971a"/></linearGradient>
  <linearGradient id="nylon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8ef"/><stop offset="1" stop-color="#ddd6c4"/></linearGradient>
  <radialGradient id="hole"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#333"/></radialGradient>
</defs>`;
const MET = 'fill="url(#metal)" stroke="#555" stroke-width="1.5"';
const BLK = 'fill="#1d1d1d" stroke="#000"';
const pinColor = p => (p[4] && !String(p[4]).startsWith("stripe:") ? p[4] : KIND[p[3]]?.[0] || "#999");
const ink = hex => {
  const h = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join("") : hex.slice(1);
  const n = parseInt(h, 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 150 ? "#fff" : "#000";
};
const short = id => (String(id).length > 3 ? String(id).replace(/^P\d-/, "") : String(id));
const tip = p => `<title>${esc(p[0])} — ${esc(p[1])}${p[2] ? " · " + esc(p[2]) : ""}</title>`;

/** Pino redondo (furo/pino de D-sub, DIN, ATX…) com a cor da função/fio. */
function round(x, y, r, p) {
  if (!p) return "";
  const c = pinColor(p);
  return `<g class="pin" data-pin="${esc(p[0])}">${tip(p)}<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#777" stroke-width="2"/>` +
    `<text x="${x}" y="${y + 3.5}" text-anchor="middle" fill="${ink(c)}" font-size="${r > 9 ? 10 : 8}" font-weight="bold">${esc(short(p[0]))}</text></g>`;
}
/** Pino quadrado (barra de pinos, conectores de fonte). */
function square(x, y, s, p, mark) {
  if (!p) return "";
  const c = pinColor(p);
  return `<g class="pin" data-pin="${esc(p[0])}">${tip(p)}<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" fill="${c}" stroke="${mark ? "#fff" : "#777"}" stroke-width="${mark ? 2.5 : 1.5}"/>` +
    `<text x="${x}" y="${y + 3.5}" text-anchor="middle" fill="${ink(c)}" font-size="${s > 9 ? 10 : 8}" font-weight="bold">${esc(short(p[0]))}</text></g>`;
}
/** Contato plano dourado (USB, HDMI, SATA…) + etiqueta colorida com o número fora dele. */
function bar(x, y, w, h, p, lx, ly) {
  if (!p) return "";
  const c = pinColor(p);
  return `<g class="pin" data-pin="${esc(p[0])}">${tip(p)}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#gold)" stroke="#8a6a10"/>` +
    `<line x1="${x + w / 2}" y1="${y + h / 2}" x2="${lx}" y2="${ly}" stroke="#999" stroke-width="0.8" stroke-dasharray="2 2"/>` +
    `<circle cx="${lx}" cy="${ly}" r="9" fill="${c}" stroke="#000"/>` +
    `<text x="${lx}" y="${ly + 3.3}" text-anchor="middle" fill="${ink(c)}" font-size="8" font-weight="bold">${esc(short(p[0]))}</text></g>`;
}
const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="11" ${MET}/><path d="M${x - 6} ${y - 3.5} L${x} ${y - 7} L${x + 6} ${y - 3.5} V${y + 3.5} L${x} ${y + 7} L${x - 6} ${y + 3.5} Z" fill="#9a9a9a" stroke="#555"/><circle cx="${x}" cy="${y}" r="3.5" fill="#333"/>`;
const caption = (x, y, s, a = "middle") => `<text x="${x}" y="${y}" text-anchor="${a}" font-size="11" fill="#444">${esc(s)}</text>`;

// ---------- famílias ----------
const F = {};

F.usbA = (c, L, m) => {
  const W = 640, H = 230, x = 200, y = 55, w = 240, h = 95;
  let b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ${MET}/>` +
    `<rect x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}" fill="#141414"/>` +
    `<rect x="${x + 60}" y="${y + 2}" width="14" height="5" fill="#666"/><rect x="${x + w - 74}" y="${y + 2}" width="14" height="5" fill="#666"/>` +
    `<rect x="${x + 14}" y="${y + 12}" width="${w - 28}" height="38" rx="2" fill="${L.gen3 ? "#1f5fe0" : "#e8e8e8"}" stroke="#000"/>`;
  const order = [1, 2, 3, 4], bw = 30, gap = (w - 28 - 4 * bw) / 5;
  order.forEach((n, i) => {
    const bx = x + 14 + gap + i * (bw + gap), long = n === 1 || n === 4;
    b += bar(bx, y + 42 - (long ? 2 : 0), bw, 8 + (long ? 2 : 0), m.get(String(n)), bx + bw / 2, y + h + 22);
  });
  if (L.gen3) [5, 6, 7, 8, 9].forEach((n, i) => {
    const bx = x + 22 + i * 40;
    b += bar(bx, y + 16, 26, 6, m.get(String(n)), bx + 13, y - 18);
  });
  b += caption(W / 2, H - 6, L.gen3 ? "contatos 5–9 (SuperSpeed) ficam mais ao fundo da lingueta azul" : "lingueta de plástico com os 4 contatos voltados para baixo");
  return { W, H, body: b };
};

F.micro = (c, L, m) => {
  const W = 640, H = 210, cx = 320, y = 70;
  const outline = L.mini
    ? `M${cx - 110} ${y} H${cx + 110} V${y + 46} L${cx + 92} ${y + 64} H${cx - 92} L${cx - 110} ${y + 46} Z`
    : `M${cx - 120} ${y} H${cx + 120} L${cx + 100} ${y + 52} Q${cx + 98} ${y + 58} ${cx + 90} ${y + 58} H${cx - 90} Q${cx - 98} ${y + 58} ${cx - 100} ${y + 52} Z`;
  let b = `<path d="${outline}" ${MET}/><path d="${outline}" fill="#141414" transform="translate(${cx} ${y + 29}) scale(.9 .78) translate(${-cx} ${-(y + 29)})"/>` +
    `<rect x="${cx - 80}" y="${y + 10}" width="160" height="16" rx="2" fill="#1d1d1d" stroke="#555"/>`;
  [1, 2, 3, 4, 5].forEach((n, i) => { const bx = cx - 70 + i * 30; b += bar(bx, y + 22, 18, 6, m.get(String(n)), bx + 9, y + 95); });
  return { W, H, body: b + caption(W / 2, H - 6, "lingueta superior com 5 contatos voltados para baixo") };
};

F.usbc = (c, L, m) => {
  const W = 640, H = 240, cx = 320, cy = 118, w = 420, h = 84;
  let b = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" ${MET}/>` +
    `<rect x="${cx - w / 2 + 8}" y="${cy - h / 2 + 8}" width="${w - 16}" height="${h - 16}" rx="${(h - 16) / 2}" fill="#141414"/>` +
    `<rect x="${cx - 160}" y="${cy - 14}" width="320" height="28" rx="4" fill="#1d1d1d" stroke="#555"/>`;
  for (let i = 0; i < 12; i++) {
    const bx = cx - 150 + i * 25.5;
    b += bar(bx, cy - 14, 15, 6, m.get("A" + (i + 1)), bx + 7.5, cy - h / 2 - 22);
    b += bar(bx, cy + 8, 15, 6, m.get("B" + (12 - i)), bx + 7.5, cy + h / 2 + 22);
  }
  return { W, H, body: b + caption(W / 2, H - 4, "lingueta central: contatos A em cima, B embaixo (reversível)") };
};

F.hdmi = (c, L, m) => {
  const W = 640, H = 240, cx = 320, y = 78, w = 380, h = 80, ch = L.dp ? 22 : 16;
  const outline = L.dp
    ? `M${cx - w / 2} ${y} H${cx + w / 2} V${y + h} H${cx - w / 2 + ch} L${cx - w / 2} ${y + h - ch} Z`
    : `M${cx - w / 2} ${y} H${cx + w / 2} V${y + h - ch} L${cx + w / 2 - ch * 2} ${y + h} H${cx - w / 2 + ch * 2} L${cx - w / 2} ${y + h - ch} Z`;
  let b = `<path d="${outline}" ${MET}/><path d="${outline}" fill="#141414" transform="translate(${cx} ${y + h / 2}) scale(.95 .8) translate(${-cx} ${-(y + h / 2)})"/>` +
    `<rect x="${cx - 160}" y="${y + 24}" width="320" height="22" rx="2" fill="#1d1d1d" stroke="#555"/>`;
  const top = L.dp ? [1, 3, 5, 7, 9, 11, 13, 15, 17, 19] : [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const bot = L.dp ? [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] : [2, 4, 6, 8, 10, 12, 14, 16, 18];
  top.forEach((n, i) => { const bx = cx - 150 + i * 31; b += bar(bx, y + 24, 14, 6, m.get(String(n)), bx + 7, y - 18); });
  bot.forEach((n, i) => { const bx = cx - 150 + 15.5 + i * 31 - (L.dp ? 15.5 : 0); b += bar(bx, y + 40, 14, 6, m.get(String(n)), bx + 7, y + h + 22); });
  return { W, H, body: b + caption(W / 2, H - 4, "ímpares na face de cima da lingueta, pares na de baixo") };
};

F.dsub = (c, L, m) => {
  const W = 640, rows = L.rows, maxN = Math.max(...rows.map(r => r.length));
  const sp = L.hd ? 30 : Math.min(36, 470 / maxN), rg = L.hd ? 26 : 32, r = L.hd ? 10 : 11;
  const H = 70 + rows.length * rg + 70, cx = W / 2, cy = H / 2 - 6;
  const innerW = (maxN - 1) * sp + 2 * r + 34, innerH = (rows.length - 1) * rg + 2 * r + 26, k = 14;
  const tw = innerW / 2, th = innerH / 2;
  const D = (o, kk) => `M${cx - tw - o} ${cy - th - o} H${cx + tw + o} L${cx + tw + o - kk} ${cy + th + o} H${cx - tw - o + kk} Z`;
  let b = `<rect x="${cx - tw - 70}" y="${cy - th - 22}" width="${2 * tw + 140}" height="${2 * th + 44}" rx="4" ${MET}/>` +
    screw(cx - tw - 42, cy) + screw(cx + tw + 42, cy) +
    `<path d="${D(8, k + 3)}" fill="#bdbdbd" stroke="#555" stroke-linejoin="round"/><path d="${D(0, k)}" ${BLK} stroke-linejoin="round"/>`;
  rows.forEach((row, ri) => {
    const x0 = cx - (row.length - 1) * sp / 2, y = cy - (rows.length - 1) * rg / 2 + ri * rg;
    row.forEach((n, i) => { b += round(x0 + i * sp, y, r, m.get(String(n))); });
  });
  return { W, H, body: b };
};

F.dvi = (c, L, m) => {
  const W = 640, H = 230, cx = 320, cy = 112, sp = 30;
  const x0 = cx - 175, y0 = cy - sp;
  const shape = `M${x0 - 22} ${y0 - 24} H${x0 + 7 * sp + 150} V${y0 + 2 * sp + 24} H${x0 - 4} L${x0 - 22} ${y0 + 2 * sp + 6} Z`;
  let b = `<rect x="${x0 - 90}" y="${y0 - 46}" width="${7 * sp + 330}" height="${2 * sp + 92}" rx="4" ${MET}/>` +
    screw(x0 - 60, cy) + screw(x0 + 7 * sp + 210, cy) + `<path d="${shape}" ${BLK}/>`;
  for (let i = 0; i < 24; i++) b += square(x0 + (i % 8) * sp, y0 + Math.floor(i / 8) * sp, 8, m.get(String(i + 1)));
  const qx = x0 + 7 * sp + 80;
  b += `<g class="pin" data-pin="C5">${tip(m.get("C5"))}<rect x="${qx - 36}" y="${cy - 5}" width="72" height="10" fill="url(#gold)" stroke="#8a6a10"/><text x="${qx}" y="${cy + 3.5}" text-anchor="middle" font-size="8" font-weight="bold">C5</text></g>`;
  [["C1", -18, -20], ["C2", 18, -20], ["C3", -18, 20], ["C4", 18, 20]].forEach(([id, dx, dy]) => { b += square(qx + dx, cy + dy, 7, m.get(id)); });
  return { W, H, body: b };
};

F.rj = (c, L, m) => {
  const W = 640, H = 250, n = c.pins.length, sp = 26, cx = 320;
  const x0 = cx - (n - 1) * sp / 2, bw = (n - 1) * sp + 60;
  let b = `<path d="M${cx - bw / 2} 40 H${cx + bw / 2} V130 L${cx + bw / 2 - 12} 150 H${cx - bw / 2 + 12} L${cx - bw / 2} 130 Z" fill="#e9f1ff" fill-opacity=".9" stroke="#000" stroke-width="2"/>` +
    `<rect x="${cx - 26}" y="128" width="52" height="16" fill="none" stroke="#000" stroke-dasharray="4 3"/>` +
    caption(cx + bw / 2 + 12, 90, "trava fica embaixo", "start") + caption(cx + bw / 2 + 12, 106, "(contatos para você)", "start");
  c.pins.forEach((p, i) => {
    const x = x0 + i * sp, wc = p[4] || "#bbb", stripe = String(wc).startsWith("stripe:"), col = stripe ? wc.slice(7) : wc;
    b += `<rect x="${x - 6}" y="150" width="12" height="80" fill="${stripe ? "#fff" : col}" stroke="#000"/>` + (stripe ? `<rect x="${x - 2.5}" y="150" width="5" height="80" fill="${col}"/>` : "");
    b += `<g class="pin" data-pin="${esc(p[0])}">${tip(p)}<rect x="${x - 7}" y="46" width="14" height="40" fill="url(#gold)" stroke="#8a6a10"/><text x="${x}" y="104" text-anchor="middle" font-size="11" font-weight="bold">${esc(p[0])}</text></g>`;
  });
  return { W, H, body: b };
};

F.minifit = (c, L, m) => {
  const W = 640, rows = L.rows, maxN = Math.max(...rows.map(r => r.length)), sp = Math.min(42, 520 / maxN), s = sp * 0.36;
  const H = 70 + rows.length * sp + 40, cx = W / 2, w = maxN * sp + 24, h = rows.length * sp + 20, x = cx - w / 2, y = 60;
  let b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${L.black ? "#2a2a2a" : "url(#nylon)"}" stroke="#000" stroke-width="2"/>` +
    `<path d="M${cx - 18} ${y} V${y - 22} H${cx + 18} V${y} M${cx - 18} ${y - 22} L${cx} ${y - 30} L${cx + 18} ${y - 22}" fill="${L.black ? "#2a2a2a" : "#efe9da"}" stroke="#000" stroke-width="1.5"/>` +
    caption(cx + 26, y - 14, "trava", "start");
  rows.forEach((row, ri) => row.forEach((n, i) => {
    const px = cx - (row.length - 1) * sp / 2 + i * sp, py = y + 10 + sp / 2 + ri * sp;
    // cavidades alternam quadrada / arredondada (polarização)
    const rounded = (i + ri) % 2 === 0;
    const cav = rounded
      ? `<path d="M${px - s - 4} ${py + s + 4} V${py - 2} A${s + 4} ${s + 4} 0 0 1 ${px + s + 4} ${py - 2} V${py + s + 4} Z" fill="#111"/>`
      : `<rect x="${px - s - 4}" y="${py - s - 4}" width="${2 * s + 8}" height="${2 * s + 8}" fill="#111"/>`;
    b += cav + round(px, py + 1, s * 0.85, m.get(String(n)));
  }));
  return { W, H, body: b };
};

F.atp8p9 = (c, L, m) => {
  const W = 640, H = 200; let b = "";
  [["P8", 0], ["P9", 6]].forEach(([name, off], k) => {
    const x = 50 + k * 290, y = 70, w = 250, h = 60;
    b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#nylon)" stroke="#000" stroke-width="2"/>` +
      `<path d="M${x} ${y + h} v14 h${w} v-14" fill="none" stroke="#000"/>` + caption(x + w / 2, y + h + 34, name);
    for (let i = 0; i < 6; i++) b += `<rect x="${x + 12 + i * 39}" y="${y + 12}" width="32" height="36" rx="3" fill="#111"/>` + round(x + 28 + i * 39, y + 30, 12, c.pins[off + i]);
  });
  return { W, H, body: b + caption(W / 2, 30, "os fios pretos (GND) dos dois conectores ficam lado a lado no meio") };
};

F.molex4 = (c, L, m) => {
  const W = 640, H = 200, cx = 320, y = 60, w = 300, h = 80;
  let b = `<path d="M${cx - w / 2} ${y + h} V${y + 22} L${cx - w / 2 + 22} ${y} H${cx + w / 2 - 22} L${cx + w / 2} ${y + 22} V${y + h} Z" fill="url(#nylon)" stroke="#000" stroke-width="2"/>`;
  [1, 2, 3, 4].forEach((n, i) => { const x = cx - 105 + i * 70; b += `<circle cx="${x}" cy="${y + 44}" r="22" fill="#111"/>` + round(x, y + 44, 15, m.get(String(n))); });
  return { W, H, body: b + caption(W / 2, H - 10, "cantos chanfrados de um lado só: só encaixa de um jeito") };
};

F.jst = (c, L, m) => {
  const W = 640, H = 180, n = c.pins.length, sp = L.berg ? 50 : 40, cx = 320, w = n * sp + 30, h = L.berg ? 70 : 54, x = cx - w / 2, y = 55;
  let b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${L.berg ? "url(#nylon)" : "#f3f3f3"}" stroke="#000" stroke-width="2"/>` +
    `<rect x="${x + 10}" y="${y + h - 12}" width="${w - 20}" height="8" fill="#ccc" stroke="#888"/>` +
    (L.berg ? `<rect x="${cx - 14}" y="${y - 10}" width="28" height="10" fill="#efe9da" stroke="#000"/>` : "");
  c.pins.forEach((p, i) => { b += square(cx - (n - 1) * sp / 2 + i * sp, y + h / 2 - 4, L.berg ? 11 : 9, p); });
  return { W, H, body: b + caption(W / 2, H - 8, L.berg ? "conector pequeno de drive de disquete (“Berg”)" : "JST SH 1 mm (Qwiic / STEMMA QT)") };
};

F.kk = (c, L, m) => {
  const W = 640, H = 180, n = 4, sp = 50, cx = 320, x0 = cx - (n - 1) * sp / 2, y = 90;
  let b = `<rect x="${x0 - 34}" y="${y - 34}" width="${(n - 1) * sp + 68}" height="68" fill="#2a2a2a" stroke="#000"/>` +
    `<rect x="${x0 - 30}" y="${y - 32}" width="${2 * sp + 60}" height="10" fill="#555" stroke="#000"/>` + caption(x0 + sp, y - 40, "rampa-guia (pinos 1–3)");
  c.pins.forEach((p, i) => { b += square(x0 + i * sp, y + 4, 11, p); });
  return { W, H, body: b + caption(W / 2, H - 8, "um conector de 3 pinos encaixa nos pinos 1–3 (sem PWM)") };
};

F.sata = (c, L, m) => {
  const W = 640, H = 200, n = c.pins.length, sp = L.power ? 26 : 34, w = n * sp + 40, cx = 320, x = cx - w / 2, y = 70;
  let b = `<path d="M${x} ${y} H${x + w} V${y + 46} H${x + 30} V${y + 30} H${x} Z" fill="#1d1d1d" stroke="#000" stroke-width="2"/>` +
    `<rect x="${x + 34}" y="${y + 10}" width="${w - 44}" height="18" fill="#000"/>` + caption(x + 15, y + 64, "chave em L");
  c.pins.forEach((p, i) => { const bx = x + 38 + i * sp; b += bar(bx, y + 12, sp - 8, 14, p, bx + (sp - 8) / 2, y + 90); });
  return { W, H, body: b };
};

F.header2 = (c, L, m) => {
  const W = 640, cols = L.cols, sp = Math.min(30, 560 / cols), s = sp * 0.3, cx = 320, H = 200;
  const x0 = cx - (cols - 1) * sp / 2, y0 = 82;
  let b = "";
  if (L.box) {
    b += `<rect x="${x0 - sp / 2 - 14}" y="${y0 - sp / 2 - 14}" width="${cols * sp + 28}" height="${2 * sp + 28}" fill="#2a2a2a" stroke="#000" stroke-width="2"/>` +
      `<rect x="${x0 - sp / 2 - 6}" y="${y0 - sp / 2 - 6}" width="${cols * sp + 12}" height="${2 * sp + 12}" fill="#111"/>` +
      `<rect x="${cx - 16}" y="${y0 + 1.5 * sp + 6}" width="32" height="10" fill="#c0c0c0" stroke="#000"/>` + caption(cx, y0 + 2 * sp + 40, "chanfro / chave da caixa");
  } else {
    b += `<rect x="${x0 - sp / 2}" y="${y0 - sp / 2}" width="${cols * sp}" height="${2 * sp}" fill="#111" stroke="#000"/>`;
  }
  c.pins.forEach((p, i) => { b += square(x0 + Math.floor(i / 2) * sp, y0 + (i % 2 ? 0 : sp), s, p, i === 0); });
  b += `<text x="${x0}" y="${y0 + sp + s + 22}" text-anchor="middle" font-size="11">▲ 1</text>`;
  return { W, H, body: b };
};

F.obd = (c, L, m) => {
  const W = 640, H = 210, cx = 320, y = 60, w = 400, h = 100, sp = 44;
  let b = `<path d="M${cx - w / 2} ${y} H${cx + w / 2} V${y + h - 30} L${cx + w / 2 - 40} ${y + h} H${cx - w / 2 + 40} L${cx - w / 2} ${y + h - 30} Z" fill="#1d1d1d" stroke="#000" stroke-width="2"/>` +
    `<rect x="${cx - 24}" y="${y - 12}" width="48" height="14" fill="#1d1d1d" stroke="#000"/>` + caption(cx + 34, y - 2, "trava", "start");
  L.rows.forEach((row, ri) => row.forEach((n, i) => { b += `<rect x="${cx - 3.5 * sp + i * sp - 8}" y="${y + 22 + ri * 40}" width="16" height="22" fill="#000"/>` + round(cx - 3.5 * sp + i * sp, y + 33 + ri * 40, 10, m.get(String(n))); }));
  return { W, H, body: b };
};

F.scart = (c, L, m) => {
  const W = 640, H = 210, cx = 320, y = 60, w = 400, h = 90, sp = 34;
  const o = `M${cx - w / 2} ${y} H${cx + w / 2} V${y + h} H${cx - w / 2 + 34} L${cx - w / 2} ${y + h - 34} Z`;
  let b = `<path d="${o}" ${MET}/><path d="${o}" ${BLK} transform="translate(${cx} ${y + h / 2}) scale(.95 .82) translate(${-cx} ${-(y + h / 2)})"/>`;
  L.rows.forEach((row, ri) => row.forEach((n, i) => {
    const x = cx - (row.length - 1) * sp / 2 + i * sp, yy = y + 28 + ri * 34;
    b += bar(x - 6, yy - 7, 12, 14, m.get(String(n)), x, ri ? y + h + 22 : y - 18);
  }));
  return { W, H, body: b + caption(W / 2, H - 4, "contatos planos; o canto chanfrado garante a posição") };
};

F.fw = (c, L, m) => {
  const W = 640, H = 200, cx = 320, y = 60, w = 240, h = 80;
  let b = `<path d="M${cx - w / 2} ${y} H${cx + w / 2 - 40} A40 40 0 0 1 ${cx + w / 2 - 40} ${y + h} H${cx - w / 2} Z" ${MET}/>` +
    `<path d="M${cx - w / 2 + 8} ${y + 8} H${cx + w / 2 - 44} A32 32 0 0 1 ${cx + w / 2 - 44} ${y + h - 8} H${cx - w / 2 + 8} Z" fill="#141414"/>` +
    `<rect x="${cx - 80}" y="${y + 28}" width="130" height="24" fill="#1d1d1d" stroke="#555"/>`;
  [[1, 3, 5], [2, 4, 6]].forEach((row, ri) => row.forEach((n, i) => { const bx = cx - 70 + i * 40; b += bar(bx, y + 28 + ri * 18, 20, 6, m.get(String(n)), bx + 10, ri ? y + h + 22 : y - 18); }));
  return { W, H, body: b + caption(W / 2, H - 4, "lado arredondado = posição única") };
};

F.circle = (c, L, m) => {
  const W = 640, H = 230, cx = 320, cy = 112, R = L.r || 70;
  let b = `<circle cx="${cx}" cy="${cy}" r="${R + 14}" ${MET}/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#1d1d1d" stroke="#000"/>`;
  if (L.key === "bottom") b += `<rect x="${cx - 9}" y="${cy + R * 0.62}" width="18" height="${R * 0.4}" fill="url(#metal)" stroke="#555"/>`;
  else if (L.key) b += `<rect x="${cx - 10}" y="${cy - R - 2}" width="20" height="${R * 0.42}" fill="url(#metal)" stroke="#555"/>`;
  if (L.square) b += `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" fill="#333" stroke="#000"/>`;
  for (const [id, x, y] of L.pins) b += round(cx + x * R, cy + y * R, 12, m.get(String(id)));
  return { W, H, body: b };
};

F.trs = (c, L, m) => {
  const W = 640, H = 200, n = L.parts.length, segW = 80, x0 = 110, y = 95;
  let b = `<rect x="${x0 + n * segW}" y="${y - 24}" width="30" height="48" fill="#bbb" stroke="#555"/><path d="M${x0 + n * segW + 30} ${y - 34} H${x0 + n * segW + 190} Q${x0 + n * segW + 210} ${y} ${x0 + n * segW + 190} ${y + 34} H${x0 + n * segW + 30} Z" fill="#2a2a2a"/>`;
  c.pins.forEach((p, i) => {
    const x = x0 + i * segW;
    b += `<g class="pin" data-pin="${esc(p[0])}">${tip(p)}` +
      (i === 0 ? `<path d="M${x + segW} ${y - 16} H${x + 26} Q${x} ${y - 16} ${x} ${y} Q${x} ${y + 16} ${x + 26} ${y + 16} H${x + segW} Z" fill="url(#metal)" stroke="#555"/>`
        : `<rect x="${x}" y="${y - 16}" width="${segW}" height="32" fill="url(#metal)" stroke="#555"/>`) +
      `<circle cx="${x + segW / 2}" cy="${y}" r="9" fill="${pinColor(p)}" stroke="#000"/><text x="${x + segW / 2}" y="${y + 3.3}" text-anchor="middle" font-size="8" font-weight="bold" fill="${ink(pinColor(p))}">${esc(p[0])}</text></g>` +
      caption(x + segW / 2, y + 40, L.parts[i]) + (i < n - 1 ? `<rect x="${x + segW - 4}" y="${y - 16}" width="8" height="32" fill="#111"/>` : "");
  });
  return { W, H, body: b };
};

F.rca = (c, L, m) => {
  const W = 640, H = 220, cx = 320, cy = 108, [center, outer] = c.pins;
  return { W, H, body:
    `<g class="pin" data-pin="${esc(outer[0])}">${tip(outer)}<circle cx="${cx}" cy="${cy}" r="72" ${MET}/><circle cx="${cx}" cy="${cy}" r="56" fill="#d0d0d0" stroke="#666"/></g>` +
    `<circle cx="${cx}" cy="${cy}" r="42" fill="#f2c200" stroke="#000"/><circle cx="${cx}" cy="${cy}" r="20" fill="#111"/>` +
    `<g class="pin" data-pin="${esc(center[0])}">${tip(center)}<circle cx="${cx}" cy="${cy}" r="9" fill="url(#metal)" stroke="#000" stroke-width="2"/></g>` +
    caption(cx + 88, cy - 22, "corpo metálico = terra", "start") + caption(cx + 88, cy + 4, "pino central = sinal", "start") + caption(cx + 88, cy + 30, "isolante colorido (cor = função)", "start") };
};

export function draw(c) {
  const m = new Map(c.pins.map(p => [String(p[0]), p]));
  const f = F[c.layout.type];
  if (!f) return "";
  const { W, H, body } = f(c, c.layout, m);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.name)}">${DEFS}${body}</svg>`;
}
