// MechLab — Pneumática: ar comprimido (compressor e FRL), cilindro com válvula 5/2 e lógica, compressibilidade (Boyle) e vácuo.
"use strict";

// ---------------- Ar comprimido ----------------
M({
  id: "arcomp", group: "Pneumática", title: "Ar comprimido: compressor e FRL", icon: "🌬️", short: "Do compressor até a ferramenta.",
  lead: "O compressor enche o reservatório até a pressão de desligar; o consumo baixa a pressão e ele liga de novo. Antes da ferramenta, o FRL filtra a água, regula a pressão e lubrifica.",
  h: 380,
  controls: [
    { k: "use", label: "Consumo da ferramenta", min: 0, max: 100, v: 40, unit: "%" },
    { k: "reg", label: "Pressão no regulador", min: 1, max: 8, step: 0.5, v: 6, unit: "bar", d: 1 },
  ],
  init(s) { s.p = 5; s.on = true; s.a = 0; s.water = 0; },
  draw(g, s, dt) {
    if (s.p >= 8.5) s.on = false; if (s.p <= 6.5) s.on = true;
    s.p += ((s.on ? 0.55 : 0) - s.use / 100 * 0.4) * dt; s.p = clamp(s.p, 0, 8.6);
    if (s.on) { s.a += dt * 8; s.water = Math.min(1, s.water + dt * 0.01); }
    // compressor
    const cx = 90, cy = 200, pis = Math.sin(s.a) * 14;
    D.rect(g, 40, 260, 100, 70, C.steelD, C.line); D.text(g, "motor", 90, 300, { align: "center", color: "#fff", size: 12 });
    D.rect(g, cx - 26, cy - 70, 52, 90, "#fff", C.line, 2); D.rect(g, cx - 24, cy - 40 + pis, 48, 18, C.steel, C.line); D.line(g, cx, cy - 22 + pis, cx, 260, C.steelD, 5);
    D.rect(g, cx - 34, cy - 84, 68, 14, C.steelL, C.line); D.text(g, "compressor", cx, cy - 92, { align: "center", size: 12 });
    D.pipe(g, [[cx, cy - 84], [cx, 60], [210, 60], [210, 120]], C.airL, 10);
    if (s.on) D.flow(g, [[cx, cy - 84], [cx, 60], [210, 60], [210, 120]], C.air, 3, s.t, 2);
    // reservatório
    g.save(); g.beginPath(); g.roundRect(170, 120, 150, 210, 40); g.fillStyle = `rgba(138,200,240,${0.25 + s.p / 12})`; g.fill(); g.strokeStyle = C.line; g.lineWidth = 2.5; g.stroke(); g.restore();
    D.rect(g, 190, 320 - s.water * 30, 110, s.water * 30, C.water, null); D.text(g, "água condensada", 245, 350, { align: "center", size: 11, color: C.blue });
    D.gauge(g, 245, 190, 34, s.p / 10, `${nf(s.p, 1)} bar`);
    D.label(g, s.on ? "pressostato: LIGADO (abaixo de 6,5 bar)" : "pressostato: DESLIGADO (chegou em 8,5 bar)", 20, 30, { color: s.on ? C.green : C.muted });
    // FRL
    const pOut = Math.min(s.reg, s.p), fx = 420;
    D.pipe(g, [[320, 160], [fx, 160], [760, 160]], C.airL, 10);
    if (s.use > 0 && s.p > 0.5) D.flow(g, [[320, 160], [760, 160]], C.air, 3, s.t, s.use / 40);
    const box = (x, lab, col) => { D.rect(g, x - 28, 130, 56, 110, col, C.line, 2); D.text(g, lab, x, 258, { align: "center", size: 12, bold: true }); };
    box(fx, "Filtro", "#e8f4ff"); D.rect(g, fx - 20, 200, 40, 30, C.waterL, null);
    box(fx + 90, "Regulador", "#fff"); D.gauge(g, fx + 90, 110, 22, pOut / 10, `${nf(pOut, 1)} bar`); D.circle(g, fx + 90, 215, 12, C.steelD, C.line);
    box(fx + 180, "Lubrificador", C.oilL); for (let i = 0; i < 3; i++) D.circle(g, fx + 180, 150 + ((s.t * 40 + i * 20) % 60), 3, C.oil, null);
    // ferramenta
    const tx = 780; D.rect(g, tx - 10, 140, 90, 40, "#3a7ad8", C.line); D.rect(g, tx + 70, 150, 40, 20, C.steelD, C.line);
    if (s.use > 0 && pOut > 1) { g.save(); g.translate(tx + 120, 160); g.rotate(s.t * s.use / 5); D.line(g, -12, 0, 12, 0, C.line, 3); D.line(g, 0, -12, 0, 12, C.line, 3); g.restore(); }
    D.text(g, "ferramenta", tx + 40, 200, { align: "center", size: 12 });
  },
  info(s) {
    return { stats: [["Pressão no reservatório", `${nf(s.p, 1)} bar`], ["Pressão na ferramenta", `${nf(Math.min(s.reg, s.p), 1)} bar`], ["Compressor", s.on ? "ligado" : "desligado"]],
      cap: "O reservatório é um “pulmão”: guarda ar para o compressor não ficar liga-desliga e acalma a pressão. Comprimir o ar esquenta e, ao esfriar, a umidade vira água — drene o tanque toda semana, senão ele enferruja por dentro." };
  },
  explain: [
    ["FRL", `<ul><li><b>Filtro:</b> segura água e sujeira (copo com dreno).</li><li><b>Regulador:</b> mantém a pressão de saída constante.</li><li><b>Lubrificador:</b> névoa de óleo para ferramentas que precisam.</li></ul>`],
    ["Números típicos", `<ul><li>Oficina: 6 a 8 bar.</li><li>Pneu de carro: ~2,2 bar (32 psi).</li><li>Consumo é em L/min de ar livre — compressor tem que dar mais do que a ferramenta gasta.</li></ul>`],
  ],
});

// ---------------- Cilindro pneumático, válvula 5/2 e lógica ----------------
M({
  id: "pneucil", group: "Pneumática", title: "Cilindro, válvula 5/2 e lógica pneumática", icon: "🎛️", short: "Botões, válvulas E/OU e o comando bimanual.",
  lead: "Ao apertar o botão, a válvula 5/2 muda de posição: o ar entra atrás do pistão e o cilindro avança. Solte e a mola da válvula devolve tudo. Teste o comando bimanual (precisa das duas mãos — segurança).",
  h: 400,
  controls: [
    { k: "logic", type: "seg", label: "Comando", v: "um", options: [["um", "Um botão"], ["and", "Bimanual (E)"], ["or", "Dois botões (OU)"]] },
    { k: "b1", type: "hold", label: "🖐 Botão 1" },
    { k: "b2", type: "hold", label: "🖐 Botão 2" },
    { k: "vel", label: "Regulagem de velocidade (escape)", min: 10, max: 100, v: 60, unit: "%" },
  ],
  init(s) { s.x = 0; },
  sig(s) { return s.logic === "um" ? !!s.b1 : s.logic === "and" ? !!(s.b1 && s.b2) : !!(s.b1 || s.b2); },
  draw(g, s, dt) {
    const on = this.sig(s), v = s.vel / 100 * 1.6;
    s.x = clamp(s.x + (on ? v : -v * 1.3) * dt, 0, 1);
    // cilindro
    const cx = 480, cy = 80, W = 300, H = 56, px = cx + 8 + s.x * (W - 30);
    D.rect(g, cx, cy, W, H, "#fff", C.line, 2.5); D.rect(g, cx + 2, cy + 2, px - cx - 2, H - 4, on ? "rgba(138,200,240,.7)" : C.airL, null);
    D.rect(g, px, cy + 2, 12, H - 4, C.steel, C.line); D.rect(g, px + 12, cy + H / 2 - 8, 160, 16, C.steelL, C.line);
    // válvula 5/2 (símbolo)
    const vx = 330, vy = 220, sz = 50, sh = on ? -sz : 0;
    for (let i = 0; i < 2; i++) {
      const bx = vx + i * sz + sh, act = (i === 1 && on) || (i === 0 && !on);
      D.rect(g, bx, vy, sz, sz, act ? "#fff8d0" : "#fff", C.line, 1.6);
      if (i === 0) { D.arrow(g, bx + 25, vy + sz, bx + 12, vy + 2, C.line, 1.4, 6); D.arrow(g, bx + 38, vy, bx + 42, vy + sz - 2, C.line, 1.4, 6); }
      else { D.arrow(g, bx + 25, vy + sz, bx + 38, vy + 2, C.line, 1.4, 6); D.arrow(g, bx + 12, vy, bx + 8, vy + sz - 2, C.line, 1.4, 6); }
    }
    D.spring(g, vx + 2 * sz + sh, vy + sz / 2, vx + 2 * sz + sh + 26, vy + sz / 2, 4, 12);
    D.rect(g, vx + sh - 20, vy + 15, 20, 20, on ? C.red : "#ddd", C.line); D.text(g, "piloto", vx + sh - 28, vy + 50, { size: 10, align: "center" });
    D.text(g, "válvula 5/2 (posição ativa em amarelo)", vx + 50, vy + 78, { align: "center", size: 12 });
    // linhas para o cilindro
    const a = [vx + 12 + (on ? 0 : 0), vy], b = [vx + 38, vy];
    const aL = [[vx + 12, vy], [vx + 12, 180], [cx + 20, 180], [cx + 20, cy + H]], bL = [[vx + 38, vy], [vx + 38, 160], [cx + W - 20, 160], [cx + W - 20, cy + H]];
    D.path(g, aL, on ? "#d43a2a" : "#3a7ad8", 3); D.path(g, bL, on ? "#3a7ad8" : "#d43a2a", 3);
    if (s.x > 0 && s.x < 1) { D.flow(g, on ? aL : bL, C.blue, 2, s.t, 2); D.flow(g, [...(on ? bL : aL)].reverse(), C.muted, 2, s.t, 2); }
    void a; void b;
    D.line(g, vx + 25, vy + sz, vx + 25, 330, "#d43a2a", 3); D.text(g, "1 (ar da rede)", vx + 30, 345, { size: 11 });
    // lógica: botões e elemento E/OU
    const bx1 = 90, by = 230;
    const btn = (x, y, pressed, lab) => { D.rect(g, x - 26, y - 18, 52, 36, pressed ? "#9ae09a" : "#eee", C.line, 1.6); D.text(g, lab, x, y + 5, { align: "center", size: 12, bold: true }); };
    btn(bx1, by - 60, s.b1, "B1");
    if (s.logic !== "um") btn(bx1, by + 40, s.b2, "B2");
    if (s.logic === "um") D.path(g, [[bx1 + 26, by - 60], [vx - 40, by - 60], [vx - 40, vy + 25], [vx + sh - 20, vy + 25]], s.b1 ? "#d43a2a" : IDLEP, 2.5);
    else {
      const gx = 220, gy = by - 10;
      D.rect(g, gx - 30, gy - 30, 60, 60, "#fff", C.line, 2); D.text(g, s.logic === "and" ? "E" : "OU", gx, gy + 7, { align: "center", bold: true, size: 18 });
      D.path(g, [[bx1 + 26, by - 60], [gx - 50, by - 60], [gx - 50, gy - 12], [gx - 30, gy - 12]], s.b1 ? "#d43a2a" : IDLEP, 2.5);
      D.path(g, [[bx1 + 26, by + 40], [gx - 50, by + 40], [gx - 50, gy + 12], [gx - 30, gy + 12]], s.b2 ? "#d43a2a" : IDLEP, 2.5);
      D.path(g, [[gx + 30, gy], [vx - 40, gy], [vx - 40, vy + 25], [vx + sh - 20, vy + 25]], on ? "#d43a2a" : IDLEP, 2.5);
      D.text(g, s.logic === "and" ? "válvula de simultaneidade (duas pressões)" : "válvula alternadora (seletora)", gx, gy + 50, { align: "center", size: 11 });
    }
    D.label(g, on ? "sinal ativo: avança" : "sem sinal: a mola volta a válvula e o cilindro recua", 480, 380, { color: on ? C.green : C.muted });
  },
  info(s) {
    return { stats: [["Sinal para a válvula", this.sig(s) ? "SIM" : "não"], ["Posição do cilindro", `${nf(s.x * 100, 0)}%`]],
      cap: s.logic === "and" ? "<b>Bimanual (E):</b> só avança com as duas mãos nos botões — assim nenhuma mão fica embaixo da prensa. Solte qualquer um e ela volta." : s.logic === "or" ? "<b>OU:</b> qualquer um dos botões comanda (ex.: abrir a porta por dentro ou por fora)." : "Válvula 5/2: 5 vias (1 pressão, 2 e 4 para o cilindro, 3 e 5 escapes) e 2 posições. A regulagem no escape controla a velocidade sem perder força." };
  },
  explain: [
    ["Pneumática × hidráulica", `<ul><li><b>Ar:</b> rápido, limpo, barato, força moderada, “esponjoso”.</li><li><b>Óleo:</b> força enorme, preciso, mais lento, vaza sujeira.</li></ul>`],
    ["Lógica com ar", `<p>Antes dos CLPs, máquinas inteiras eram comandadas só com válvulas: E, OU, NÃO, memória (válvula biestável) e temporizadores (reservatório + estrangulador).</p>`],
  ],
});
const IDLEP = "#b8b8b8";

// ---------------- Compressibilidade (Boyle) ----------------
M({
  id: "boyle", group: "Pneumática", title: "Ar × óleo: compressibilidade (Boyle)", icon: "💉", short: "Por que o ar é “mola” e o óleo é rígido.",
  lead: "Tampe a seringa e empurre: com ar o êmbolo afunda (pressão × volume = constante); com óleo ele praticamente não se mexe. É por isso que pneumática é macia e hidráulica é precisa.",
  h: 340,
  controls: [
    { k: "F", label: "Força no êmbolo", min: 0, max: 400, step: 10, v: 150, unit: "N" },
    { k: "fl", type: "seg", label: "Dentro da seringa", v: "ar", options: [["ar", "Ar"], ["oleo", "Óleo"]] },
  ],
  vol(s) { const A = Math.PI * 0.015 ** 2, p0 = 101325, p = p0 + s.F / A; return s.fl === "ar" ? p0 / p : 1 - (p - p0) / 1.5e9; },
  draw(g, s) {
    const V = this.vol(s), x0 = 160, L = 420, y = 160, H = 80, len = L * V;
    D.rect(g, x0, y - H / 2, L, H, "#fff", C.line, 2.5); D.rect(g, x0 - 20, y - 10, 20, 20, C.red, C.line); D.text(g, "tampado", x0 - 10, y + 34, { align: "center", size: 11 });
    D.rect(g, x0, y - H / 2 + 2, len, H - 4, s.fl === "ar" ? `rgba(138,200,240,${0.3 + (1 - V) * 0.7})` : C.oilL, null);
    if (s.fl === "ar") for (let i = 0; i < 40; i++) { const px = x0 + ((i * 37) % 100) / 100 * len, py = y - H / 2 + 6 + ((i * 53) % 100) / 100 * (H - 12); D.circle(g, px, py, 2.5, C.blue, null); }
    D.rect(g, x0 + len, y - H / 2 + 2, 14, H - 4, C.rubber, C.line); D.rect(g, x0 + len + 14, y - 8, 200, 16, C.steelL, C.line); D.rect(g, x0 + len + 214, y - 40, 14, 80, C.steelL, C.line);
    D.arrow(g, x0 + len + 300, y, x0 + len + 236, y, C.red, 3); D.label(g, `${s.F} N`, x0 + len + 250, y - 20, { color: C.red });
    // gráfico P × V
    const pts = []; for (let v = 0.15; v <= 1; v += 0.01) pts.push([v, 1 / v]);
    D.plot(g, 560, 220, 300, 100, [{ pts, color: C.blue }], { xr: [0, 1], yr: [0, 7], title: "ar: pressão × volume (p·V = const)", xl: "volume", mark: s.fl === "ar" ? [V, 1 / V] : null });
  },
  info(s) {
    const V = this.vol(s), A = Math.PI * 0.015 ** 2, p = 101325 + s.F / A;
    return { stats: [["Pressão dentro", `${nf(p / 1e5, 2)} bar (absoluta)`], ["Volume restante", `${nf(V * 100, s.fl === "ar" ? 0 : 3)}%`]],
      cap: s.fl === "ar" ? "Dobrar a pressão = metade do volume (Boyle). O ar comprimido guarda energia como uma mola — se a mangueira soltar, ela chicoteia. Cilindro pneumático com carga variável não para exatamente no lugar." : "O óleo diminui só ~0,07% a cada 100 bar: na prática é incompressível. Por isso o pedal de freio é firme e a escavadeira para exatamente onde você manda." };
  },
  explain: [
    ["Boyle-Mariotte", `<p><span class="f">p₁·V₁ = p₂·V₂</span> (temperatura constante). Use pressão <b>absoluta</b> (manômetro + 1 bar).</p>`],
    ["Segurança", `<p>Um tanque de ar a 8 bar guarda muito mais energia que um de água na mesma pressão — se romper, explode. Teste hidrostático de tanques é feito com água por isso.</p>`],
  ],
});

// ---------------- Vácuo e ventosas ----------------
M({
  id: "vacuo", group: "Pneumática", title: "Vácuo, ventosas e Venturi", icon: "🧲", short: "A atmosfera empurrando para você.",
  lead: "A ventosa não “puxa”: ela tira o ar de dentro e a pressão da atmosfera, do lado de fora, empurra a peça contra ela. Um gerador Venturi cria esse vácuo só com ar comprimido.",
  h: 380,
  controls: [
    { k: "p", label: "Pressão de alimentação", min: 0, max: 7, step: 0.5, v: 5, unit: "bar", d: 1 },
    { k: "d", label: "Diâmetro da ventosa", min: 20, max: 150, v: 60, unit: "mm" },
    { k: "kg", label: "Peso da chapa", min: 1, max: 80, v: 10, unit: "kg" },
  ],
  calc(s) { const vac = Math.min(0.85, s.p / 5 * 0.85) * 1.013e5, A = Math.PI * (s.d / 2000) ** 2, F = vac * A, hold = F / 2 > s.kg * 9.81; return { vac, A, F, hold }; },
  draw(g, s) {
    const c = this.calc(s), lift = c.hold ? 40 + Math.sin(s.t) * 10 : 0, cx = 560, cupY = 130;
    // Venturi
    D.pipe(g, [[60, 80], [230, 80]], C.airL, 30); D.pipe(g, [[230, 80], [330, 80]], C.airL, 12); D.pipe(g, [[330, 80], [460, 80]], C.airL, 30);
    if (s.p > 0) D.flow(g, [[60, 80], [460, 80]], C.air, 3, s.t, s.p / 2);
    D.pipe(g, [[280, 80], [280, 200], [cx, 200], [cx, cupY + 10]], "#eef", 10);
    if (s.p > 0) D.flow(g, [[cx, cupY + 10], [cx, 200], [280, 200], [280, 80]], C.muted, 2, s.t, 1);
    D.text(g, "ar comprimido →", 60, 60, { size: 12 }); D.text(g, "→ escape", 400, 60, { size: 12 }); D.text(g, "estreitamento: velocidade alta, pressão baixa — puxa o ar da ventosa", 60, 230, { size: 11, color: C.blue });
    D.gauge(g, 140, 300, 34, c.vac / 1e5, `vácuo −${nf(c.vac / 1e5, 2)} bar`, C.blue);
    // ventosa e chapa
    const w = clamp(s.d * 1.2, 30, 180);
    D.line(g, cx, 40, cx, cupY, C.steelD, 6);
    D.path(g, [[cx - 8, cupY], [cx + 8, cupY], [cx + w / 2, cupY + 30 - lift * 0], [cx - w / 2, cupY + 30]], C.line, 1.5, true, C.rubber);
    const py = c.hold ? cupY + 30 : 330 - 14;
    D.rect(g, cx - 140, py, 280, 14, C.steel, C.line); D.text(g, `${s.kg} kg`, cx, py + 30, { align: "center", size: 12 });
    D.ground(g, 380, 330, 400);
    if (c.hold) for (let i = -2; i <= 2; i++) D.arrow(g, cx + i * 40, py + 70, cx + i * 40, py + 18, C.purple, 2);
    D.label(g, c.hold ? "segura! a atmosfera empurra a chapa contra a ventosa" : "não segura: força de vácuo menor que o peso × 2 (segurança)", 420, 30, { color: c.hold ? C.green : C.red });
  },
  info(s) {
    const c = this.calc(s);
    return { stats: [["Vácuo gerado", `${nf(c.vac / 1e5, 2)} bar abaixo da atmosfera`], ["Força da ventosa", `${nf(c.F, 0)} N (${nf(c.F / 9.81, 1)} kg)`], ["Peso da chapa", `${nf(s.kg * 9.81, 0)} N`]],
      cap: "Força = diferença de pressão × área. O máximo teórico é 1 bar (vácuo perfeito) — uma ventosa de 10 cm segura no máximo ~80 kg. Na prática usa-se fator de segurança 2 ou mais, e superfície porosa (madeira, papelão) deixa o ar entrar." };
  },
  explain: [
    ["Atmosfera", `<p>Ao nível do mar o ar pesa 1,013 bar sobre tudo — 10 toneladas por metro quadrado! Só não sentimos porque ela empurra igual de todos os lados.</p>`],
    ["Onde se usa", `<ul><li>Robôs que pegam peças, vidros e chapas.</li><li>Servo-freio do carro (vácuo do motor).</li><li>Embalagem a vácuo, bomba de vácuo de ar-condicionado.</li></ul>`],
  ],
});
