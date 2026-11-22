// MechLab — Hidráulica (água): pressão e profundidade, Pascal, vazão e Bernoulli, bombas, sifão e golpe de aríete.
"use strict";
const RHO = 1000, GG = 9.81;
const bar = p => `${nf(p / 1e5, 2)} bar`;

// ---------------- Pressão e profundidade ----------------
M({
  id: "pressao", group: "Hidráulica (água)", title: "Pressão e profundidade", icon: "🌊", short: "Quanto mais fundo, mais pressão — não importa a forma.",
  lead: "A pressão da água só depende da altura da coluna acima do ponto. Por isso o jato de baixo sai mais forte, os vasos comunicantes ficam no mesmo nível e a caixa d'água precisa ficar alta.",
  h: 380, hint: "No modo tanque, passe o mouse dentro da água para medir a pressão.",
  controls: [
    { k: "mode", type: "seg", label: "Ver", v: "tanque", options: [["tanque", "Tanque com furos"], ["vasos", "Vasos comunicantes"], ["caixa", "Caixa d'água e chuveiro"]] },
    { k: "h", label: "Altura da água (tanque) / altura do pé da caixa", min: 1, max: 10, step: 0.5, v: 4, unit: "m", d: 1 },
  ],
  init(s) { s.probe = null; },
  pointer(s, x, y) { s.probe = [x, y]; },
  draw(g, s) {
    if (s.mode === "tanque") {
      const x0 = 160, w = 200, bottom = 330, top = 40, hpx = (bottom - top) * s.h / 10, surf = bottom - hpx, mpp = (bottom - top) / 10;
      D.rect(g, x0, surf, w, hpx, C.waterL, null);
      D.path(g, [[x0, top], [x0, bottom], [x0 + w, bottom], [x0 + w, top]], C.line, 3);
      // furos e jatos (Torricelli)
      for (const fy of [0.3, 0.6, 0.9].map(f => surf + (bottom - surf) * f)) {
        const depth = (fy - surf) / mpp, v = Math.sqrt(2 * GG * depth), pts = [];
        for (let t = 0; t < 2; t += 0.02) { const X = x0 + w + v * t * mpp * 1.2, Y = fy + 0.5 * GG * t * t * mpp * 1.2; if (Y > 360) break; pts.push([X, Y]); }
        D.path(g, pts, C.water, 4); D.flow(g, pts, "#fff", 2, s.t, 1.5, [4, 10]);
        D.text(g, `${nf(depth, 1)} m → ${nf(v, 1)} m/s`, x0 + w + 8, fy - 6, { size: 11, color: C.blue });
      }
      D.ground(g, 100, 360, 760);
      if (s.probe && s.probe[0] > x0 && s.probe[0] < x0 + w && s.probe[1] > surf && s.probe[1] < bottom) {
        const d = (s.probe[1] - surf) / mpp;
        D.circle(g, ...s.probe, 6, C.red, C.line); D.label(g, `${nf(d, 2)} m: ${bar(RHO * GG * d)} (+ ${nf(d, 1)} mca)`, s.probe[0] + 10, s.probe[1] - 8, { color: C.red });
      }
      D.gauge(g, 700, 120, 46, s.h / 10, `fundo: ${bar(RHO * GG * s.h)}`);
    } else if (s.mode === "vasos") {
      const bottom = 320, level = bottom - 22 * s.h;
      D.rect(g, 100, bottom, 700, 30, C.waterL, null); D.path(g, [[100, bottom], [100, bottom + 30], [800, bottom + 30], [800, bottom]], C.line, 3);
      const shapes = [[[120, 60], [200, 60]], [[300, 60], [330, 60]], [[430, 60], [530, 60]], [[620, 60], [780, 60]]];
      const cols = [[120, 200, 0], [300, 330, 0], [430, 530, 0.4], [620, 780, -0.3]];
      for (const [a, b, sk] of cols) {
        const top = 40, skew = sk * (bottom - top);
        D.path(g, [[a, bottom], [a + skew * 0, top], [b + skew, top], [b, bottom]].slice(0, 0), null);
        g.save(); g.beginPath(); g.moveTo(a, bottom); g.lineTo(a - skew / 2, top); g.lineTo(b + skew / 2, top); g.lineTo(b, bottom); g.closePath(); g.clip();
        g.fillStyle = C.waterL; g.fillRect(0, level, 900, bottom - level); g.restore();
        D.path(g, [[a, bottom], [a - skew / 2, top]], C.line, 3); D.path(g, [[b, bottom], [b + skew / 2, top]], C.line, 3);
      }
      void shapes;
      D.line(g, 80, level, 820, level, C.red, 1.5, [6, 4]); D.text(g, "mesmo nível em todos", 820, level - 6, { align: "right", size: 12, color: C.red });
    } else {
      const gy = 350, ppm = 26, tb = gy - s.h * ppm, tt = tb - 0.8 * ppm, showerY = gy - 2.2 * ppm, sx = 700, head = Math.max(0, s.h + 0.8 - 2.2);
      D.line(g, 150, tb, 150, gy, C.line, 2); D.line(g, 250, tb, 250, gy, C.line, 2);
      D.rect(g, 130, tt, 140, tb - tt, C.waterL, C.line, 2); D.text(g, "caixa d'água", 200, tt - 8, { align: "center", size: 12 });
      D.pipe(g, [[200, tb], [200, gy - 20], [sx - 60, gy - 20], [sx - 60, showerY], [sx - 10, showerY]], C.waterL, 10);
      D.path(g, [[sx - 12, showerY - 10], [sx + 20, showerY - 10], [sx + 20, showerY + 8], [sx - 12, showerY + 8]], C.line, 1.5, true, C.steel);
      if (head > 0.05) for (let i = 0; i < 9; i++) { const ox = sx - 8 + i * 3.5; D.flow(g, [[ox, showerY + 8], [ox - 12 + i * 3, showerY + 30 + Math.sqrt(head) * 18]], C.water, 2, s.t, 0.6 + Math.sqrt(head), [5, 7]); }
      D.line(g, 280, tt, 820, tt, C.red, 1, [4, 3]); D.line(g, sx + 20, showerY, 820, showerY, C.red, 1, [4, 3]);
      D.line(g, 810, tt, 810, showerY, C.red, 1.5); D.text(g, `${nf(head, 1)} m de desnível`, 800, (tt + showerY) / 2, { size: 12, color: C.red, align: "right" });
      D.text(g, "chuveiro (2,2 m)", sx + 4, showerY - 16, { align: "center", size: 11 });
      D.ground(g, 60, gy, 800);
      D.gauge(g, 470, 110, 36, head / 8, `${nf(head, 1)} mca no chuveiro`);
    }
  },
  info(s) {
    const p = RHO * GG * s.h;
    if (s.mode === "caixa") { const d = Math.max(0, s.h + 0.8 - 2.2); return { stats: [["Pressão no chuveiro", `${nf(d, 1)} mca = ${bar(RHO * GG * d)}`], ["Recomendado", "≥ 1 mca (chuveiro elétrico) · ≥ 10 mca para aquecedor a gás"]], cap: "Cada metro de altura dá 1 metro de coluna d'água (mca) ≈ 0,1 bar. Se o chuveiro está fraco, subir a caixa ou usar pressurizador resolve — cano mais grosso ajuda na vazão, mas não cria pressão." }; }
    return { stats: [["Pressão no fundo", `${bar(p)} (${nf(s.h, 1)} mca)`], ["Pressão por metro", "0,098 bar (≈ 0,1)"], ["Velocidade do jato no fundo", `${nf(Math.sqrt(2 * GG * s.h), 1)} m/s`]],
      cap: s.mode === "vasos" ? "Formatos diferentes, mesmo nível: a pressão no fundo só depende da altura, então a água se acomoda até a altura ficar igual. É o princípio da mangueira de nível do pedreiro." : "<span class=\"f\">p = ρ·g·h</span>. O jato de baixo tem mais pressão atrás dele e sai mais rápido (Torricelli: <span class=\"f\">v = √(2gh)</span>). A 10 m de profundidade a pressão já é 1 bar a mais." };
  },
  explain: [
    ["Fórmula", `<p><span class="f">p = ρ × g × h</span> — água: 1000 kg/m³ × 9,81 × h. 10 m de água ≈ 1 bar ≈ 1 atmosfera.</p>`],
    ["Unidades", `<ul><li>1 bar = 100 kPa ≈ 14,5 psi ≈ 10,2 mca.</li><li>mca = metro de coluna d'água (usado em encanamento).</li></ul>`],
    ["Paradoxo hidrostático", `<p>Um tubo fino de 10 m em cima de um barril exerce no fundo a mesma pressão que um tanque largo de 10 m. A força no fundo é pressão × área do fundo.</p>`],
  ],
});

// ---------------- Pascal e prensa hidráulica ----------------
M({
  id: "pascal", group: "Hidráulica (água)", title: "Princípio de Pascal e prensa hidráulica", icon: "🏋️", short: "Pistão pequeno empurrando um grande.",
  lead: "Empurrar o pistão pequeno cria uma pressão que chega igual no pistão grande. Como a área é maior, a força também é — mas ele anda bem menos. Segure o botão para bombear.",
  h: 380,
  controls: [
    { k: "F", label: "Força no pistão pequeno", min: 50, max: 500, step: 10, v: 200, unit: "N" },
    { k: "d1", label: "Diâmetro do pistão pequeno", min: 10, max: 60, v: 20, unit: "mm" },
    { k: "d2", label: "Diâmetro do pistão grande", min: 60, max: 250, v: 150, unit: "mm" },
    { k: "pump", type: "hold", label: "⬇ Segure para empurrar" },
  ],
  init(s) { s.x1 = 0; s.x2 = 0; },
  calc(s) { const A1 = Math.PI * (s.d1 / 2000) ** 2, A2 = Math.PI * (s.d2 / 2000) ** 2, p = s.F / A1; return { A1, A2, p, F2: p * A2, ratio: A2 / A1 }; },
  draw(g, s, dt) {
    const c = this.calc(s);
    if (s.pump) s.x1 = Math.min(s.x1 + 60 * dt, 140); else s.x1 = Math.max(0, s.x1 - 60 * dt);
    const w1 = clamp(s.d1 * 0.9, 12, 54), w2 = clamp(s.d2 * 0.9, 54, 225), rise = s.x1 / c.ratio;
    const base = 300, x1 = 180, x2 = 560, liq = C.waterL;
    // reservatório em U
    D.rect(g, x1 - w1 / 2, 120 + s.x1 * 0.6, w1, base - 120 - s.x1 * 0.6, liq, null);
    D.rect(g, x2 - w2 / 2, 200 - rise * 0.6, w2, base - 200 + rise * 0.6, liq, null);
    D.rect(g, x1 - w1 / 2, base, x2 + w2 / 2 - (x1 - w1 / 2), 40, liq, null);
    D.path(g, [[x1 - w1 / 2, 60], [x1 - w1 / 2, base + 40], [x2 + w2 / 2, base + 40], [x2 + w2 / 2, 100]], C.line, 3);
    D.path(g, [[x1 + w1 / 2, 60], [x1 + w1 / 2, base], [x2 - w2 / 2, base], [x2 - w2 / 2, 100]], C.line, 3);
    // pistões
    D.rect(g, x1 - w1 / 2 + 2, 110 + s.x1 * 0.6, w1 - 4, 12, C.steel, C.line); D.line(g, x1, 110 + s.x1 * 0.6, x1, 40 + s.x1 * 0.6, C.steelD, 6);
    D.arrow(g, x1, 0 + s.x1 * 0.6, x1, 36 + s.x1 * 0.6, C.red, 3); D.label(g, `${s.F} N`, x1 + 12, 26 + s.x1 * 0.6, { color: C.red });
    const py = 188 - rise * 0.6;
    D.rect(g, x2 - w2 / 2 + 2, py, w2 - 4, 14, C.steel, C.line);
    D.weight(g, x2, py, Math.min(w2, 160), 46, `${nf(c.F2 / GG, 0)} kg`);
    D.arrow(g, x2 + w2 / 2 + 30, py + 40, x2 + w2 / 2 + 30, py - 10, C.green, 4); D.label(g, `${nf(c.F2 / 1000, 2)} kN`, x2 + w2 / 2 + 40, py + 20, { color: C.green });
    D.gauge(g, 380, 210, 34, c.p / 30e5, bar(c.p));
    D.label(g, `pistão pequeno desceu ${nf(s.x1 / 3, 0)} mm → grande subiu ${nf(rise / 3, 2)} mm`, 40, 368);
  },
  info(s) {
    const c = this.calc(s);
    return { stats: [["Pressão (igual em todo o líquido)", bar(c.p)], ["Força no pistão grande", `${nf(c.F2, 0)} N (${nf(c.F2 / GG, 0)} kg)`], ["Multiplicação", `${nf(c.ratio, 1)}× (razão das áreas)`], ["Curso do grande", `1/${nf(c.ratio, 0)} do pequeno`]],
      cap: "A força é multiplicada pela razão das <b>áreas</b> (o quadrado da razão dos diâmetros). Diâmetro 3× maior = área 9× maior = força 9×. O volume que sai de um lado entra no outro, então o pistão grande anda 9× menos." };
  },
  explain: [
    ["Pascal", `<p>Uma pressão aplicada num líquido parado e fechado chega igual a todos os pontos dele.</p><p><span class="f">F₂ = F₁ × A₂ / A₁</span></p>`],
    ["Onde se usa", `<ul><li>Macaco hidráulico, elevador de oficina, prensa.</li><li>Freio do carro, direção hidráulica.</li><li>Máquinas pesadas (escavadeira).</li></ul>`],
    ["Por que óleo e não água", `<p>Óleo lubrifica, não enferruja, não ferve fácil e veda melhor. A física é a mesma.</p>`],
  ],
});

// ---------------- Vazão, continuidade e Bernoulli ----------------
M({
  id: "bernoulli", group: "Hidráulica (água)", title: "Vazão, continuidade e Bernoulli", icon: "💨", short: "No estreitamento a água acelera e a pressão cai.",
  lead: "Pela mesma vazão, o cano fino obriga a água a andar mais rápido. Essa velocidade “custa” pressão: os tubinhos mostram a pressão caindo no estreitamento (efeito Venturi).",
  h: 360,
  controls: [
    { k: "Q", label: "Vazão", min: 0.2, max: 3, step: 0.1, v: 1.2, unit: "L/s", d: 1 },
    { k: "r", label: "Estreitamento (diâmetro)", min: 25, max: 100, v: 50, unit: "% do cano" },
  ],
  init(s) { s.parts = Array.from({ length: 70 }, () => ({ x: Math.random() * 760 + 70, y: Math.random() })); },
  geo(s) { const D1 = 0.04, D2 = D1 * s.r / 100, A1 = Math.PI * D1 * D1 / 4, A2 = Math.PI * D2 * D2 / 4, Q = s.Q / 1000; return { D1, D2, v1: Q / A1, v2: Q / A2, A1, A2 }; },
  draw(g, s, dt) {
    const gm = this.geo(s), cy = 230, H1 = 70, H2 = H1 * s.r / 100;
    const halfAt = x => { if (x < 330) return H1 / 2; if (x < 400) return lerp(H1 / 2, H2 / 2, (x - 330) / 70); if (x < 500) return H2 / 2; if (x < 600) return lerp(H2 / 2, H1 / 2, (x - 500) / 100); return H1 / 2; };
    const top = [], bot = []; for (let x = 70; x <= 830; x += 5) { top.push([x, cy - halfAt(x)]); bot.push([x, cy + halfAt(x)]); }
    D.path(g, [...top, ...bot.reverse()], null, 0, true, C.waterL); D.path(g, top, C.line, 3); D.path(g, bot, C.line, 3);
    // partículas: velocidade proporcional a 1/área local
    for (const p of s.parts) {
      const h = halfAt(p.x), vloc = gm.v1 * (H1 / 2) ** 2 / (h * h);
      p.x += vloc * dt * 40; if (p.x > 830) { p.x = 70; p.y = Math.random(); }
      D.circle(g, p.x, cy - h + p.y * 2 * h, 3, C.blue, null);
    }
    // tubos piezométricos
    const p1 = 3e4, pAt = v => p1 - 0.5 * RHO * (v * v - gm.v1 * gm.v1);
    for (const [x, v, lab] of [[180, gm.v1, "1"], [450, gm.v2, "2"], [720, gm.v1, "3"]]) {
      const h = halfAt(x), p = pAt(v), col = clamp(p / 3e4 * 130, 0, 150);
      D.rect(g, x - 8, cy - h - 150, 16, 150, null, C.line, 1.5); D.rect(g, x - 7, cy - h - col, 14, col, C.waterL, null);
      D.text(g, `${lab}: ${nf(v, 1)} m/s`, x, cy + 70, { align: "center", size: 12, color: C.blue });
      D.text(g, p > 0 ? `${nf(p / 1000, 1)} kPa` : "sucção!", x + 12, cy - h - col + 4, { size: 11, color: p > 0 ? C.ink : C.red });
    }
  },
  info(s) {
    const gm = this.geo(s), dp = 0.5 * RHO * (gm.v2 ** 2 - gm.v1 ** 2);
    return { stats: [["Velocidade no cano", `${nf(gm.v1, 2)} m/s`], ["Velocidade no estreitamento", `${nf(gm.v2, 2)} m/s`], ["Queda de pressão", `${nf(dp / 1000, 1)} kPa`], ["A₁·v₁ = A₂·v₂", `${nf(s.Q, 1)} L/s`]],
      cap: "<b>Continuidade:</b> a água que entra tem que sair — se a área cai pela metade, a velocidade dobra. <b>Bernoulli:</b> a energia total se conserva, então quando a velocidade sobe a pressão desce. Se cair demais, vira sucção (é assim que o carburador e o borrifador puxam o líquido)." };
  },
  explain: [
    ["Fórmulas", `<p><span class="f">Q = A × v</span> · <span class="f">p + ½ρv² + ρgh = constante</span></p>`],
    ["No dia a dia", `<ul><li>Dedo na ponta da mangueira: jato mais rápido (a vazão quase não muda).</li><li>Venturi do carburador, injetor de ar do aquário.</li><li>Asa de avião, chuveirinho que “gruda” na cortina.</li></ul>`],
    ["Perda de carga", `<p>Na vida real, atrito nas paredes, curvas e registros “gastam” pressão. Cano longo e fino = pouca pressão na ponta.</p>`],
  ],
});

// ---------------- Bombas ----------------
M({
  id: "bombas", group: "Hidráulica (água)", title: "Bombas: centrífuga, engrenagens e pistão", icon: "⛽", short: "Como se empurra um líquido.",
  lead: "A centrífuga joga a água para fora girando rápido (muita vazão, pressão moderada). As de deslocamento positivo — engrenagens e pistão — prendem um volume e empurram à força (pressão alta).",
  h: 380,
  controls: [
    { k: "tipo", type: "seg", label: "Tipo", v: "cent", options: [["cent", "Centrífuga"], ["engr", "Engrenagens"], ["pist", "Pistão com válvulas"]] },
    { k: "rpm", label: "Rotação", min: 10, max: 100, v: 40, unit: "% (desenho)" },
  ],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * s.rpm / 30;
    if (s.tipo === "cent") {
      const cx = 380, cy = 200, R = 110;
      D.pipe(g, [[60, cy], [cx - 20, cy]], C.waterL, 40); D.pipe(g, [[cx + R - 10, cy - R + 20], [cx + R + 60, cy - R + 20], [cx + R + 60, 30]], C.waterL, 40);
      g.save(); g.beginPath(); g.arc(cx, cy, R + 14, 0, TAU); g.fillStyle = C.waterL; g.fill(); g.strokeStyle = C.line; g.lineWidth = 3; g.stroke(); g.restore();
      g.save(); g.translate(cx, cy); g.rotate(s.a);
      for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * TAU / 6); g.strokeStyle = C.steelD; g.lineWidth = 6; g.beginPath(); g.moveTo(20, 0); g.quadraticCurveTo(60, -10, R - 6, -35); g.stroke(); g.restore(); }
      D.circle(g, 0, 0, 20, C.steel, C.line); g.restore();
      for (let i = 0; i < 6; i++) { const a = s.a * 1.5 + i * TAU / 6, rr = ((s.t * 50 + i * 20) % 100) + 20; D.circle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4, C.blue, null); }
      D.flow(g, [[60, cy], [cx - 20, cy]], C.blue, 3, s.t, s.rpm / 30); D.flow(g, [[cx + R + 60, cy - R + 20], [cx + R + 60, 30]], C.blue, 3, s.t, s.rpm / 30);
      D.text(g, "entra no centro", 70, cy - 30, { size: 12 }); D.text(g, "sai pela voluta", cx + R + 80, 60, { size: 12 });
    } else if (s.tipo === "engr") {
      const cx = 420, cy = 200, r = 70;
      D.rect(g, cx - 160, cy - 110, 320, 220, C.waterL, C.line, 3);
      D.pipe(g, [[cx, cy + 110], [cx, cy + 170]], C.waterL, 36); D.pipe(g, [[cx, cy - 110], [cx, cy - 170]], C.waterL, 36);
      D.gear(g, cx - r, cy, r, 12, s.a, C.steel, { mark: false }); D.gear(g, cx + r, cy, r, 12, D.mesh(s.a, 12, 12), C.steel, { mark: false });
      for (let i = 0; i < 4; i++) { const t = (s.t * s.rpm / 60 + i / 4) % 1, a = Math.PI / 2 + t * Math.PI; D.circle(g, cx - r + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), 5, C.blue, null); D.circle(g, cx + r - Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), 5, C.blue, null); }
      D.text(g, "entrada (baixo) → o óleo vai preso entre os dentes e a carcaça, pelos lados → saída (cima)", 450, 360, { align: "center", size: 12 });
    } else {
      const ph = s.a % TAU, x = 300 + Math.cos(ph) * 70, suction = Math.sin(ph) > 0;
      D.rect(g, 330, 160, 260, 80, C.waterL, C.line, 3); D.rect(g, 170, 160, 160, 80, "#fff", C.line, 3);
      D.rect(g, x - 20, 162, 40, 76, C.steel, C.line); D.line(g, x - 20, 200, 80, 200, C.steelD, 8);
      D.pipe(g, [[460, 240], [460, 330]], C.waterL, 30); D.pipe(g, [[460, 160], [460, 60], [700, 60]], C.waterL, 30);
      const valve = (x, y, open, lab) => { D.rect(g, x - 18, y - 6 + (open ? (lab === "entrada" ? -10 : -10) : 0), 36, 10, open ? C.green : C.red, C.line); D.text(g, `${lab}: ${open ? "aberta" : "fechada"}`, x + 26, y + 4, { size: 11, color: open ? C.green : C.red }); };
      valve(460, 250, suction, "entrada"); valve(460, 150, !suction, "saída");
      if (suction) D.flow(g, [[460, 330], [460, 240]], C.blue, 3, s.t, 2); else D.flow(g, [[460, 160], [460, 60], [700, 60]], C.blue, 3, s.t, 2);
      D.label(g, suction ? "pistão recua: cria sucção, a válvula de baixo abre" : "pistão avança: empurra, a válvula de cima abre", 520, 330);
    }
  },
  info(s) {
    const c = { cent: "Centrífuga: o rotor dá velocidade à água e a voluta transforma velocidade em pressão. Vazão alta, pressão moderada — bombas d'água de casa, piscina, carro. Não funciona “a seco”: precisa escorvar (encher de água).", engr: "Engrenagens: deslocamento positivo — cada volta empurra um volume fixo, quase independente da pressão. Base dos sistemas hidráulicos de óleo e da bomba de óleo do motor.", pist: "Pistão: o mais forte de todos (lavadoras de alta pressão, bombas injetoras). As válvulas de retenção garantem que o líquido só vá num sentido." }[s.tipo];
    return { stats: [["Família", s.tipo === "cent" ? "dinâmica (turbobomba)" : "deslocamento positivo"], ["Se a saída for fechada", s.tipo === "cent" ? "a pressão sobe só um pouco e a água esquenta" : "a pressão dispara — precisa de válvula de alívio!"]], cap: c };
  },
  explain: [
    ["Altura manométrica", `<p>A bomba centrífuga é especificada por vazão × altura (mca). Quanto mais alto precisa empurrar, menos vazão ela dá (curva da bomba).</p>`],
    ["Cavitação", `<p>Se a sucção for difícil demais (bomba muito acima da água, cano fino), a pressão cai tanto que a água ferve a frio: bolhas implodem e comem o rotor. Barulho de “cascalho”.</p>`],
  ],
});

// ---------------- Sifão e golpe de aríete ----------------
M({
  id: "sifao", group: "Hidráulica (água)", title: "Sifão e golpe de aríete", icon: "🚰", short: "Água subindo sozinha e o “martelo” no cano.",
  lead: "O sifão funciona enquanto a saída estiver abaixo do nível de entrada: o peso da coluna maior puxa a menor. Já fechar uma torneira de uma vez para a água em movimento e cria um pico de pressão.",
  h: 380,
  controls: [
    { k: "mode", type: "seg", label: "Ver", v: "sifao", options: [["sifao", "Sifão"], ["ariete", "Golpe de aríete"]] },
    { k: "out", label: "Altura da saída do sifão", min: 60, max: 300, v: 250, unit: "px" },
    { k: "tclose", label: "Tempo para fechar a válvula", min: 0.05, max: 3, step: 0.05, v: 0.1, unit: "s", d: 2 },
    { k: "close", type: "hold", label: "Segure para fechar a válvula" },
  ],
  init(s) { s.lvl = 150; s.wave = -1; s.v = 1; s.peak = 0; },
  draw(g, s, dt) {
    if (s.mode === "sifao") {
      const tankTop = 80, tankBot = 260, outY = 380 - s.out * 0.6 + 0, level = s.lvl;
      const flowing = outY > level + 4;
      if (flowing) s.lvl = Math.min(tankBot - 10, s.lvl + dt * 6); else if (s.lvl > 120) s.lvl -= 0;
      if (s.lvl >= tankBot - 12) s.lvl = 110;
      D.rect(g, 100, level, 200, tankBot - level, C.waterL, null); D.path(g, [[100, tankTop], [100, tankBot], [300, tankBot], [300, tankTop]], C.line, 3);
      D.pipe(g, [[220, tankBot - 30], [220, 40], [500, 40], [500, outY]], flowing ? C.waterL : "#eef", 14);
      if (flowing) { D.flow(g, [[220, tankBot - 30], [220, 40], [500, 40], [500, outY]], C.blue, 3, s.t, 1.5); D.flow(g, [[500, outY], [500, 370]], C.water, 4, s.t, 2); }
      D.line(g, 80, level, 560, level, C.red, 1, [5, 4]); D.text(g, "nível da água", 570, level + 4, { size: 12, color: C.red });
      D.line(g, 480, outY, 640, outY, C.muted, 1, [3, 3]); D.text(g, flowing ? "saída abaixo do nível: escoa" : "saída acima do nível: para", 650, outY + 4, { size: 12, color: flowing ? C.green : C.red });
      D.text(g, "máx. ~10 m acima do nível (pressão atmosférica)", 230, 30, { size: 11, color: C.muted });
    } else {
      const x0 = 80, x1 = 720, y = 200, a = 1200; // velocidade da onda (m/s) simbólica
      const target = s.close ? 0 : 1;
      const rate = 1 / Math.max(0.05, s.tclose);
      const prev = s.v; s.v = s.close ? Math.max(0, s.v - rate * dt) : Math.min(1, s.v + dt * 0.8);
      const dv = prev - s.v; if (dv > 0) { s.wave = 0; s.peak = Math.max(s.peak * 0.98, dv / dt * 0.08); }
      if (s.wave >= 0) { s.wave += dt * 1.2; if (s.wave > 3) { s.wave = -1; s.peak = 0; } }
      void a; void target;
      D.rect(g, 40, 120, 60, 160, C.waterL, C.line, 3); D.text(g, "reservatório", 70, 300, { align: "center", size: 12 });
      D.pipe(g, [[100, y], [x1, y]], C.waterL, 26);
      if (s.v > 0.02) D.flow(g, [[100, y], [x1, y]], C.blue, 3, s.t, s.v * 2);
      // onda de pressão indo e voltando
      if (s.wave >= 0) {
        const f = s.wave % 2, pos = f < 1 ? x1 - f * (x1 - x0) : x0 + (f - 1) * (x1 - x0), amp = Math.min(1, s.peak) * Math.exp(-s.wave * 0.6);
        g.save(); g.fillStyle = `rgba(198,40,40,${0.25 + amp * 0.6})`; g.fillRect(Math.min(pos, x1), y - 13, Math.abs(x1 - pos) * (f < 1 ? 1 : 0) + (f < 1 ? 0 : x1 - pos), 26); g.restore();
        D.line(g, pos, y - 30, pos, y + 30, C.red, 3);
      }
      D.rect(g, x1, y - 30, 30, 60, s.v < 0.05 ? C.red : C.green, C.line); D.text(g, "válvula", x1 + 15, y + 50, { align: "center", size: 12 });
      D.gauge(g, x1 - 80, 90, 34, clamp(0.15 + (s.wave >= 0 ? Math.min(1, s.peak) * Math.exp(-s.wave * 0.6) * Math.abs(Math.cos(s.wave * Math.PI)) : 0), 0, 1), "pressão perto da válvula");
    }
  },
  info(s) {
    if (s.mode === "sifao") return { stats: [], cap: "No sifão, o lado que desce é mais comprido: o peso dessa coluna puxa a água pelo topo (a pressão atmosférica empurra a água do tanque para cima, como num canudo). É assim que se esvazia aquário, tanque de combustível e a caixa acoplada do vaso sanitário." };
    const sp = s.tclose < 0.5;
    return { stats: [["Fechamento", sp ? "rápido: golpe forte" : "lento: golpe pequeno"]], cap: "Fechar de uma vez para a água que vinha correndo: a energia vira um pico de pressão que corre pelo cano até o reservatório e volta várias vezes (as “marteladas” no cano). Válvulas de fechamento lento, câmaras de ar e cano com curvas suaves evitam o golpe." };
  },
  explain: [
    ["Golpe de aríete", `<p>Pico de pressão (Joukowsky): <span class="f">Δp = ρ × a × Δv</span>, com a ≈ 1000–1400 m/s em cano rígido. Parar 1 m/s dá ~10 bar a mais!</p>`],
    ["Carneiro hidráulico", `<p>Bomba sem motor que usa o golpe de aríete de propósito: a água que desce de um riacho é parada várias vezes por minuto e o pico empurra uma parte dela bem mais para cima.</p>`],
  ],
});
