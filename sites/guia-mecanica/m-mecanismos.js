// MechLab — Mecanismos e juntas: biela-manivela, came, 4 barras, juntas, cardã, intermitentes e uniões fixas.
"use strict";

// ---------------- Biela-manivela ----------------
M({
  id: "biela", group: "Mecanismos e juntas", title: "Biela-manivela", icon: "🔁", short: "Giro ↔ vaivém: motor, compressor, bomba.",
  lead: "A manivela gira, a biela empurra o pistão para frente e para trás. O pistão para nos pontos mortos (PMS e PMI) e é mais rápido no meio — veja no gráfico.",
  h: 380,
  controls: [
    { k: "r", label: "Raio da manivela", min: 30, max: 90, v: 60, unit: "px" },
    { k: "L", label: "Comprimento da biela", min: 120, max: 300, v: 200, unit: "px" },
    { k: "rpm", label: "Rotação", min: 10, max: 120, v: 40, unit: "rpm (desenho)" },
  ],
  init(s) { s.a = 0; s.hist = []; },
  change(s) { s.hist = []; },
  draw(g, s, dt) {
    s.a += dt * s.rpm / 60 * TAU;
    const cx = 160, cy = 160, r = s.r, L = s.L, th = s.a;
    const Bx = cx + r * Math.cos(th), By = cy - r * Math.sin(th);
    const px = cx + r * Math.cos(th) + Math.sqrt(L * L - (r * Math.sin(th)) ** 2), xmax = cx + r + L, xmin = cx - r + L;
    // cilindro
    D.rect(g, xmin - 40, cy - 46, (xmax - xmin) + 140, 92, null, C.line, 2); D.hatch(g, xmin - 40, cy - 58, (xmax - xmin) + 140, 12); D.hatch(g, xmin - 40, cy + 46, (xmax - xmin) + 140, 12);
    D.rect(g, px - 10, cy - 44, 70, 88, C.steelL, C.line); D.line(g, px + 10, cy - 44, px + 10, cy + 44, C.muted, 1); D.line(g, px + 18, cy - 44, px + 18, cy + 44, C.muted, 1);
    // manivela e biela
    D.circle(g, cx, cy, r + 14, "#eee", C.line, 1); D.link(g, cx, cy, Bx, By, 18, "#9ec0f0"); D.link(g, Bx, By, px, cy, 14, "#f6b880");
    D.pin(g, cx, cy, 7); D.pin(g, Bx, By, 6); D.pin(g, px, cy, 6);
    D.line(g, xmax + 10, cy - 60, xmax + 10, cy + 60, C.red, 1, [4, 3]); D.text(g, "PMS", xmax + 14, cy - 64, { size: 12, color: C.red });
    D.line(g, xmin + 10, cy - 60, xmin + 10, cy + 60, C.blue, 1, [4, 3]); D.text(g, "PMI", xmin + 14, cy + 74, { size: 12, color: C.blue });
    // gráfico posição e velocidade
    const deg = ((th % TAU) + TAU) % TAU;
    const pos = a => (r * Math.cos(a) + Math.sqrt(L * L - (r * Math.sin(a)) ** 2) - (L - r)) / (2 * r);
    const vel = a => { const e = 0.001; return (pos(a + e) - pos(a - e)) / (2 * e); };
    const P = [], V = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU; P.push([a, pos(a)]); V.push([a, vel(a) * 0.5 + 0.5]); }
    D.plot(g, 70, 270, 760, 90, [{ pts: P, color: C.orange }, { pts: V, color: C.purple, dash: [5, 4] }], { xr: [0, TAU], yr: [-0.05, 1.05], title: "posição do pistão (laranja) e velocidade (roxo tracejado) × ângulo da manivela", vline: deg });
  },
  info(s) {
    const lam = s.r / s.L;
    return { stats: [["Curso do pistão", `${2 * s.r} px (= 2 × raio)`], ["Razão r/L", nf(lam, 2)], ["Velocidade máx. (aprox.)", `${nf(s.r * s.rpm / 60 * TAU * Math.sqrt(1 + lam * lam), 0)} px/s`]],
      cap: `Biela curta (r/L grande) deixa o movimento mais “torto”: o pistão passa mais tempo perto do PMI e acelera forte no PMS. Biela longa = movimento mais próximo de uma senoide, menos vibração. Nos motores, r/L fica perto de 0,3.` };
  },
  explain: [
    ["Pontos mortos", `<ul><li><b>PMS:</b> ponto morto superior — pistão no fim do curso, velocidade zero.</li><li><b>PMI:</b> ponto morto inferior.</li><li>Nesses pontos a biela não consegue girar a manivela: por isso motores têm <b>volante</b> (inércia) ou vários cilindros.</li></ul>`],
    ["Fórmula", `<p><span class="f">x = r·cos θ + √(L² − r²·sen² θ)</span></p><p>Curso = 2r. Cilindrada = área do pistão × curso.</p>`],
    ["Onde se usa", `<ul><li>Motores a combustão, compressores, bombas de pistão.</li><li>Ao contrário (vaivém → giro): máquina a vapor, pedal de máquina de costura.</li></ul>`],
  ],
});

// ---------------- Came e seguidor ----------------
const CAMS = {
  exc: { n: "Excêntrico", r: p => { /* círculo deslocado */ return null; } },
  ovo: { n: "Ovo (comando de válvulas)", r: p => 55 + 38 * Math.pow(Math.max(0, Math.cos(p)), 3) },
  car: { n: "Caracol (queda brusca)", r: p => { const q = ((p % TAU) + TAU) % TAU; return 45 + 55 * q / TAU; } },
  cor: { n: "Coração (subida uniforme)", r: p => { const q = ((p % TAU) + TAU) % TAU; return 45 + 55 * (1 - Math.abs(q - Math.PI) / Math.PI); } },
};
function camPts(type, a) {
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const p = i / 180 * TAU;
    let x, y;
    if (type === "exc") { x = 25 + 62 * Math.cos(p); y = 62 * Math.sin(p); }
    else { const r = CAMS[type].r(p); x = r * Math.cos(p); y = r * Math.sin(p); }
    pts.push([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  }
  return pts;
}
M({
  id: "came", group: "Mecanismos e juntas", title: "Came e seguidor", icon: "🥚", short: "O formato da peça vira o movimento.",
  lead: "O came gira e o seguidor sobe e desce copiando o formato dele. É assim que o motor abre as válvulas na hora certa. Troque o perfil e veja o gráfico do levantamento.",
  h: 380,
  controls: [
    { k: "tipo", type: "seg", label: "Perfil do came", v: "ovo", options: Object.entries(CAMS).map(([k, v]) => [k, v.n]) },
    { k: "rpm", label: "Rotação", min: 5, max: 90, v: 30, unit: "rpm (desenho)" },
  ],
  init(s) { s.a = 0; },
  lift(type, a) { return Math.max(...camPts(type, a).map(p => -p[1])); },
  draw(g, s, dt) {
    s.a += dt * s.rpm / 60 * TAU;
    const cx = 220, cy = 260, pts = camPts(s.tipo, s.a).map(([x, y]) => [cx + x, cy + y]), lift = this.lift(s.tipo, s.a);
    D.path(g, pts, C.line, 1.6, true, "#f6b880"); D.pin(g, cx, cy, 8); D.rot(g, cx, cy, 30, -1);
    // seguidor plano + mola
    const fy = cy - lift;
    D.rect(g, cx - 40, fy - 10, 80, 10, C.steel, C.line);
    D.rect(g, cx - 8, fy - 150, 16, 140, C.steelL, C.line);
    D.rect(g, cx - 30, 30, 60, 12, C.steelD, C.line); D.hatch(g, cx - 60, 18, 120, 12);
    D.spring(g, cx - 22, 42, cx - 22, fy - 12, 7, 12); D.spring(g, cx + 22, 42, cx + 22, fy - 12, 7, 12);
    D.line(g, cx + 55, fy, cx + 90, fy, C.red, 1, [3, 3]); D.label(g, `levantamento ${nf(lift - this.minLift(s.tipo), 0)} px`, cx + 95, fy + 4, { color: C.red });
    // gráfico de levantamento
    const N = 180, curve = []; let mn = Infinity, mx = -Infinity;
    for (let i = 0; i <= N; i++) { const a = i / N * TAU, l = this.lift(s.tipo, a); curve.push([a, l]); mn = Math.min(mn, l); mx = Math.max(mx, l); }
    D.plot(g, 440, 80, 420, 200, [{ pts: curve, color: C.orange, w: 2.5 }], { xr: [0, TAU], yr: [mn - 5, mx + 5], title: "levantamento × ângulo do came (uma volta)", xl: "0° → 360°", mark: [((s.a % TAU) + TAU) % TAU, lift] });
  },
  minLift(type) { let m = Infinity; for (let i = 0; i < 90; i++) m = Math.min(m, this.lift(type, i / 90 * TAU)); return m; },
  info(s) {
    const t = { exc: "Excêntrico: movimento suave, parecido com uma biela. Usado em bombas de combustível mecânicas e prensas.", ovo: "Ovo: fica parado no círculo de base (válvula fechada) e abre só durante um trecho. O tamanho do “bico” define quanto e por quanto tempo a válvula abre.", car: "Caracol: sobe devagar e cai de uma vez — martelos, travas, brinquedos de corda.", cor: "Coração: sobe e desce em velocidade constante — bobinadeiras de linha e máquinas de costura." }[s.tipo];
    return { stats: [], cap: t };
  },
  explain: [
    ["Partes", `<ul><li><b>Came:</b> a peça com formato.</li><li><b>Seguidor:</b> plano, de rolete ou de ponta.</li><li><b>Mola:</b> mantém o seguidor encostado — se a rotação for alta demais, ele “flutua”.</li></ul>`],
    ["No motor", `<ul><li>O eixo de comando gira na metade da rotação do virabrequim (motor 4 tempos).</li><li>Comando “bravo”: mais levantamento e duração → mais potência em alta, marcha lenta instável.</li></ul>`],
  ],
});

// ---------------- Mecanismo de 4 barras ----------------
const PRESETS = { mb: ["Manivela-balancim", 60, 180, 140, 200], dm: ["Dupla manivela", 150, 170, 150, 60], par: ["Paralelogramo", 90, 230, 90, 230], bb: ["Duplo balancim", 160, 120, 150, 210] };
M({
  id: "barras", group: "Mecanismos e juntas", title: "Mecanismo de 4 barras", icon: "📏", short: "Quatro barras e quatro pinos geram curvas incríveis.",
  lead: "Três barras móveis e o chão formam o mecanismo mais usado do mundo: limpador de para-brisa, suspensão, pantógrafo, alicate de pressão. O ponto vermelho desenha a “curva de acoplador”.",
  h: 400,
  controls: [
    { k: "pre", type: "seg", label: "Exemplos", v: "mb", options: Object.entries(PRESETS).map(([k, v]) => [k, v[0]]) },
    { k: "a", label: "Manivela (azul)", min: 30, max: 220, v: 60 },
    { k: "b", label: "Biela (laranja)", min: 40, max: 260, v: 180 },
    { k: "c", label: "Balancim (verde)", min: 30, max: 220, v: 140 },
    { k: "d", label: "Base (chão)", min: 40, max: 260, v: 200 },
    { k: "cp", label: "Ponto na biela", min: 0, max: 100, v: 50, unit: "%" },
  ],
  init(s) { s.th = 0.3; s.dir = 1; s.trace = []; },
  change(s, k) {
    if (k === "pre") { const [, a, b, c, d] = PRESETS[s.pre]; for (const [kk, v] of Object.entries({ a, b, c, d })) this.set(kk, v); }
    s.trace = [];
  },
  solve(s, th) {
    const A = [300, 270], Dp = [300 + s.d, 270], B = [A[0] + s.a * Math.cos(th), A[1] - s.a * Math.sin(th)];
    const dx = Dp[0] - B[0], dy = Dp[1] - B[1], dd = Math.hypot(dx, dy);
    if (dd > s.b + s.c || dd < Math.abs(s.b - s.c)) return null;
    const aa = (s.b * s.b - s.c * s.c + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, s.b * s.b - aa * aa));
    const mx = B[0] + aa * dx / dd, my = B[1] + aa * dy / dd;
    const Cp = [mx + h * dy / dd, my - h * dx / dd];
    return { A, Dp, B, Cp };
  },
  draw(g, s, dt) {
    const step = dt * 1.4 * s.dir;
    let sol = this.solve(s, s.th + step);
    if (!sol) { s.dir *= -1; sol = this.solve(s, s.th); } else s.th += step;
    if (!sol) { D.label(g, "Com essas medidas as barras não fecham — mude os comprimentos.", 200, 200, { color: C.red }); return; }
    const { A, Dp, B, Cp } = sol, f = s.cp / 100, P = [B[0] + (Cp[0] - B[0]) * f, B[1] + (Cp[1] - B[1]) * f];
    s.trace.push(P); if (s.trace.length > 600) s.trace.shift();
    D.path(g, s.trace, "rgba(198,40,40,.55)", 1.5);
    D.anchor(g, ...A); D.anchor(g, ...Dp); D.line(g, A[0], A[1], Dp[0], Dp[1], C.muted, 1.5, [6, 4]);
    D.link(g, ...A, ...B, 14, "#9ec0f0"); D.link(g, ...B, ...Cp, 14, "#f6b880"); D.link(g, ...Cp, ...Dp, 14, "#b8e0a8");
    D.pin(g, ...B); D.pin(g, ...Cp); D.circle(g, ...P, 6, C.red, C.line);
    D.text(g, "A", A[0] - 18, A[1] - 6, { bold: true }); D.text(g, "D", Dp[0] + 10, Dp[1] - 6, { bold: true });
  },
  info(s) {
    const L = [s.a, s.b, s.c, s.d].sort((x, y) => x - y), gr = L[0] + L[3] <= L[1] + L[2];
    let tipo = "não-Grashof: nenhuma barra dá a volta inteira (duplo balancim)";
    if (gr) { const sh = Math.min(s.a, s.b, s.c, s.d); tipo = sh === s.d ? "Grashof — dupla manivela (as duas dão volta)" : sh === s.a ? "Grashof — manivela-balancim (azul gira, verde oscila)" : sh === s.b ? "Grashof — duplo balancim" : "Grashof — balancim-manivela"; }
    return { stats: [["Regra de Grashof", `menor + maior ${gr ? "≤" : ">"} soma das outras`], ["Classificação", tipo]],
      cap: "<b>Grashof:</b> se a barra mais curta + a mais longa ≤ soma das outras duas, pelo menos uma barra gira 360°. Quem gira depende de qual barra é a mais curta. Quando a manivela não consegue continuar, o desenho inverte o sentido." };
  },
  explain: [
    ["Onde aparece", `<ul><li>Limpador de para-brisa (manivela-balancim).</li><li>Suspensão duplo A (o “chão” é o chassi).</li><li>Alicate de pressão (trava passando do ponto morto).</li><li>Luminária articulada (paralelogramo mantém o ângulo).</li></ul>`],
    ["Graus de liberdade", `<p>Gruebler: <span class="f">GL = 3(n−1) − 2·j</span> = 3·3 − 2·4 = <b>1</b>. Um único motor controla tudo.</p>`],
  ],
});

// ---------------- Juntas e articulações ----------------
M({
  id: "juntas", group: "Mecanismos e juntas", title: "Juntas e articulações", icon: "🦴", short: "Pino, deslizante, esférica, parafuso, dobradiça…",
  lead: "Toda junta deixa alguns movimentos livres e trava os outros. Contar esses “graus de liberdade” explica por que um pivô de suspensão é uma bola e uma porta usa dobradiça.",
  h: 360,
  controls: [{ k: "j", type: "seg", label: "Tipo de junta", v: "pino", options: [["pino", "Pino (rotação)"], ["desl", "Deslizante (prismática)"], ["esf", "Esférica (pivô)"], ["cil", "Cilíndrica"], ["paraf", "Parafuso (helicoidal)"], ["plana", "Plana (apoio)"]] }],
  draw(g, s) {
    const t = s.t, cx = 330, cy = 190;
    const J = {
      pino: () => { const a = Math.sin(t) * 1; D.anchor(g, cx, cy, 18); D.link(g, cx, cy, cx + Math.cos(a - 0.6) * 200, cy + Math.sin(a - 0.6) * 200, 24, "#9ec0f0"); D.circle(g, cx, cy, 12, "#fff", C.line, 2); D.rot(g, cx, cy, 40, 1); },
      desl: () => { const x = cx + Math.sin(t) * 120; D.rect(g, cx - 220, cy + 20, 440, 18, C.steelL, C.line); D.hatch(g, cx - 220, cy + 38, 440, 10); D.rect(g, x - 50, cy - 30, 100, 50, "#9ec0f0", C.line); D.arrow(g, x - 80, cy - 50, x + 80, cy - 50, C.blue, 2); D.arrow(g, x + 80, cy - 50, x - 80, cy - 50, C.blue, 2); },
      esf: () => {
        const a = Math.sin(t) * 0.6, b = Math.cos(t * 0.7) * 0.4;
        D.circle(g, cx, cy, 50, "#9ec0f0", C.line, 2);
        g.save(); g.beginPath(); g.arc(cx, cy, 62, 0.3, Math.PI - 0.3); g.lineTo(cx - 70, cy + 80); g.lineTo(cx + 70, cy + 80); g.closePath(); g.fillStyle = C.steelL; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.6; g.stroke(); g.restore();
        const ex = cx + Math.sin(a) * 180, ey = cy - Math.cos(a) * 180 * (0.8 + b * 0.3);
        D.line(g, cx, cy, ex, ey, C.steelD, 18); D.circle(g, cx - 15, cy - 15, 10, "rgba(255,255,255,.6)", null);
        D.text(g, "gira em todas as direções (3 rotações)", cx + 110, cy + 120, { size: 12 });
      },
      cil: () => { const x = Math.sin(t * 0.8) * 90, a = t * 2; D.rect(g, cx - 220, cy - 12, 440, 24, C.steelL, C.line); D.rect(g, cx + x - 50, cy - 36, 100, 72, "#9ec0f0", C.line); stripesJ(g, cx + x - 50, cy - 36, 100, 72, a * 20); D.text(g, "desliza E gira no eixo", cx, cy + 80, { align: "center" }); },
      paraf: () => { const a = t * 2, x = ((a / TAU) * 24) % 160; D.rect(g, cx - 200, cy - 14, 400, 28, C.steelL, C.line); for (let i = -200; i < 200; i += 12) D.line(g, cx + i, cy - 14, cx + i + 8, cy + 14, C.steelD, 1.5); D.rect(g, cx - 120 + x, cy - 34, 60, 68, C.oilL, C.line); D.rot(g, cx - 90 + x, cy, 44, 1); D.text(g, "girar uma volta = andar um passo (só 1 grau de liberdade)", cx, cy + 80, { align: "center" }); },
      plana: () => { const x = Math.sin(t * 0.7) * 100, a = Math.sin(t) * 0.5; D.ground(g, cx - 240, cy + 40, 480); g.save(); g.translate(cx + x, cy + 10); g.rotate(a * 0.3); D.rect(g, -60, -30, 120, 60, "#9ec0f0", C.line); g.restore(); D.text(g, "anda em x e y e gira no plano (3 graus)", cx, cy + 90, { align: "center" }); },
    };
    J[s.j]();
  },
  info(s) {
    const d = { pino: [1, "1 rotação", "dobradiça, articulação do braço da suspensão, cotovelo de robô"], desl: [1, "1 translação", "pistão no cilindro, gaveta, guia linear de CNC"], esf: [3, "3 rotações", "pivô da suspensão, terminal de direção, quadril humano"], cil: [2, "1 rotação + 1 translação", "haste de amortecedor, eixo deslizante"], paraf: [1, "rotação ligada à translação", "fuso de torno, macaco de rosca, morsa"], plana: [3, "2 translações + 1 rotação", "pé de máquina apoiado, deslizamento sobre mesa"] }[s.j];
    return { stats: [["Graus de liberdade", d[0]], ["Movimentos livres", d[1]]], cap: `Exemplos: ${d[2]}.` };
  },
  explain: [
    ["Graus de liberdade", `<p>Um corpo solto no espaço tem 6: 3 translações (x, y, z) e 3 rotações. Cada junta <b>tira</b> alguns. Pino deixa 1, esférica deixa 3.</p>`],
    ["Na suspensão", `<ul><li>Bandeja presa ao chassi por <b>buchas</b> (pino com borracha).</li><li>Manga de eixo presa por <b>pivô esférico</b> — precisa esterçar e subir/descer.</li><li>Folga nessas juntas = barulho e carro “solto”.</li></ul>`],
  ],
});
function stripesJ(g, x, y, w, h, off) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 12; k++) { const q = ((off + k * 12) % 144 + 144) % 144 - 12; g.moveTo(x, y + q); g.lineTo(x + w, y + q); } g.stroke(); g.restore(); }

// ---------------- Junta cardã ----------------
M({
  id: "cardan", group: "Mecanismos e juntas", title: "Junta cardã e homocinética", icon: "✖️", short: "Passar giro entre eixos em ângulo.",
  lead: "A cruzeta transmite o giro com o eixo dobrado, mas a saída acelera e freia duas vezes por volta. Com duas cardãs em fase o efeito se cancela; a junta homocinética resolve de vez.",
  h: 380,
  controls: [
    { k: "beta", label: "Ângulo entre os eixos", min: 0, max: 45, v: 30, unit: "°" },
    { k: "tipo", type: "seg", label: "Montagem", v: "uma", options: [["uma", "Uma cardã"], ["duas", "Duas cardãs em fase"], ["homo", "Homocinética"]] },
  ],
  init(s) { s.a = 0; },
  out(s, a) { const b = s.beta * Math.PI / 180; if (s.tipo !== "uma") return a; const t = Math.atan2(Math.sin(a), Math.cos(a) * Math.cos(b)); return a + Math.atan2(Math.sin(t - a), Math.cos(t - a)); },
  draw(g, s, dt) {
    s.a += dt * 1.2;
    const b = s.beta * Math.PI / 180, a = s.a, o = this.out(s, a);
    // vista esquemática dos eixos
    const cx = 260, cy = 150;
    D.line(g, 40, cy, cx, cy, C.steelD, 14); D.line(g, cx, cy, cx + Math.cos(-b) * 220, cy + Math.sin(-b) * 220, C.steelD, 14);
    const yoke = (x, y, ang, rot, col) => { g.save(); g.translate(x, y); g.rotate(ang); const k = Math.cos(rot); D.rect(g, -30, -36 * Math.abs(k) - 4, 30, 72 * Math.abs(k) + 8, col, C.line); g.restore(); };
    yoke(cx, cy, 0, a, "#9ec0f0"); yoke(cx, cy, -b + Math.PI, o + Math.PI / 2, "#f6b880");
    D.circle(g, cx, cy, 12, C.steel, C.line); D.line(g, cx - 16 * Math.cos(a), cy - 16 * Math.sin(a) * 0.5, cx + 16 * Math.cos(a), cy + 16 * Math.sin(a) * 0.5, C.red, 4);
    D.text(g, `${s.beta}°`, cx + 40, cy - 8, { size: 13, color: C.red });
    // mostradores entrada × saída
    const dial = (x, y, ang, label, col) => { D.circle(g, x, y, 46, "#fff", C.line, 2); D.line(g, x, y, x + Math.cos(ang - Math.PI / 2) * 40, y + Math.sin(ang - Math.PI / 2) * 40, col, 4); D.text(g, label, x, y + 64, { align: "center", size: 12 }); };
    dial(620, 110, a, "entrada", C.blue); dial(760, 110, o, s.tipo === "uma" ? "saída (cardã)" : "saída", C.orange);
    const diff = (o - a) * 180 / Math.PI;
    D.label(g, `diferença: ${nf(((diff + 540) % 360) - 180, 1)}°`, 620, 205);
    // gráfico da razão de velocidades
    const ratio = th => s.tipo !== "uma" ? 1 : Math.cos(b) / (1 - Math.sin(b) ** 2 * Math.cos(th) ** 2);
    const pts = []; for (let i = 0; i <= 120; i++) { const th = i / 120 * TAU; pts.push([th, ratio(th)]); }
    D.plot(g, 70, 250, 760, 100, [{ pts, color: C.orange, w: 2.5 }, { pts: [[0, 1], [TAU, 1]], color: C.blue, dash: [4, 4] }], { xr: [0, TAU], yr: [0.6, 1.5], title: "velocidade da saída ÷ entrada ao longo de uma volta", vline: ((a % TAU) + TAU) % TAU });
  },
  info(s) {
    const b = s.beta * Math.PI / 180, mx = 1 / Math.cos(b), mn = Math.cos(b);
    return { stats: [["Velocidade da saída", s.tipo === "uma" ? `oscila de ${nf(mn * 100, 0)}% a ${nf(mx * 100, 0)}%` : "constante (100%)"], ["Variações por volta", s.tipo === "uma" && s.beta ? "2 acelerações e 2 frenagens" : "nenhuma"]],
      cap: s.tipo === "uma" ? "Uma cardã sozinha gira a saída “aos trancos” — com ângulo grande isso vibra e força rolamentos. Por isso o cardã do carro tem duas juntas e os garfos das pontas alinhados." : s.tipo === "duas" ? "Duas cardãs com os garfos do eixo intermediário <b>em fase</b> e ângulos iguais: o tranco da primeira é desfeito pela segunda. A saída final gira igual à entrada." : "Homocinética (CV): esferas em canaletas ficam sempre no plano que divide o ângulo ao meio, então a velocidade é constante mesmo com 45° — vai nas rodas da frente que esterçam." };
  },
  explain: [
    ["Fórmula da cardã", `<p><span class="f">ω<sub>2</sub>/ω<sub>1</sub> = cos β / (1 − sen²β·cos²θ)</span></p><p>Varia entre <span class="f">cos β</span> e <span class="f">1/cos β</span>, duas vezes por volta.</p>`],
    ["Homocinéticas", `<ul><li><b>Rzeppa</b> (bolinhas): lado da roda, aguenta ângulo grande.</li><li><b>Tripoide:</b> lado do câmbio, deixa o eixo deslizar quando a suspensão trabalha.</li><li>Coifa rasgada = graxa sai, sujeira entra = estalos na curva.</li></ul>`],
  ],
});

// ---------------- Movimento intermitente ----------------
M({
  id: "intermitente", group: "Mecanismos e juntas", title: "Catraca e cruz de malta", icon: "⏱️", short: "Girar só para um lado ou aos passos.",
  lead: "A catraca deixa girar só num sentido (chave de catraca, roda livre da bicicleta). A cruz de malta transforma giro contínuo em passos com pausa (projetor de filme, relógio, mesas indexadoras).",
  h: 380,
  controls: [{ k: "m", type: "seg", label: "Mecanismo", v: "catraca", options: [["catraca", "Catraca e lingueta"], ["malta", "Cruz de malta (4 rasgos)"]] }],
  init(s) { s.wheel = 0; s.prev = 0; s.phi = 0; },
  draw(g, s, dt) { s.m === "catraca" ? this.catraca(g, s, dt) : this.malta(g, s, dt); },
  catraca(g, s) {
    const cx = 330, cy = 200, R = 110, n = 18, handle = Math.sin(s.t * 1.6) * 0.45;
    const dh = handle - s.prev; s.prev = handle;
    if (dh > 0) s.wheel += dh; // só avança no golpe para frente
    // roda dentada (dentes de serra)
    const pts = []; for (let i = 0; i < n; i++) { const a0 = s.wheel + i * TAU / n, a1 = a0 + TAU / n; pts.push([cx + Math.cos(a0) * (R - 18), cy + Math.sin(a0) * (R - 18)], [cx + Math.cos(a1 - 0.02) * R, cy + Math.sin(a1 - 0.02) * R]); }
    D.path(g, pts, C.line, 1.6, true, C.steelL); D.pin(g, cx, cy, 10);
    // braço com lingueta
    g.save(); g.translate(cx, cy); g.rotate(handle - 0.3);
    D.link(g, 0, 0, 260, 0, 26, "#9ec0f0");
    const pa = dh > 0 ? 0.15 : 0.35 + Math.abs(Math.sin(s.t * 12)) * 0.08;
    g.translate(R + 26, -10); g.rotate(Math.PI + pa); D.link(g, 0, 0, 34, 0, 10, C.orange); D.pin(g, 0, 0, 4); g.restore();
    D.label(g, dh > 0 ? "empurrando: a lingueta trava no dente e gira a roda" : "voltando: a lingueta pula os dentes (tec-tec)", 470, 340, { color: dh > 0 ? C.green : C.muted });
    D.rot(g, cx, cy, 40, 1, C.green);
  },
  malta(g, s, dt) {
    s.phi += dt * 1.2;
    const n = 4, c = 200, r = c * Math.sin(Math.PI / n), dx = 240, dy = 190, wx = dx + c, wy = dy;
    const ph = ((s.phi % TAU) + TAU) % TAU, rel = ph > Math.PI ? ph - TAU : ph; // 0 = pino apontando para a cruz
    const lim = Math.PI / 2 - Math.PI / n, on = Math.abs(rel) <= lim;
    const P = [dx + r * Math.cos(rel), dy + r * Math.sin(rel)];
    const wheelA = on ? Math.atan2(P[1] - wy, P[0] - wx) - Math.PI : Math.PI / n;
    // cruz: rasgos apontando para o centro, arcos côncavos entre eles (onde o disco de trava encosta)
    const R = c * Math.cos(Math.PI / n) + 16, depth = r + (R - c * Math.cos(Math.PI / n)) + 12, lockR = r * 0.72 + 4;
    g.save(); g.translate(wx, wy); g.rotate(wheelA);
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = "#f6b880"; g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, R + 1, 0, TAU); g.clip();
    for (let i = 0; i < n; i++) { g.save(); g.rotate(i * TAU / n + Math.PI / n); g.beginPath(); g.arc(-c, 0, lockR, 0, TAU); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.4; g.stroke(); g.restore(); }
    for (let i = 0; i < n; i++) { g.save(); g.rotate(i * TAU / n); g.fillStyle = "#fff"; g.fillRect(-R - 4, -10, depth + 4, 20); g.strokeStyle = C.line; g.lineWidth = 1.2; g.strokeRect(-R - 4, -10, depth + 4, 20); g.restore(); }
    g.restore();
    D.pin(g, 0, 0, 10); g.restore();
    // disco motor: disco de trava (com recorte) + braço com pino
    g.save(); g.translate(dx, dy); g.beginPath(); g.arc(0, 0, r * 0.72, rel + 0.9, rel - 0.9 + TAU); g.lineTo(0, 0); g.closePath(); g.fillStyle = "#9ec0f0"; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.5; g.stroke(); g.restore();
    D.link(g, dx, dy, P[0], P[1], 14, "#9ec0f0"); D.circle(g, P[0], P[1], 9, C.red, C.line); D.pin(g, dx, dy, 8);
    D.rot(g, dx, dy, r * 0.72 + 22, 1);
    D.label(g, on ? "pino no rasgo: a cruz gira 1/4 de volta" : "pino fora: o disco de trava segura a cruz (pausa)", 470, 365, { color: on ? C.green : C.muted });
  },
  info(s) {
    return { stats: [], cap: s.m === "catraca" ? "A lingueta empurrada por mola encaixa no dente de serra: num sentido ela agarra, no outro ela escorrega por cima. Roda livre da bicicleta, chave de catraca, catraca de guincho e cinto de segurança usam a mesma ideia." : "A cada volta do disco motor a cruz avança 1/4 de volta e depois fica parada — o tempo parado serve para a máquina trabalhar (furar, encher, mostrar o quadro do filme)." };
  },
  explain: [
    ["Catraca", `<ul><li>Dente assimétrico: rampa de um lado, parede do outro.</li><li>Mola mantém a lingueta encostada.</li><li>Na bicicleta: pedalou, trava; parou de pedalar, a roda segue livre fazendo “tec-tec”.</li></ul>`],
    ["Cruz de malta", `<ul><li>Para <span class="f">n</span> rasgos: avança <span class="f">360°/n</span> por volta.</li><li>Fração do tempo girando: <span class="f">(n−2)/(2n)</span> → 25% com 4 rasgos.</li><li>Entrada e saída suaves: o pino entra tangente ao rasgo.</li></ul>`],
  ],
});

// ---------------- Uniões fixas ----------------
M({
  id: "unioes", group: "Mecanismos e juntas", title: "Uniões: parafuso, rebite, solda e chaveta", icon: "🔩", short: "Como as peças ficam presas de verdade.",
  lead: "Parafuso bom não trabalha “segurando no braço”: ele estica como uma mola e aperta as peças (pré-carga). Veja quando a junta abre, como o rebite forma a cabeça e como a solda funde as peças.",
  h: 380,
  controls: [
    { k: "u", type: "seg", label: "União", v: "paraf", options: [["paraf", "Parafuso (pré-carga)"], ["rebite", "Rebite"], ["solda", "Solda"], ["chaveta", "Chaveta"], ["interf", "Interferência (prensado a quente)"]] },
    { k: "T", label: "Torque de aperto (M10)", min: 0, max: 80, v: 45, unit: "N·m" },
    { k: "F", label: "Carga puxando as chapas", min: 0, max: 40, v: 12, unit: "kN" },
  ],
  pre(s) { return s.T / (0.2 * 0.010) / 1000; }, // kN, F = T / (K·d)
  draw(g, s) { this[s.u](g, s); },
  paraf(g, s) {
    const Fi = this.pre(s), open = s.F > Fi, sep = open ? Math.min(20, (s.F - Fi) * 1.2) : 0, stretch = Math.min(Fi, s.F) * 0.15 + Fi * 0.25;
    const cx = 300, top = 120, plate = 70;
    D.hatch(g, cx - 170, top, 340, plate, "#c8d4e0"); D.hatch(g, cx - 170, top + plate + sep, 340, plate, "#d8c8b0");
    D.rect(g, cx - 14, top - 20, 28, 2 * plate + 40 + sep, "#fff", null);
    D.rect(g, cx - 11, top - 24 - stretch * 0.4, 22, 2 * plate + 48 + sep + stretch * 0.8, "#b8c8d8", C.line);
    for (let y = top + 2 * plate + sep - 10; y < top + 2 * plate + sep + 24 + stretch * 0.4; y += 5) D.line(g, cx - 11, y, cx + 11, y + 3, C.steelD, 1);
    D.rect(g, cx - 34, top - 44 - stretch * 0.4, 68, 22, C.steel, C.line); D.rect(g, cx - 34, top + 2 * plate + sep + stretch * 0.4 + 2, 68, 22, C.steel, C.line);
    D.arrow(g, cx - 120, top - 10, cx - 120, top - 60, C.red, 3); D.arrow(g, cx - 120, top + 2 * plate + sep + 10, cx - 120, top + 2 * plate + sep + 60, C.red, 3);
    D.label(g, `carga ${nf(s.F, 1)} kN`, cx - 220, top - 64, { color: C.red });
    D.label(g, `pré-carga ${nf(Fi, 1)} kN`, cx + 60, top - 40, { color: C.blue });
    if (open) D.label(g, "JUNTA ABRIU — o parafuso agora leva toda a carga e afrouxa com vibração", 380, 350, { color: C.red, bold: true });
    else D.label(g, "Junta fechada: a carga só alivia o aperto entre as chapas", 420, 350, { color: C.green });
    // gráfico força no parafuso × carga
    const pts = [[0, Fi], [Fi, Fi * 1.15], [40, 40 + 0.15 * Fi]], mx = Math.max(45, Fi * 1.3);
    D.plot(g, 560, 60, 300, 180, [{ pts, color: C.blue }, { pts: [[0, 0], [mx, mx]], color: C.muted, dash: [4, 4] }], { xr: [0, mx], yr: [0, mx], title: "força no parafuso × carga externa", xl: "carga (kN)", mark: [s.F, s.F <= Fi ? Fi + 0.15 * s.F : s.F] });
  },
  rebite(g, s) {
    const ph = (s.t * 0.5) % 3, cx = 400, top = 140, sq = clamp(ph - 1, 0, 1);
    D.hatch(g, cx - 200, top, 400, 40, "#c8d4e0"); D.hatch(g, cx - 200, top + 40, 400, 40, "#d8c8b0");
    D.rect(g, cx - 12, top - 8, 24, 96, "#fff", null);
    const down = clamp(ph, 0, 1);
    D.path(g, [[cx - 30, top - 4 - (1 - down) * 80], [cx + 30, top - 4 - (1 - down) * 80], [cx + 10, top + 6 - (1 - down) * 80], [cx - 10, top + 6 - (1 - down) * 80]], C.line, 1.5, true, C.steel);
    const tail = 30 * (1 - sq), wid = 10 + sq * 18;
    D.rect(g, cx - 10, top + 6 - (1 - down) * 80, 20, 80 + tail - 6, C.steel, C.line);
    if (down >= 1) D.path(g, [[cx - 10, top + 80], [cx - wid, top + 80 + 4 + 10 * sq], [cx + wid, top + 80 + 4 + 10 * sq], [cx + 10, top + 80]], C.line, 1.5, true, C.steel);
    D.rect(g, cx - 40, top + 80 + 18 + tail * (1 - sq) + 12 * sq - 6 + 40 * (1 - sq), 80, 26, C.steelD, C.line);
    D.label(g, ["1) rebite entra no furo", "2) a ferramenta amassa a ponta", "3) forma a segunda cabeça e aperta"][Math.floor(ph)], 560, 100);
  },
  solda(g, s) {
    const f = (s.t * 0.15) % 1, x0 = 140, x1 = 740, x = x0 + (x1 - x0) * f, y = 160;
    D.rect(g, x0 - 20, y, 320, 50, C.steelL, C.line); D.rect(g, x0 + 306, y, 320, 50, C.steelL, C.line);
    D.path(g, [[x0 + 300, y], [x0 + 306, y], [x0 + 306, y + 50], [x0 + 300, y + 50]], null);
    g.save(); g.fillStyle = "#a08070"; g.beginPath(); g.moveTo(x0 - 20, y); for (let xx = x0 - 20; xx < x; xx += 8) g.lineTo(xx, y - 8 - Math.sin(xx * 0.5) * 2); g.lineTo(x, y); g.closePath(); g.fill(); g.restore();
    D.line(g, x, y - 90, x - 30, y - 4, C.steelD, 8); D.circle(g, x - 2, y - 4, 10 + Math.random() * 6, "rgba(255,240,180,.9)", null);
    for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, d = 10 + Math.random() * 30; D.line(g, x, y - 6, x + Math.cos(a) * d, y - 6 - Math.abs(Math.sin(a)) * d, C.orange, 1.5); }
    // corte transversal
    const cx = 700, cy = 300;
    D.text(g, "corte da solda de topo", cx, cy - 50, { align: "center", size: 12, bold: true });
    D.hatch(g, cx - 120, cy - 20, 110, 40); D.hatch(g, cx + 10, cy - 20, 110, 40);
    D.path(g, [[cx - 22, cy - 20], [cx + 22, cy - 20], [cx + 8, cy + 20], [cx - 8, cy + 20]], C.line, 1.5, true, "#e0a070");
    D.path(g, [[cx - 26, cy - 20], [cx, cy - 32], [cx + 26, cy - 20]], C.line, 1.5, true, "#e0a070");
    D.text(g, "metal fundido + material de adição", cx, cy + 40, { align: "center", size: 11, color: C.muted });
    D.label(g, "o arco elétrico (≈ 5000 °C) derrete as bordas e o eletrodo", 40, 330);
  },
  chaveta(g, s) {
    const cx = 300, cy = 190, a = Math.sin(s.t * 0.8) * 0.4;
    g.save(); g.translate(cx, cy); g.rotate(a);
    D.circle(g, 0, 0, 130, "#f6b880", C.line); D.circle(g, 0, 0, 70, "#fff", C.line);
    D.circle(g, 0, 0, 68, C.steelL, C.line); D.rect(g, -12, -84, 24, 26, C.red, C.line);
    g.restore();
    D.rot(g, cx, cy, 150, 1, C.blue, -1.8);
    D.text(g, "cubo (polia/engrenagem)", cx + 150, cy - 110, { size: 12 }); D.text(g, "eixo", cx, cy + 4, { align: "center", size: 12 }); D.text(g, "chaveta (vermelha) encaixada nos dois rasgos", cx + 150, cy - 90, { size: 12, color: C.red });
    D.label(g, "a chaveta trabalha ao cisalhamento: o torque tenta “cortar” a peça", 420, 330);
  },
  interf(g, s) {
    const ph = (s.t * 0.3) % 3, heat = ph < 1 ? ph : ph < 2 ? 1 : 3 - ph, cx = 330, cy = 190, hole = 60 + heat * 6, shaftX = ph < 1 ? -220 : ph < 2 ? -220 + (ph - 1) * 220 : 0;
    D.circle(g, cx, cy, 130, heat > 0.2 ? `rgb(${200 + 55 * heat},${150 - 60 * heat},${100 - 60 * heat})` : "#f6b880", C.line); D.circle(g, cx, cy, hole, "#fff", C.line);
    D.circle(g, cx + shaftX, cy, 62, C.steelL, C.line);
    D.label(g, ["1) aquece o cubo: o furo dilata", "2) o eixo (um pouco maior que o furo frio) entra sem esforço", "3) esfriou: o furo encolhe e aperta o eixo com força enorme"][Math.floor(ph)], 430, 340);
    D.text(g, "furo frio: Ø 120,00 · eixo: Ø 120,08 (interferência 0,08 mm)", 520, 60, { size: 12 });
  },
  info(s) {
    if (s.u === "paraf") { const Fi = this.pre(s); return { stats: [["Pré-carga (F ≈ T / 0,2·d)", `${nf(Fi, 1)} kN`], ["Carga externa", `${nf(s.F, 1)} kN`], ["Situação", s.F > Fi ? "junta aberta!" : "junta fechada"]], cap: "Enquanto a pré-carga for maior que a carga, o parafuso quase não sente a variação (só ~15% vai para ele) — por isso ele não sofre fadiga. Aperte com torquímetro: pouco aperto afrouxa, demais estica e rompe." }; }
    const cap = { rebite: "Rebite: união permanente que não afrouxa com vibração — aviões, pontes antigas, carrocerias. Para desmontar, só furando.", solda: "Solda: as peças viram uma só. Resistente e estanque, mas a região aquecida muda de dureza e pode empenar.", chaveta: "Chaveta: trava giro entre eixo e cubo. Barata e fácil de trocar — se sobrecarregar, ela corta antes de quebrar o eixo.", interf: "Ajuste por interferência: rolamentos, engrenagens e rodas de trem são montados assim. Também dá para resfriar o eixo (gelo seco) em vez de aquecer o cubo." }[s.u];
    return { stats: [], cap };
  },
  explain: [
    ["Desmontável × permanente", `<ul><li><b>Desmontáveis:</b> parafuso, chaveta, pino, anel elástico.</li><li><b>Permanentes:</b> rebite, solda, colagem, interferência.</li></ul>`],
    ["Aperto de parafuso", `<p><span class="f">F ≈ T / (K·d)</span>, com K ≈ 0,2 (rosca seca). Rosca lubrificada (K ≈ 0,15) dá mais pré-carga com o mesmo torque — cuidado ao seguir tabelas.</p>`],
    ["Contra afrouxar", `<ul><li>Pré-carga correta (a principal!).</li><li>Porca autotravante, trava química, contrapino, arruela de pressão (pouco eficaz).</li></ul>`],
  ],
});
