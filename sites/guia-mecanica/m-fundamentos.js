// MechLab — Fundamentos: alavancas, polias, plano inclinado/cunha/parafuso, atrito, torque e potência.
"use strict";
const G = 9.81;
const N = v => v >= 1000 ? `${nf(v / 1000, 2)} kN` : `${nf(v, 0)} N`;

// ---------------- Alavancas ----------------
M({
  id: "alavanca", group: "Fundamentos", title: "Alavancas", icon: "⚖️", short: "Troque força por distância usando um ponto de apoio.",
  lead: "Uma barra apoiada num ponto multiplica a força — mas a mão anda mais do que a carga. Arraste o elemento do meio e veja a força mudar.",
  h: 330, hint: "Arraste na barra para mover o elemento do meio.",
  controls: [
    { k: "cls", type: "seg", label: "Tipo de alavanca", v: 1, options: [[1, "1ª classe (apoio no meio)"], [2, "2ª classe (carga no meio)"], [3, "3ª classe (força no meio)"]] },
    { k: "pos", label: "Posição do elemento do meio", min: 10, max: 90, v: 30, unit: "%" },
    { k: "kg", label: "Carga", min: 5, max: 300, v: 60, unit: "kg" },
  ],
  geo(s) {
    const x0 = 140, L = 620, xm = x0 + L * s.pos / 100;
    if (s.cls === 1) return { xF: xm, xL: x0, xE: x0 + L, dL: xm - x0, dE: x0 + L - xm };
    if (s.cls === 2) return { xF: x0, xL: xm, xE: x0 + L, dL: xm - x0, dE: L };
    return { xF: x0, xL: x0 + L, xE: xm, dL: L, dE: xm - x0 };
  },
  pointer(s, x, y, type) { if (type === "down" || type === "drag") this.set("pos", Math.round(clamp((x - 140) / 620 * 100, 10, 90))); },
  draw(g, s) {
    const Y = 170, { xF, xL, xE, dL, dE } = this.geo(s), a = 0.09 * Math.sin(s.t * 1.3);
    const P = x => [xF + (x - xF) * Math.cos(a), Y + (x - xF) * Math.sin(a)];
    D.ground(g, 40, 292, 820);
    // trajetórias (arcos) da carga e da mão
    for (const [x, c] of [[xL, C.blue], [xE, C.red]]) { g.save(); g.strokeStyle = c; g.setLineDash([3, 4]); g.lineWidth = 1.5; g.beginPath(); g.arc(xF, Y, Math.abs(x - xF), (x < xF ? Math.PI : 0) - 0.11, (x < xF ? Math.PI : 0) + 0.11); g.stroke(); g.restore(); }
    // apoio
    if (s.cls === 1) D.path(g, [[xF, Y + 4], [xF - 26, 292], [xF + 26, 292]], C.line, 1.6, true, C.steel);
    else { D.rect(g, xF - 10, Y, 20, 292 - Y, C.steel, C.line); }
    // barra
    const [ax, ay] = P(130), [bx, by] = P(770);
    D.link(g, ax, ay, bx, by, 16, C.wood);
    D.pin(g, xF, Y, 6);
    // carga
    const [lx, ly] = P(xL);
    g.save(); g.translate(lx, ly); g.rotate(a); D.weight(g, 0, -8, 54, 44, `${s.kg} kg`); g.restore();
    D.arrow(g, lx, ly + 18, lx, ly + 70, C.blue); D.label(g, `Peso ${N(s.kg * G)}`, lx + (s.cls === 3 ? -150 : 8), ly + 64);
    // força
    const F = s.kg * G * dL / dE, up = s.cls !== 1, [ex, ey] = P(xE), len = clamp(25 + F / 30, 30, 110);
    if (up) D.arrow(g, ex, ey + len + 10, ex, ey + 10, C.red, 3); else D.arrow(g, ex, ey - len - 10, ex, ey - 10, C.red, 3);
    D.label(g, `Força ${N(F)}`, ex + (s.cls === 2 ? -120 : 10), up ? ey + len : ey - len + 4, { color: C.red });
    // cotas
    const dim = (x1, x2, y, txt, c) => { D.line(g, x1, y, x2, y, c, 1); D.line(g, x1, y - 5, x1, y + 5, c, 1); D.line(g, x2, y - 5, x2, y + 5, c, 1); D.text(g, txt, (x1 + x2) / 2, y - 5, { align: "center", size: 12, color: c }); };
    dim(Math.min(xF, xL), Math.max(xF, xL), 30, `braço da carga ${nf(dL / 310, 2)} m`, C.blue);
    dim(Math.min(xF, xE), Math.max(xF, xE), 56, `braço da força ${nf(dE / 310, 2)} m`, C.red);
  },
  info(s) {
    const { dL, dE } = this.geo(s), W = s.kg * G, F = W * dL / dE, va = dE / dL;
    const ex = { 1: "gangorra, pé de cabra, alicate, tesoura", 2: "carrinho de mão, quebra-nozes, abridor de garrafa", 3: "pinça, vara de pescar, o seu antebraço (bíceps)" }[s.cls];
    return {
      stats: [["Força necessária", N(F)], ["Vantagem mecânica", `${nf(va, 2)}×`], ["Se a carga subir 10 cm, a mão anda", `${nf(10 * va, 1)} cm`], ["Trabalho (igual dos dois lados)", `${nf(W * 0.1, 0)} J por 10 cm`]],
      cap: `<b>Momento de cada lado:</b> peso × braço da carga = força × braço da força → ${N(W)} × ${nf(dL / 310, 2)} m = ${N(F)} × ${nf(dE / 310, 2)} m. ${va >= 1 ? "A alavanca <b>ganha força</b> e perde distância." : "Aqui a alavanca <b>perde força</b>, mas ganha velocidade e alcance na ponta."} Exemplos dessa classe: ${ex}.`,
    };
  },
  explain: [
    ["Como funciona", `<ul><li>A barra gira em torno do <b>apoio</b> (fulcro).</li><li>O que importa é o <b>momento</b>: força × distância até o apoio.</li><li>Braço maior do lado da mão = menos força, mas a mão anda mais.</li></ul>`],
    ["Fórmula", `<p><span class="f">F × d<sub>F</sub> = P × d<sub>P</sub></span></p><p>Vantagem mecânica <span class="f">VM = d<sub>F</sub> / d<sub>P</sub></span>. Não existe energia de graça: <span class="f">força × caminho</span> é o mesmo dos dois lados (fora o atrito).</p>`],
    ["As 3 classes", `<ul><li><b>1ª:</b> apoio no meio — gangorra, pé de cabra.</li><li><b>2ª:</b> carga no meio — carrinho de mão: sempre ganha força.</li><li><b>3ª:</b> força no meio — pinça, braço humano: sempre perde força, ganha velocidade.</li></ul>`],
  ],
});

// ---------------- Polias e talhas ----------------
M({
  id: "polias", group: "Fundamentos", title: "Polias e talhas", icon: "🪝", short: "Mais cordas segurando a carga = menos força.",
  lead: "Cada trecho de corda que segura a polia móvel divide o peso. Segure o botão para puxar e compare quanto a mão anda e quanto a carga sobe.",
  h: 380,
  controls: [
    { k: "n", type: "seg", label: "Montagem", v: 2, options: [[1, "1 polia fixa"], [2, "1 móvel (2 cordas)"], [4, "Talha 4 cordas"], [6, "Talha 6 cordas"]] },
    { k: "kg", label: "Carga", min: 10, max: 400, v: 100, unit: "kg" },
    { k: "fr", type: "check", label: "Considerar atrito das polias (≈5% cada)", v: false },
    { k: "pull", type: "hold", label: "⬇ Segure para puxar a corda" },
  ],
  init(s) { s.rope = 0; },
  change(s, k) { if (k === "n") s.rope = 0; },
  draw(g, s, dt) {
    const n = s.n, r = 16, top = 46, x0 = 330 - (n - 1) * r;
    if (s.pull) s.rope = Math.min(s.rope + 60 * dt, 110 * n);
    else s.rope = Math.max(0, s.rope - 25 * dt * n);
    const lift = s.rope / n, yLoad = 300 - lift, yMov = yLoad - 70, yFix = top + 38;
    // teto
    D.rect(g, 150, top - 16, 420, 16, C.steelL, C.line); D.hatch(g, 150, top - 16, 420, 16, C.steelL);
    // segmentos verticais: x_j = x0 + j*2r
    const xs = Array.from({ length: n + 1 }, (_, j) => x0 + j * 2 * r);
    // polias fixas (arcos de cima) e móveis (arcos de baixo)
    const fixed = [], mov = [];
    if (n === 1) fixed.push((xs[0] + xs[1]) / 2);
    else for (let j = 0; j < n; j++) { if (j % 2 === 0) mov.push((xs[j] + xs[j + 1]) / 2); else fixed.push((xs[j] + xs[j + 1]) / 2); }
    if (n > 1) fixed.push((xs[n - 1] + xs[n]) / 2);
    const rope = (pts) => D.path(g, pts, "#8a6a3a", 3);
    // corda: começa no teto (n par) ou na carga (n=1)
    const ang = -s.rope / r; // giro das polias
    if (n === 1) { rope([[xs[0], yMov + 40], [xs[0], yFix]]); }
    else rope([[xs[0], top], [xs[0], yMov]]);
    for (let j = 1; j < n; j++) rope([[xs[j], yMov], [xs[j], yFix]]);
    // ponta livre (desce até a mão)
    const yHand = 230 + Math.min(100, s.rope * 0.35);
    rope([[xs[n], yFix], [xs[n], yHand]]);
    for (const x of fixed) { D.line(g, x, top, x, yFix, C.steelD, 3); D.pulley(g, x, yFix, r, ang); }
    if (n > 1) {
      D.rect(g, mov[0] - r - 6, yMov - 6, (mov[mov.length - 1] - mov[0]) + 2 * r + 12, 12, C.steelL, C.line);
      for (const x of mov) D.pulley(g, x, yMov, r, -ang);
      D.line(g, (mov[0] + mov[mov.length - 1]) / 2, yMov, (mov[0] + mov[mov.length - 1]) / 2, yLoad - 44, C.steelD, 3);
    }
    const cx = n === 1 ? xs[0] : (mov[0] + mov[mov.length - 1]) / 2;
    D.weight(g, cx, yLoad, 70, 46, `${s.kg} kg`);
    D.arrow(g, cx, yLoad + 6, cx, yLoad + 50, C.blue);
    // mão e força
    const F = this.force(s);
    D.circle(g, xs[n], yHand + 8, 9, "#f0c8a0", C.line);
    D.arrow(g, xs[n] + 22, yHand - 20, xs[n] + 22, yHand + 30, C.red, 3);
    D.label(g, `F = ${N(F)}`, xs[n] + 32, yHand + 10, { color: C.red });
    // contagem das cordas que seguram
    for (let j = 0; j < n; j++) D.text(g, `${j + 1}`, xs[j] + 4, (yFix + yMov) / 2, { size: 11, color: C.green, bold: true });
    // painel
    D.label(g, `Cordas segurando a carga: ${n}`, 620, 60);
    D.label(g, `Corda puxada: ${nf(s.rope / 150, 2)} m`, 620, 90, { color: C.red });
    D.label(g, `Carga subiu: ${nf(s.rope / n / 150, 2)} m`, 620, 120, { color: C.blue });
    D.ground(g, 40, 348, 820);
  },
  force(s) { const W = s.kg * G, sheaves = s.n === 1 ? 1 : s.n; return s.fr ? W / s.n / Math.pow(0.95, sheaves) : W / s.n; },
  info(s) {
    const F = this.force(s);
    return {
      stats: [["Peso da carga", N(s.kg * G)], ["Força na corda", N(F)], ["Vantagem mecânica", `${nf(s.kg * G / F, 2)}×`], ["Para subir 1 m, puxe", `${s.n} m de corda`]],
      cap: s.n === 1 ? "A polia fixa <b>não reduz a força</b> — só muda a direção (puxar para baixo é mais confortável e dá para usar o próprio peso)." : `O peso fica dividido entre <b>${s.n} trechos de corda</b> (os números verdes). Cada um segura ${N(s.kg * G / s.n)}. Em troca, para subir a carga 1 m você puxa ${s.n} m de corda.`,
    };
  },
  explain: [
    ["Como contar", `<ul><li>Conte quantos trechos de corda <b>saem da polia móvel</b> (ou da carga) — esse é o número que divide a força.</li><li>A ponta que você puxa só conta se estiver presa no bloco móvel.</li></ul>`],
    ["Fórmulas", `<p><span class="f">F = P / n</span> (ideal) · <span class="f">curso da corda = n × subida</span></p><p>Com atrito, cada polia perde alguns % — por isso talhas enormes não compensam.</p>`],
    ["Onde se usa", `<ul><li>Talhas de oficina e guinchos de motor.</li><li>Guindastes (cabos com várias “pernas”).</li><li>Varal de teto, persianas, veleiros.</li></ul>`],
  ],
});

// ---------------- Plano inclinado, cunha e parafuso ----------------
M({
  id: "plano", group: "Fundamentos", title: "Plano inclinado, cunha e parafuso", icon: "📐", short: "Rampa, cunha e rosca: a mesma ideia.",
  lead: "Subir por uma rampa exige menos força que levantar, mas o caminho é mais longo. A cunha é uma rampa que anda, e o parafuso é uma rampa enrolada.",
  h: 360,
  controls: [
    { k: "mode", type: "seg", label: "Ver", v: "rampa", options: [["rampa", "Rampa"], ["cunha", "Cunha"], ["rosca", "Parafuso (rosca)"]] },
    { k: "ang", label: "Ângulo da rampa / ponta da cunha", min: 5, max: 60, v: 20, unit: "°" },
    { k: "kg", label: "Massa", min: 10, max: 200, v: 50, unit: "kg" },
    { k: "mu", label: "Atrito (μ)", min: 0, max: 0.6, step: 0.05, v: 0.1, d: 2 },
    { k: "pitch", label: "Passo da rosca", min: 0.5, max: 5, step: 0.25, v: 1.5, unit: "mm", d: 2 },
  ],
  draw(g, s) {
    if (s.mode === "rampa") return this.rampa(g, s);
    if (s.mode === "cunha") return this.cunha(g, s);
    return this.rosca(g, s);
  },
  rampa(g, s) {
    const th = s.ang * Math.PI / 180, x0 = 120, y0 = 310, L = 520, x1 = x0 + L * Math.cos(th), y1 = y0 - L * Math.sin(th);
    D.ground(g, 40, y0, 820);
    D.path(g, [[x0, y0], [x1, y1], [x1, y0]], C.line, 1.6, true, "#e8dcc8");
    D.line(g, x1 + 30, y0, x1 + 30, y1, C.muted, 1, [4, 3]); D.text(g, `altura ${nf(Math.sin(th) * 4, 2)} m`, x1 + 36, (y0 + y1) / 2, { size: 12, color: C.muted });
    D.text(g, `${s.ang}°`, x0 + 60, y0 - 8, { size: 13 });
    const f = (s.t * 0.12) % 1, d = 40 + f * (L - 110), bx = x0 + d * Math.cos(th), by = y0 - d * Math.sin(th);
    g.save(); g.translate(bx, by); g.rotate(-th);
    D.rect(g, -28, -40, 56, 40, "#7a7a84", C.line); D.text(g, `${s.kg} kg`, 0, -15, { align: "center", color: "#fff", bold: true, size: 12 });
    g.restore();
    const cx = bx - 20 * Math.sin(th), cy = by - 20 * Math.cos(th), W = s.kg * G, sc = 0.32;
    const along = W * Math.sin(th), norm = W * Math.cos(th), F = W * (Math.sin(th) + s.mu * Math.cos(th));
    const u = [Math.cos(th), -Math.sin(th)], n = [-Math.sin(th), -Math.cos(th)];
    D.arrow(g, cx, cy, cx, cy + W * sc * 0.5, C.blue, 2.5); D.text(g, "peso", cx + 5, cy + W * sc * 0.5, { size: 11, color: C.blue });
    D.arrow(g, cx, cy, cx - u[0] * along * sc * 0.5, cy - u[1] * along * sc * 0.5, C.purple, 2.5);
    D.arrow(g, cx, cy, cx - n[0] * norm * sc * 0.5, cy - n[1] * norm * sc * 0.5, C.green, 2.5);
    const sx = cx + n[0] * 34, sy = cy + n[1] * 34;
    D.arrow(g, sx, sy, sx + u[0] * (30 + F * sc * 0.5), sy + u[1] * (30 + F * sc * 0.5), C.red, 3.5);
    D.label(g, `força para empurrar ${N(F)}`, 560, 60, { color: C.red });
    D.label(g, `componente que puxa para baixo ${N(along)}`, 560, 88, { color: C.purple });
    D.label(g, `componente contra a rampa ${N(norm)}`, 560, 116, { color: C.green });
  },
  cunha(g, s) {
    const a = s.ang * Math.PI / 180, ph = (Math.sin(s.t * 1.2) + 1) / 2, depth = 40 + ph * 90, half = Math.tan(a / 2);
    const cx = 450, top = 60, tipY = top + 70 + depth, wHalf = 70 * half + depth * half;
    // tora rachando
    const open = depth * half;
    D.ground(g, 40, 330, 820);
    for (const sgn of [-1, 1]) {
      const ox = sgn * open;
      D.path(g, [[cx + ox, 330], [cx + ox + sgn * 150, 330], [cx + ox + sgn * 150, 150], [cx + ox + sgn * 4, 150], [cx + ox, tipY]], C.line, 1.6, true, C.wood);
      for (let i = 0; i < 5; i++) D.line(g, cx + ox + sgn * (25 + i * 25), 160, cx + ox + sgn * (25 + i * 25), 320, C.woodD, 1);
    }
    D.path(g, [[cx, tipY], [cx - wHalf - 6, top], [cx + wHalf + 6, top]], C.line, 1.6, true, C.steel);
    D.arrow(g, cx, top - 40, cx, top - 4, C.red, 3); D.label(g, "martelada", cx + 10, top - 20, { color: C.red });
    const MA = 1 / (2 * Math.tan(a / 2));
    D.arrow(g, cx - open - 40, tipY - 30, cx - open - 40 - 50, tipY - 30, C.blue, 3); D.arrow(g, cx + open + 40, tipY - 30, cx + open + 40 + 50, tipY - 30, C.blue, 3);
    D.label(g, `cada lado empurra ≈ ${nf(MA, 1)}× a força da martelada`, 560, 60, { color: C.blue });
    D.text(g, `ponta ${s.ang}°`, cx + 30, top + 40, { size: 12 });
  },
  rosca(g, s) {
    const p = s.pitch, r = 60, cx = 200, ang = s.t * 2, adv = (ang / TAU) * p * 6;
    // parafuso girando (vista lateral com filetes inclinados)
    const top = 70, bottom = 320, step = p * 6;
    D.rect(g, cx - 40, top, 80, bottom - top, C.steelL, C.line);
    g.save(); g.beginPath(); g.rect(cx - 40, top, 80, bottom - top); g.clip();
    for (let y = top - 20 + ((ang / TAU) * step) % step; y < bottom + 20; y += step) D.line(g, cx - 40, y + step * 0.5, cx + 40, y, C.steelD, 2);
    g.restore();
    D.rect(g, cx - 60, top - 26, 120, 26, C.steel, C.line); // cabeça
    // porca subindo
    const ny = 260 - (adv % 150);
    D.rect(g, cx - 62, ny, 124, 30, C.oilL, C.line); D.text(g, "porca", cx, ny + 20, { align: "center", size: 12 });
    D.rot(g, cx, top - 13, 70, 1, C.red, -2.8);
    // rampa desenrolada
    const ox = 400, oy = 300, circ = 380, h = p * 60;
    D.path(g, [[ox, oy], [ox + circ, oy], [ox + circ, oy - h]], C.line, 1.6, true, "#e8dcc8");
    D.text(g, "1 volta = 2πr (circunferência)", ox + circ / 2, oy + 18, { align: "center", size: 12 });
    D.text(g, `subida = passo (${p} mm)`, ox + circ + 8, oy - h / 2, { size: 12 });
    D.text(g, "a rosca é uma rampa enrolada no cilindro", ox, 60, { size: 13, bold: true });
    const f = (s.t * 0.15) % 1;
    D.circle(g, ox + circ * f, oy - h * f - 6, 6, C.red, null);
  },
  info(s) {
    const th = s.ang * Math.PI / 180, W = s.kg * G;
    if (s.mode === "rampa") {
      const F = W * (Math.sin(th) + s.mu * Math.cos(th));
      return { stats: [["Força na rampa", N(F)], ["Levantar direto", N(W)], ["Caminho para subir 1 m", `${nf(1 / Math.sin(th), 2)} m`], ["Vantagem", `${nf(W / F, 2)}×`]],
        cap: `Na rampa, só a parte do peso <b>ao longo dela</b> (${N(W * Math.sin(th))}) precisa ser vencida, mais o atrito (μ × força contra a rampa). Rampa mais deitada = menos força, caminho mais longo.` };
    }
    if (s.mode === "cunha") {
      const MA = 1 / (2 * Math.tan(th / 2));
      return { stats: [["Vantagem (ideal)", `${nf(MA, 1)}×`], ["Ângulo da ponta", `${s.ang}°`]], cap: "Cunha fina = muita força para os lados, mas precisa entrar mais fundo. Machado, faca, formão, prego e cinzel são cunhas." };
    }
    const r = 10, MA = TAU * r / s.pitch;
    return { stats: [["Avanço por volta", `${s.pitch} mm`], ["Vantagem ideal (raio 10 mm)", `${nf(MA, 0)}×`], ["Com chave de 20 cm", `${nf(TAU * 200 / s.pitch, 0)}×`]],
      cap: "Uma volta inteira empurra a porca só um <b>passo</b>. Por isso um macaco de rosca levanta um carro com a mão — e a rosca fina segura sozinha (o atrito não deixa voltar)." };
  },
  explain: [
    ["Rampa", `<p><span class="f">F = P·(sen θ + μ·cos θ)</span></p><p>Sem atrito, <span class="f">F × comprimento = P × altura</span>: o trabalho é o mesmo.</p>`],
    ["Cunha", `<p>Transforma uma força para frente em forças para os lados. Vantagem ideal <span class="f">≈ 1 / (2·tan(α/2))</span>.</p>`],
    ["Parafuso", `<p>Vantagem ideal <span class="f">2π·r / passo</span>. Rosca fina: mais força e trava melhor. Rosca grossa: monta rápido.</p>`],
  ],
});

// ---------------- Atrito ----------------
const MATS = { aco: ["Aço com aço (seco)", 0.74, 0.57], borr: ["Borracha no asfalto", 0.9, 0.7], mad: ["Madeira com madeira", 0.5, 0.3], gelo: ["Aço no gelo", 0.1, 0.03], lub: ["Aço lubrificado", 0.16, 0.08] };
M({
  id: "atrito", group: "Fundamentos", title: "Atrito", icon: "🧱", short: "Por que as coisas resistem a deslizar.",
  lead: "Aumente a força aos poucos: o bloco não se move até vencer o atrito estático. Depois de andar, o atrito cai (cinético). O zoom mostra as asperezas se travando.",
  h: 360,
  controls: [
    { k: "mat", type: "seg", label: "Superfícies", v: "mad", options: Object.entries(MATS).map(([k, v]) => [k, v[0]]) },
    { k: "F", label: "Força aplicada", min: 0, max: 800, v: 150, unit: "N" },
    { k: "kg", label: "Massa do bloco", min: 5, max: 100, v: 40, unit: "kg" },
    { k: "roll", type: "check", label: "Colocar sobre rodinhas (atrito de rolamento)", v: false },
  ],
  init(s) { s.x = 0; s.v = 0; },
  phys(s) {
    const [, ms, mk] = MATS[s.mat], Nn = s.kg * G, st = s.roll ? 0.012 : ms, kin = s.roll ? 0.01 : mk;
    return { Nn, Fs: st * Nn, Fk: kin * Nn };
  },
  draw(g, s, dt) {
    const { Fs, Fk } = this.phys(s);
    if (s.v === 0 && s.F <= Fs) { /* parado */ } else {
      const a = (s.F - Fk) / s.kg; s.v = Math.max(0, s.v + a * dt); if (s.v === 0 && s.F <= Fs) s.v = 0;
      s.x = (s.x + s.v * dt * 60) % 700;
    }
    const y = 210, bx = 120 + s.x;
    D.ground(g, 40, y, 820);
    D.rect(g, bx, y - 70, 110, 70, "#8a8a94", C.line); D.text(g, `${s.kg} kg`, bx + 55, y - 30, { align: "center", color: "#fff", bold: true });
    if (s.roll) for (const wx of [bx + 22, bx + 88]) { D.circle(g, wx, y - 8, 8, C.rubber, C.line); }
    const fr = s.v === 0 ? Math.min(s.F, Fs) : Fk;
    D.arrow(g, bx + 110, y - 35, bx + 110 + clamp(s.F / 4, 0, 200), y - 35, C.red, 3); D.label(g, `força ${N(s.F)}`, bx + 120, y - 48, { color: C.red });
    D.arrow(g, bx, y - 6, bx - clamp(fr / 4, 0, 160), y - 6, C.blue, 3); D.label(g, `atrito ${N(fr)}`, bx - 110, y - 16, { color: C.blue });
    // zoom das asperezas
    const zx = 600, zy = 250;
    D.text(g, "zoom ×1000 no contato", zx, zy + 2, { size: 12, bold: true });
    g.save(); g.beginPath(); g.rect(zx, zy + 8, 260, 90); g.clip();
    const shift = (s.x * 3) % 40;
    D.path(g, Array.from({ length: 30 }, (_, i) => [zx - 40 + i * 12 + shift, zy + 50 + (i % 2 ? 8 : -2) + (i % 3) * 3]), C.line, 1.5, false);
    D.path(g, Array.from({ length: 30 }, (_, i) => [zx - 40 + i * 12, zy + 62 + (i % 2 ? -8 : 2) - (i % 4) * 2]), C.line, 1.5, false);
    g.restore(); D.rect(g, zx, zy + 8, 260, 90, null, C.line, 1);
    // gráfico atrito × força
    const gx = 70, gy = 255, gw = 420, gh = 90, Fmax = 800;
    const pts = [[0, 0], [Fs, Fs], [Fs + 0.01, Fk], [Fmax, Fk]];
    D.plot(g, gx, gy, gw, gh, [{ pts, color: C.blue }], { xr: [0, Fmax], yr: [0, Math.max(Fs * 1.2, 50)], title: "atrito × força aplicada", xl: "força (N)", mark: [s.F, fr] });
  },
  info(s) {
    const { Nn, Fs, Fk } = this.phys(s), moving = s.v > 0;
    return {
      stats: [["Força normal (peso)", N(Nn)], ["Atrito estático máx.", N(Fs)], ["Atrito cinético", N(Fk)], ["Estado", moving ? `deslizando (${nf(s.v, 2)} m/s)` : "parado"]],
      cap: moving ? `Andando: o atrito cai para μ<sub>c</sub>·N = ${N(Fk)}. A sobra de força acelera o bloco. Baixe a força abaixo de ${N(Fk)} para ele frear.` : `Parado: o atrito <b>iguala</b> a força (até ${N(Fs)}). Passe desse valor e o bloco “descola”.`,
    };
  },
  explain: [
    ["Estático × cinético", `<ul><li>Parado, as asperezas se encaixam: é preciso mais força para começar (<b>μ<sub>e</sub></b>).</li><li>Deslizando, sobra menos contato: o atrito cai (<b>μ<sub>c</sub></b>).</li><li>Por isso o freio ABS evita travar a roda: rolando, o pneu usa o atrito estático, maior.</li></ul>`],
    ["Fórmula", `<p><span class="f">F<sub>at</sub> ≤ μ<sub>e</sub>·N</span> (parado) · <span class="f">F<sub>at</sub> = μ<sub>c</sub>·N</span> (deslizando)</p><p>Não depende da área de contato, só da força normal e dos materiais.</p>`],
    ["Rolamento", `<p>Rodas e rolamentos trocam deslizamento por <b>rolamento</b>: o atrito cai para ~1%. É por isso que a roda foi uma revolução — e por que rolamentos estão em todo eixo.</p>`],
  ],
});

// ---------------- Torque e potência ----------------
M({
  id: "torque", group: "Fundamentos", title: "Torque, rotação e potência", icon: "🔧", short: "Força que gira e quanto trabalho por segundo.",
  lead: "Torque é força × distância até o eixo. Potência é torque × rotação. Use a chave para soltar o parafuso e veja por que cabo comprido ajuda.",
  h: 360,
  controls: [
    { k: "F", label: "Força na mão", min: 50, max: 600, v: 200, unit: "N" },
    { k: "L", label: "Comprimento da chave", min: 10, max: 60, v: 25, unit: "cm" },
    { k: "ang", label: "Ângulo da força com o cabo", min: 10, max: 90, v: 90, unit: "°" },
    { k: "tight", label: "Aperto do parafuso", min: 20, max: 200, v: 80, unit: "N·m" },
    { k: "rpm", label: "Rotação do motor (à direita)", min: 500, max: 7000, step: 100, v: 3000, unit: "rpm" },
    { k: "Tm", label: "Torque do motor", min: 20, max: 400, v: 150, unit: "N·m" },
  ],
  init(s) { s.turn = 0; s.mot = 0; },
  change(s) { s.turn = 0; },
  draw(g, s, dt) {
    const T = s.F * s.L / 100 * Math.sin(s.ang * Math.PI / 180), loose = T >= s.tight;
    if (loose) s.turn = Math.min(s.turn + dt * 0.8, 1.2);
    const cx = 200, cy = 190, a = -0.4 - s.turn * 0.9, len = s.L * 8;
    D.circle(g, cx, cy, 34, C.steelL, C.line); // cabeça sextavada vista de cima
    g.save(); g.translate(cx, cy); g.rotate(a);
    D.path(g, Array.from({ length: 6 }, (_, i) => [Math.cos(i * TAU / 6) * 22, Math.sin(i * TAU / 6) * 22]), C.line, 1.5, true, C.steel);
    D.link(g, 0, 0, len, 0, 22, "#b8bec6"); D.circle(g, 0, 0, 30, null, C.line, 2);
    // força na ponta
    const fa = a - Math.PI / 2, fr = -s.ang * Math.PI / 180;
    g.restore();
    const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len, dir = a + fr + Math.PI;
    const fl = 30 + s.F / 6;
    D.arrow(g, ex - Math.cos(dir) * fl, ey - Math.sin(dir) * fl, ex, ey, C.red, 3);
    D.label(g, `${N(s.F)}`, ex + 8, ey - 20, { color: C.red });
    D.rot(g, cx, cy, 50, -1, loose ? C.green : C.muted, 0.6);
    D.label(g, loose ? "soltou!" : "não solta", cx - 40, cy + 75, { color: loose ? C.green : C.red, bold: true });
    void fa;
    // motor e potência
    const P = s.Tm * s.rpm * TAU / 60, mx = 650, my = 190;
    s.mot += dt * s.rpm / 60 * TAU * 0.05;
    D.rect(g, mx - 160, my - 50, 110, 100, C.steelD, C.line); D.text(g, "motor", mx - 105, my + 5, { align: "center", color: "#fff" });
    D.rect(g, mx - 50, my - 8, 90, 16, C.steel, C.line);
    D.pulley(g, mx + 70, my, 50, s.mot);
    D.label(g, `${nf(P / 1000, 1)} kW = ${nf(P / 735.5, 0)} cv`, mx - 160, my + 90, { bold: true });
    D.text(g, "girando mais rápido no desenho = mais rpm (câmera bem lenta)", mx - 160, my - 70, { size: 11, color: C.muted });
  },
  info(s) {
    const T = s.F * s.L / 100 * Math.sin(s.ang * Math.PI / 180), P = s.Tm * s.rpm * TAU / 60;
    return {
      stats: [["Torque na chave", `${nf(T, 1)} N·m`], ["Precisa para soltar", `${s.tight} N·m`], ["Força mínima (90°)", N(s.tight / (s.L / 100))], ["Potência do motor", `${nf(P / 1000, 1)} kW (${nf(P / 735.5, 0)} cv)`]],
      cap: `Torque = força × braço × sen(ângulo) = ${N(s.F)} × ${nf(s.L / 100, 2)} m × ${nf(Math.sin(s.ang * Math.PI / 180), 2)}. Empurrar <b>perpendicular</b> ao cabo (90°) aproveita tudo; inclinado, parte da força só puxa o cabo.`,
    };
  },
  explain: [
    ["Torque", `<p><span class="f">T = F × r × sen θ</span> (N·m). Um cano de extensão na chave dobra o torque com a mesma força — e é assim que se quebra parafuso.</p>`],
    ["Potência", `<p><span class="f">P = T × ω</span>, com <span class="f">ω = 2π × rpm / 60</span>. Em kW: <span class="f">P = T × rpm / 9549</span>. 1 cv ≈ 0,7355 kW.</p>`],
    ["Torque × potência no carro", `<ul><li>Torque alto em baixa rotação = arranca forte (diesel, motor elétrico).</li><li>Potência = o quanto ele mantém de força em rotação alta (velocidade final).</li><li>A caixa de câmbio troca rotação por torque (veja Engrenagens).</li></ul>`],
  ],
});
