// MechLab — Rolamentos e materiais: rolamentos e mancais, ensaio de tração, vigas e flexão, molas.
"use strict";

// ---------------- Rolamentos e mancais ----------------
const BEAR = {
  esf: ["Esferas", 3, 1.5, "o mais comum: motores, rodas de skate, ventiladores"],
  rolo: ["Rolos cilíndricos", 4.5, 0.2, "cargas radiais grandes: caixas de câmbio, motores grandes"],
  conico: ["Rolos cônicos", 4, 3.5, "radial + axial: cubo de roda de carro, diferencial"],
  agulha: ["Agulhas", 3.5, 0, "pouco espaço: cruzetas, bielas de motor de moto"],
  axial: ["Axial de esferas", 0, 4, "só carga axial: mesas giratórias, fusos"],
  bucha: ["Bucha (deslizamento)", 4, 0.5, "sem esferas: o eixo flutua num filme de óleo — virabrequim, turbinas"],
};
M({
  id: "rolamentos", group: "Rolamentos e materiais", title: "Rolamentos e mancais", icon: "🔘", short: "Trocar deslizamento por rolamento (ou por óleo).",
  lead: "O anel de dentro gira com o eixo, as esferas rolam entre os anéis e a gaiola as mantém separadas. Cada tipo aguenta um tipo de esforço. Na bucha, o próprio óleo faz uma cunha que levanta o eixo.",
  h: 380,
  controls: [
    { k: "tb", type: "seg", label: "Tipo", v: "esf", options: Object.entries(BEAR).map(([k, v]) => [k, v[0]]) },
    { k: "rpm", label: "Rotação", min: 5, max: 100, v: 40, unit: "% (desenho)" },
  ],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * s.rpm / 25;
    const cx = 300, cy = 190, a = s.a;
    if (s.tb === "bucha") {
      const ecc = 10 / (1 + s.rpm / 30);
      D.circle(g, cx, cy, 120, C.steelL, C.line); D.circle(g, cx, cy, 92, C.oilL, C.line);
      D.circle(g, cx - ecc * 0.6, cy + ecc, 84, C.steel, C.line); g.save(); g.translate(cx - ecc * 0.6, cy + ecc); g.rotate(a); D.line(g, 0, 0, 80, 0, C.red, 3); g.restore();
      for (let i = 0; i < 24; i++) { const t = a * 0.5 + i * TAU / 24, r = 88; D.circle(g, cx + Math.cos(t) * r, cy + Math.sin(t) * r, 2, C.oil, null); }
      D.arrow(g, cx, cy - 140, cx, cy - 100, C.blue, 3); D.text(g, "carga", cx + 6, cy - 128, { size: 12, color: C.blue });
      D.label(g, `filme de óleo mais fino embaixo (cunha de pressão) · quanto mais rápido, mais o eixo centraliza`, 120, 360, { size: 12 });
      this.bars(g, s); return;
    }
    if (s.tb === "axial") {
      const y = cy;
      D.rect(g, cx - 150, y - 60, 300, 26, C.steelL, C.line); D.rect(g, cx - 150, y + 34, 300, 26, C.steelL, C.line);
      for (let i = 0; i < 8; i++) { const x = cx - 130 + ((i * 36 + a * 20) % 288); D.circle(g, x, y, 30, C.steel, C.line); }
      D.arrow(g, cx, y - 130, cx, y - 66, C.red, 4); D.text(g, "força axial", cx + 8, y - 110, { size: 12, color: C.red });
      D.text(g, "vista de lado (corte)", cx, y + 90, { align: "center", size: 12, color: C.muted });
      this.bars(g, s); return;
    }
    const Ro = 150, Ri = 70, n = s.tb === "agulha" ? 22 : s.tb === "esf" ? 9 : 12, rb = (Ro - Ri) / 2 - 8, rm = (Ro + Ri) / 2;
    D.circle(g, cx, cy, Ro + 18, C.steelL, C.line); D.circle(g, cx, cy, Ro, "#fff", C.line);
    const cage = a * 0.4;
    for (let i = 0; i < n; i++) {
      const t = cage + i * TAU / n, x = cx + Math.cos(t) * rm, y = cy + Math.sin(t) * rm;
      if (s.tb === "esf") { D.circle(g, x, y, rb, C.steel, C.line); D.circle(g, x - rb * 0.35, y - rb * 0.35, rb * 0.25, "rgba(255,255,255,.7)", null); }
      else { g.save(); g.translate(x, y); g.rotate(t); const w = s.tb === "agulha" ? rb * 0.35 : rb * 0.8; D.rect(g, -rb, -w, 2 * rb, 2 * w, C.steel, C.line); g.restore(); }
      g.save(); g.translate(x, y); g.rotate(-a * 1.6); D.line(g, 0, 0, rb * 0.8, 0, C.red, 1.5); g.restore();
    }
    D.circle(g, cx, cy, Ri, C.steelL, C.line); D.circle(g, cx, cy, Ri - 20, "#fff", C.line);
    g.save(); g.translate(cx, cy); g.rotate(a); D.circle(g, 0, 0, Ri - 22, C.steelD, C.line); D.line(g, 0, 0, Ri - 26, 0, C.red, 3); g.restore();
    D.text(g, "anel externo (parado)", cx + Ro + 24, cy - 120, { size: 12 }); D.text(g, "anel interno + eixo (gira)", cx + Ro + 24, cy - 100, { size: 12 });
    D.text(g, "elementos rolantes e gaiola (giram a ~40%)", cx + Ro + 24, cy - 80, { size: 12 });
    this.bars(g, s);
  },
  bars(g, s) {
    const [, rad, ax] = BEAR[s.tb], x = 600, y = 230;
    D.text(g, "aguenta:", x, y - 10, { bold: true });
    for (const [i, lab, v] of [[0, "carga radial", rad], [1, "carga axial", ax]]) { D.text(g, lab, x, y + 22 + i * 34, { size: 12 }); D.rect(g, x + 90, y + 8 + i * 34, 160, 18, "#fff", C.line, 1); D.rect(g, x + 91, y + 9 + i * 34, 158 * v / 5, 16, i ? C.purple : C.blue, null); }
  },
  info(s) { return { stats: [["Tipo", BEAR[s.tb][0]], ["Usado em", BEAR[s.tb][3]]], cap: s.tb === "bucha" ? "Mancal hidrodinâmico: em movimento, o eixo arrasta óleo para uma cunha estreita e a pressão o levanta — metal não encosta em metal. Na partida (sem rotação) é quando mais desgasta." : "Rolamento troca o deslizamento por rolamento: atrito ~10× menor. Barulho de “ronco” que muda com a velocidade = pista ou esfera danificada." }; },
  explain: [
    ["Radial × axial", `<ul><li><b>Radial:</b> perpendicular ao eixo (peso de uma polia).</li><li><b>Axial:</b> ao longo do eixo (empurra o eixo para frente).</li><li>Cônicos e de contato angular aguentam as duas.</li></ul>`],
    ["Vida curta? Causas", `<ul><li>Montagem martelando a pista errada.</li><li>Falta ou excesso de graxa.</li><li>Desalinhamento, sujeira, água, corrente elétrica passando.</li></ul>`],
  ],
});

// ---------------- Ensaio de tração ----------------
const MAT2 = {
  aco: { n: "Aço 1020", E: 200, sy: 350, su: 420, eu: 0.25, ef: 0.36, col: C.steel },
  al: { n: "Alumínio 6061", E: 69, sy: 275, su: 310, eu: 0.1, ef: 0.17, col: "#c8d0dc" },
  ff: { n: "Ferro fundido (frágil)", E: 110, sy: 200, su: 200, eu: 0.006, ef: 0.006, col: "#8a8a90" },
  cobre: { n: "Cobre recozido", E: 117, sy: 70, su: 220, eu: 0.4, ef: 0.5, col: "#d08850" },
};
function sigma(m, e) {
  const ey = m.sy / (m.E * 1000);
  if (e <= ey) return m.E * 1000 * e;
  if (e <= m.eu) return m.sy + (m.su - m.sy) * Math.sin(Math.min(1, (e - ey) / (m.eu - ey)) * Math.PI / 2);
  if (e <= m.ef) return m.su - (m.su - m.sy * 0.85) * ((e - m.eu) / (m.ef - m.eu)) ** 2;
  return 0;
}
M({
  id: "tracao", group: "Rolamentos e materiais", title: "Ensaio de tração: tensão × deformação", icon: "📈", short: "Elástico, escoamento, estricção e ruptura.",
  lead: "Puxando um corpo de prova até romper, aparece toda a personalidade do material: a parte elástica (volta ao normal), o escoamento (deforma para sempre), o pico e o “pescoço” antes de quebrar.",
  h: 380,
  controls: [
    { k: "m", type: "seg", label: "Material", v: "aco", options: Object.entries(MAT2).map(([k, v]) => [k, v.n]) },
    { k: "e", label: "Deformação (puxe)", min: 0, max: 100, v: 30, unit: "% do ensaio" },
    { k: "auto", type: "check", label: "Puxar sozinho (animação)", v: true },
  ],
  draw(g, s, dt) {
    const m = MAT2[s.m];
    if (s.auto) { s.ea = ((s.ea ?? s.e) + dt * 8) % 106; this.ctl.e?.(Math.min(100, Math.round(s.ea))); } else s.ea = s.e;
    const prog = s.ea, eps = Math.min(1, prog / 100) * m.ef * 1.0001, sg = sigma(m, eps), broke = prog >= 100;
    // corpo de prova
    const cx = 200, cy = 190, L0 = 140, L = L0 * (1 + eps * 1.2), neck = eps > m.eu ? (eps - m.eu) / (m.ef - m.eu + 1e-9) : 0;
    D.rect(g, cx - 40, 40, 80, 30, C.steelD, C.line); D.rect(g, cx - 40, cy + L / 2 + 40, 80, 30, C.steelD, C.line);
    const half = 18, top = cy - L / 2, bot = cy + L / 2;
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, y = top + t * L, w = half * (1 - 0.5 * neck * Math.exp(-((t - 0.5) ** 2) / 0.01)); pts.push([cx - w, y]); }
    const right = pts.map(([x, y]) => [2 * cx - x, y]).reverse();
    D.rect(g, cx - 30, 70, 60, top - 70, m.col, C.line); D.rect(g, cx - 30, bot, 60, cy + L / 2 + 40 - bot, m.col, C.line);
    if (broke) { D.path(g, [...pts.slice(0, 20), ...right.slice(-20)], C.line, 1.5, true, m.col); g.save(); g.translate(0, 18); D.path(g, [...pts.slice(21), ...right.slice(0, 20)], C.line, 1.5, true, m.col); g.restore(); }
    else D.path(g, [...pts, ...right], C.line, 1.5, true, m.col);
    D.arrow(g, cx, 34, cx, 4, C.red, 3); D.arrow(g, cx, cy + L / 2 + 76, cx, cy + L / 2 + 106 > 378 ? 378 : cy + L / 2 + 106, C.red, 3);
    // curva
    const curve = []; for (let i = 0; i <= 200; i++) { const e = i / 200 * m.ef; curve.push([e * 100, sigma(m, e)]); }
    D.plot(g, 420, 50, 430, 270, [{ pts: curve, color: C.blue, w: 2.5 }], { xr: [0, Math.max(m.ef * 100 * 1.05, 1)], yr: [0, 480], title: `tensão (MPa) × deformação (%) — ${m.n}`, xl: "deformação %", mark: broke ? null : [eps * 100, sg] });
    const ey = m.sy / (m.E * 1000) * 100, X = v => 420 + v / Math.max(m.ef * 100 * 1.05, 1) * 430;
    if (m.eu > 0.01) { D.text(g, "elástico", X(ey / 2), 345, { size: 10, align: "center", color: C.green }); D.text(g, "deformação plástica", X((ey + m.eu * 100) / 2), 345, { size: 10, align: "center", color: C.purple }); D.text(g, "estricção", X((m.eu + m.ef) * 50), 345, { size: 10, align: "center", color: C.red }); }
    if (broke) D.label(g, "ROMPEU!", 160, 30, { color: C.red, bold: true });
  },
  info(s) {
    const m = MAT2[s.m];
    return { stats: [["Módulo de elasticidade (E)", `${m.E} GPa`], ["Escoamento", `${m.sy} MPa`], ["Resistência máxima", `${m.su} MPa`], ["Alongamento na ruptura", `${nf(m.ef * 100, 1)}%`]],
      cap: s.m === "ff" ? "Ferro fundido é <b>frágil</b>: quase não deforma e quebra de repente, sem aviso. Ótimo em compressão (bases de máquinas), ruim em tração e impacto." : "Até o escoamento, tirar a força faz a peça voltar ao tamanho original (mola). Depois disso ela fica deformada para sempre. Projetos usam tensões bem abaixo do escoamento (fator de segurança)." };
  },
  explain: [
    ["Definições", `<ul><li><b>Tensão:</b> <span class="f">σ = F / A</span> (MPa = N/mm²).</li><li><b>Deformação:</b> <span class="f">ε = ΔL / L₀</span>.</li><li><b>Hooke:</b> <span class="f">σ = E·ε</span> na parte elástica.</li></ul>`],
    ["Dúctil × frágil", `<p>Dúctil (aço, cobre) avisa antes de quebrar — estica e forma o “pescoço”. Frágil (vidro, ferro fundido, aço temperado demais) quebra de uma vez.</p>`],
    ["Rigidez ≠ resistência", `<p>E (inclinação inicial) diz o quanto flexiona; o escoamento diz quando estraga. Aço comum e aço especial têm o mesmo E (flexionam igual), mas resistências bem diferentes.</p>`],
  ],
});

// ---------------- Vigas e flexão ----------------
const SECT = { ret_d: ["Retângulo deitado 100×20", 100 * 20 ** 3 / 12, 2000], ret_p: ["Retângulo em pé 20×100", 20 * 100 ** 3 / 12, 2000], tubo: ["Tubo quadrado 60×60×3", (60 ** 4 - 54 ** 4) / 12, 60 * 60 - 54 * 54], perfilI: ["Perfil I 100×50", 50 * 100 ** 3 / 12 - 45 * 90 ** 3 / 12, 50 * 100 - 45 * 90] };
M({
  id: "vigas", group: "Rolamentos e materiais", title: "Vigas e flexão", icon: "🌉", short: "Por que a viga em pé e o perfil I são tão fortes.",
  lead: "Uma viga carregada encurva: em cima ela é comprimida, embaixo é esticada. Mover o material para longe do meio (viga em pé, perfil I, tubo) aumenta muito a rigidez com o mesmo peso de aço.",
  h: 390, hint: "Arraste a carga ao longo da viga.",
  controls: [
    { k: "apoio", type: "seg", label: "Apoio", v: "bi", options: [["bi", "Biapoiada"], ["bal", "Engastada (balanço)"]] },
    { k: "sec", type: "seg", label: "Seção", v: "ret_d", options: Object.entries(SECT).map(([k, v]) => [k, v[0]]) },
    { k: "F", label: "Carga", min: 0.2, max: 10, step: 0.1, v: 2, unit: "kN", d: 1 },
    { k: "pos", label: "Posição da carga", min: 5, max: 100, v: 50, unit: "%" },
  ],
  pointer(s, x, y, t) { if (t === "down" || t === "drag") this.set("pos", Math.round(clamp((x - 100) / 600 * 100, 5, 100))); },
  defl(s, xr) { // flecha normalizada (x relativo 0..1), unidade arbitrária × F/(E I)
    const a = s.pos / 100, Lr = 1;
    if (s.apoio === "bal") { return xr <= a ? xr * xr * (3 * a - xr) / 6 : a * a * (3 * xr - a) / 6; }
    const b = Lr - a; if (b < 0.001) return 0;
    return xr <= a ? b * xr * (Lr * Lr - b * b - xr * xr) / (6 * Lr) : a * (Lr - xr) * (2 * Lr * xr - xr * xr - a * a) / (6 * Lr);
  },
  draw(g, s) {
    const x0 = 100, L = 600, y0 = 150, I = SECT[s.sec][1], E = 200000, Lm = 2000; // mm
    const scale = s.F * 1000 * Lm ** 3 / (E * I); // mm de flecha × fator geométrico
    const vis = clamp(scale * 6, 0, 400);
    const pts = []; for (let i = 0; i <= 60; i++) { const xr = i / 60; pts.push([x0 + xr * L, y0 + this.defl(s, xr) * vis]); }
    // tração/compressão: faixas
    g.save(); g.lineWidth = 22; g.lineJoin = "round"; g.strokeStyle = C.steelL; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.lineWidth = 5; g.strokeStyle = s.apoio === "bal" ? "rgba(198,40,40,.7)" : "rgba(28,95,208,.7)"; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y - 8) : g.moveTo(x, y - 8)); g.stroke();
    g.strokeStyle = s.apoio === "bal" ? "rgba(28,95,208,.7)" : "rgba(198,40,40,.7)"; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y + 8) : g.moveTo(x, y + 8)); g.stroke(); g.restore();
    D.path(g, pts.map(([x, y]) => [x, y - 11]), C.line, 1.2); D.path(g, pts.map(([x, y]) => [x, y + 11]), C.line, 1.2);
    if (s.apoio === "bi") { D.anchor(g, x0, y0 + 11, 12); D.circle(g, x0 + L, y0 + 24, 12, "#fff", C.line); D.ground(g, x0 + L - 20, y0 + 36, 40); }
    else { D.hatch(g, x0 - 30, y0 - 60, 30, 120); }
    const lx = x0 + L * s.pos / 100, ly = y0 + this.defl(s, s.pos / 100) * vis;
    D.weight(g, lx, ly - 12, 46, 30, ""); D.arrow(g, lx, ly - 80, lx, ly - 44, C.red, 3); D.label(g, `${nf(s.F, 1)} kN`, lx + 8, ly - 60, { color: C.red });
    D.text(g, "azul = comprimido · vermelho = esticado (flecha exagerada)", x0, 30, { size: 12, color: C.muted });
    // diagrama de momento fletor
    const a = s.pos / 100, Mpts = [];
    for (let i = 0; i <= 60; i++) { const xr = i / 60; let M; if (s.apoio === "bal") M = xr <= a ? (a - xr) : 0; else M = xr <= a ? (1 - a) * xr : a * (1 - xr); Mpts.push([xr, M]); }
    D.plot(g, x0, 290, L, 80, [{ pts: Mpts, color: C.purple, w: 2.5 }], { xr: [0, 1], yr: [0, Math.max(0.3, ...Mpts.map(p => p[1])) * 1.1], title: "momento fletor (onde a viga “sofre” mais)" });
    // seção
    const sx = 790, sy = 120;
    D.text(g, "seção", sx, sy - 50, { align: "center", size: 12, bold: true });
    const sec = s.sec;
    if (sec === "ret_d") D.hatch(g, sx - 50, sy - 10, 100, 20); else if (sec === "ret_p") D.hatch(g, sx - 10, sy - 50, 20, 100);
    else if (sec === "tubo") { D.hatch(g, sx - 30, sy - 30, 60, 60); D.rect(g, sx - 27, sy - 27, 54, 54, "#fff", C.line, 1); }
    else { D.hatch(g, sx - 25, sy - 50, 50, 5); D.hatch(g, sx - 25, sy + 45, 50, 5); D.hatch(g, sx - 2.5, sy - 45, 5, 90); }
  },
  info(s) {
    const I = SECT[s.sec][1], A = SECT[s.sec][2], E = 200000, Lm = 2000, a = s.pos / 100;
    let dmax = 0; for (let i = 0; i <= 100; i++) dmax = Math.max(dmax, this.defl(s, i / 100));
    const d = s.F * 1000 * Lm ** 3 / (E * I) * dmax;
    return { stats: [["Momento de inércia I", `${nf(I / 1e4, 1)} cm⁴`], ["Área (≈ peso)", `${nf(A / 100, 1)} cm²`], ["Flecha máxima (aço, 2 m)", `${nf(d, 2)} mm`]],
      cap: s.sec === "ret_d" ? "Deitada, a mesma barra fica “fraca”: o material está todo perto do meio. Ponha em pé (mesmo peso) e a flecha cai 25 vezes!" : s.sec === "perfilI" ? "O perfil I põe quase todo o aço nas abas, longe do centro, onde ele trabalha mais. Rigidez enorme com pouco material — por isso está em pontes e prédios." : "A rigidez cresce com o cubo da altura (I = b·h³/12): dobrar a altura deixa a viga 8× mais rígida." };
  },
  explain: [
    ["Momento de inércia", `<p><span class="f">I = b·h³ / 12</span> (retângulo). A altura pesa ao cubo! Flecha biapoiada com carga no meio: <span class="f">δ = F·L³ / (48·E·I)</span>.</p>`],
    ["Linha neutra", `<p>No meio da altura não há tração nem compressão. Por isso furar uma viga no meio da altura enfraquece pouco; cortar a aba de baixo enfraquece muito.</p>`],
    ["Balanço", `<p>Na viga engastada (prateleira, marquise, trampolim) o esforço máximo fica no engaste e a ponta desce 16× mais que a biapoiada com a mesma carga no meio.</p>`],
  ],
});

// ---------------- Molas ----------------
M({
  id: "molas", group: "Rolamentos e materiais", title: "Molas: tipos, Hooke, série e paralelo", icon: "🌀", short: "Força proporcional à deformação.",
  lead: "Uma mola estica ou comprime proporcionalmente à força (lei de Hooke). Duas molas em série ficam mais moles; em paralelo, mais duras. Veja também os outros formatos de mola.",
  h: 380,
  controls: [
    { k: "tipo", type: "seg", label: "Ver", v: "hooke", options: [["hooke", "Hooke: série × paralelo"], ["tipos", "Tipos de mola"]] },
    { k: "F", label: "Força (peso pendurado)", min: 0, max: 200, step: 5, v: 80, unit: "N" },
    { k: "k", label: "Constante de cada mola (k)", min: 1, max: 10, step: 0.5, v: 4, unit: "N/mm", d: 1 },
  ],
  draw(g, s) {
    if (s.tipo === "tipos") return this.tipos(g, s);
    const top = 40, sc = 1.2;
    D.rect(g, 60, top - 16, 780, 16, C.steelL, C.line); D.hatch(g, 60, top - 16, 780, 16);
    const cases = [["Uma mola", s.k], ["Duas em série", s.k / 2], ["Duas em paralelo", s.k * 2]];
    cases.forEach(([lab, k], i) => {
      const x = 180 + i * 260, x0 = top, ext = s.F / k * sc, L0 = 140;
      if (i === 1) { const h = (L0 + ext) / 2; D.spring(g, x, top, x, top + h, 7, 24); D.rect(g, x - 14, top + h - 3, 28, 6, C.steelD, null); D.spring(g, x, top + h, x, top + 2 * h, 7, 24); }
      else if (i === 2) { D.spring(g, x - 24, top, x - 24, top + L0 + ext, 10, 20); D.spring(g, x + 24, top, x + 24, top + L0 + ext, 10, 20); D.rect(g, x - 40, top + L0 + ext - 4, 80, 6, C.steelD, null); }
      else D.spring(g, x, top, x, top + L0 + ext, 10, 24);
      const end = top + L0 + ext;
      D.weight(g, x, end + 44, 60, 40, `${s.F} N`);
      D.line(g, x + 60, top + L0, x + 90, top + L0, C.muted, 1, [3, 3]); D.line(g, x + 60, end, x + 90, end, C.red, 1);
      D.text(g, `+${nf(s.F / k, 1)} mm`, x + 94, (top + L0 + end) / 2 + 4, { size: 12, color: C.red });
      D.text(g, lab, x, 360, { align: "center", bold: true }); D.text(g, `k = ${nf(k, 1)} N/mm`, x, 378 - 0, { align: "center", size: 12, color: C.blue });
      void x0;
    });
  },
  tipos(g, s) {
    const t = s.t, sq = (Math.sin(t * 1.5) + 1) / 2;
    const lab = (x, txt, sub) => { D.text(g, txt, x, 300, { align: "center", bold: true, size: 13 }); D.text(g, sub, x, 320, { align: "center", size: 11, color: C.muted }); };
    // compressão
    D.spring(g, 110, 80 + sq * 40, 110, 240, 8, 50, C.dark, 3); D.rect(g, 70, 70 + sq * 40, 80, 10, C.steelD, null); lab(110, "Compressão", "suspensão, válvulas");
    // tração (com ganchos)
    D.spring(g, 270, 90, 270, 200 + sq * 40, 12, 36, C.dark, 3); D.circle(g, 270, 80, 10, null, C.dark, 3); D.circle(g, 270, 210 + sq * 40, 10, null, C.dark, 3); lab(270, "Tração", "portões, balanças, trampolim");
    // torção
    g.save(); g.translate(430, 170); D.circle(g, 0, 0, 30, null, C.dark, 3); D.circle(g, 0, 0, 22, null, C.dark, 3); D.line(g, 30, 0, 90, -10, C.dark, 3); g.rotate(-0.3 - sq * 0.6); D.line(g, -30, 0, -90, -10, C.dark, 3); g.restore(); lab(430, "Torção", "prendedor de roupa, ratoeira");
    // prato (Belleville)
    for (let i = 0; i < 4; i++) { const y = 120 + i * 30 + sq * i * 3, d = 18 * (1 - sq * 0.6); D.path(g, [[540, y + (i % 2 ? d : 0)], [600, y + (i % 2 ? 0 : d)], [660, y + (i % 2 ? d : 0)]], C.dark, 4); }
    lab(600, "Prato (Belleville)", "muita força em pouco espaço");
    // lâmina / feixe
    g.save(); g.strokeStyle = C.dark; g.lineWidth = 6; g.beginPath(); g.moveTo(720, 170); g.quadraticCurveTo(790, 170 + 30 + sq * 50, 860, 170); g.stroke(); g.restore(); D.arrow(g, 790, 110, 790, 170 + sq * 30, C.red, 3); lab(790, "Lâmina / feixe", "caminhões, arcos");
  },
  info(s) {
    if (s.tipo === "tipos") return { stats: [], cap: "Toda mola guarda energia deformando o material dentro do limite elástico (veja Ensaio de tração). Se passar do escoamento, ela “cansa” e não volta ao tamanho." };
    return { stats: [["Uma mola", `${nf(s.F / s.k, 1)} mm`], ["Série (k/2)", `${nf(s.F / (s.k / 2), 1)} mm`], ["Paralelo (2k)", `${nf(s.F / (2 * s.k), 1)} mm`], ["Energia na mola simples", `${nf(s.F * s.F / s.k / 2 / 1000, 2)} J`]],
      cap: "<b>Série:</b> cada mola sente a força inteira, então as deformações somam — fica mais macio. <b>Paralelo:</b> a força se divide — mais duro. É o contrário dos resistores elétricos." };
  },
  explain: [
    ["Hooke", `<p><span class="f">F = k × x</span> · energia <span class="f">E = ½·k·x²</span></p>`],
    ["Associações", `<p>Série: <span class="f">1/k = 1/k₁ + 1/k₂</span> · Paralelo: <span class="f">k = k₁ + k₂</span></p>`],
    ["O que muda o k", `<ul><li>Arame mais grosso: muito mais dura (d⁴).</li><li>Diâmetro da espira maior: mais mole (D³).</li><li>Mais espiras: mais mole.</li></ul>`],
  ],
});
