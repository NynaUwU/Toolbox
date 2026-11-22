// MechLab — Veículos e motores: mola+amortecedor, suspensões, direção, freio hidráulico e motor 4 tempos.
"use strict";

// ---------------- Mola e amortecedor ----------------
M({
  id: "molaamort", group: "Veículos e motores", title: "Mola e amortecedor", icon: "🛞", short: "Por que o carro não fica pulando depois do buraco.",
  lead: "A mola segura o peso e absorve o impacto; o amortecedor freia o balanço. Tire o amortecedor (ζ baixo) e o carro pula várias vezes. Na estrada ondulada, procure a velocidade de ressonância.",
  h: 380,
  controls: [
    { k: "road", type: "seg", label: "Pista", v: "lomb", options: [["lomb", "Lombada"], ["deg", "Degrau (calçada)"], ["ond", "Estrada ondulada"]] },
    { k: "kmh", label: "Velocidade", min: 5, max: 120, v: 30, unit: "km/h" },
    { k: "z", label: "Amortecimento ζ", min: 0.05, max: 1.5, step: 0.05, v: 0.3, d: 2, fmt: v => `${nf(v, 2)} ${v < 0.15 ? "(amortecedor estourado)" : v < 1 ? "(subamortecido)" : v < 1.05 ? "(crítico)" : "(superamortecido)"}` },
    { k: "k", label: "Rigidez da mola", min: 10, max: 80, v: 25, unit: "kN/m" },
    { k: "m", label: "Massa sobre a roda", min: 150, max: 600, step: 10, v: 350, unit: "kg" },
  ],
  init(s) { s.x = 0; s.v = 0; s.pos = 0; s.hist = []; },
  roadY(s, x) { // altura da pista (m) na posição x (m)
    if (s.road === "ond") return 0.04 * Math.sin(x / 8 * TAU);
    const p = ((x % 40) + 40) % 40;
    if (s.road === "lomb") return p > 20 && p < 23.7 ? 0.08 * Math.sin((p - 20) / 3.7 * Math.PI) : 0;
    return p > 20 && p < 30 ? 0.1 : 0;
  },
  draw(g, s, dt) {
    const v = s.kmh / 3.6, k = s.k * 1000, m = s.m, c = 2 * s.z * Math.sqrt(k * m), steps = 8;
    for (let i = 0; i < steps; i++) {
      const h = dt / steps; s.pos += v * h;
      const yr = this.roadY(s, s.pos), yr2 = this.roadY(s, s.pos + v * 0.001), vr = (yr2 - yr) / 0.001;
      const a = (-k * (s.x - yr) - c * (s.v - vr)) / m; s.v += a * h; s.x += s.v * h;
    }
    s.hist.push([s.t, s.x, this.roadY(s, s.pos)]); while (s.hist.length && s.t - s.hist[0][0] > 6) s.hist.shift();
    // pista rolando
    const px = 500, scale = 900, groundY = 300, mpp = 40; // 1 m = 40 px na horizontal
    const pts = []; for (let X = 0; X <= 900; X += 4) { const wx = s.pos + (X - 300) / mpp; pts.push([X, groundY - this.roadY(s, wx) * scale]); }
    pts.push([900, 380], [0, 380]); D.path(g, pts, C.line, 2, true, "#cfc6b8");
    const yr = this.roadY(s, s.pos), wy = groundY - yr * scale - 34, by = wy - 150 - (s.x - yr) * scale;
    D.wheel(g, 300, wy, 34, -s.pos / 0.3);
    D.spring(g, 285, wy, 285, by + 30, 9, 22, C.dark, 2.5); D.damper(g, 318, by + 30, 318, wy, 60, 14);
    D.rect(g, 230, by - 30, 160, 60, "#9ec0f0", C.line); D.text(g, `${s.m} kg`, 310, by + 6, { align: "center", bold: true });
    // gráfico
    const H = s.hist, t1 = s.t;
    D.plot(g, 450, 40, 410, 180, [{ pts: H.map(([t, , r]) => [t - t1, r * 100]), color: "#8a6a3a", dash: [4, 3] }, { pts: H.map(([t, x]) => [t - t1, x * 100]), color: C.blue, w: 2.5 }], { xr: [-6, 0], yr: [-6, 16], title: "altura da carroceria (azul) e da pista (marrom) — cm", xl: "últimos 6 s" });
  },
  info(s) {
    const k = s.k * 1000, fn = Math.sqrt(k / s.m) / TAU, vres = fn * 8 * 3.6;
    return {
      stats: [["Frequência natural", `${nf(fn, 2)} Hz`], ["Ressonância na ondulada", `≈ ${nf(vres, 0)} km/h`], ["Amortecimento", s.z < 1 ? "subamortecido (balança)" : "sem balanço"], ["Mola estática", `${nf(s.m * 9.81 / k * 100, 1)} cm de compressão`]],
      cap: s.road === "ond" ? `Na estrada ondulada (ondas de 8 m), passar perto de <b>${nf(vres, 0)} km/h</b> faz a pista empurrar a carroceria no mesmo ritmo em que ela já balança: é a <b>ressonância</b>. O amortecedor é o que limita o tamanho do balanço.` : `Carros de passeio usam ζ ≈ 0,2–0,4: um pouco de balanço deixa o carro macio. Com ζ = 1 (crítico) ele volta sem balançar, mas fica duro nos impactos.`,
    };
  },
  explain: [
    ["Cada peça", `<ul><li><b>Mola:</b> guarda a energia do impacto e sustenta o peso.</li><li><b>Amortecedor:</b> óleo passando por furinhos transforma o balanço em calor.</li><li>Sem amortecedor a mola devolve tudo e o carro “quica”.</li></ul>`],
    ["Fórmulas", `<p><span class="f">f<sub>n</sub> = √(k/m) / 2π</span> · <span class="f">c<sub>crítico</sub> = 2·√(k·m)</span> · <span class="f">ζ = c / c<sub>crítico</sub></span></p>`],
    ["Amortecedor ruim", `<ul><li>Carro continua balançando depois da lombada.</li><li>Pneu perde contato em buracos (menos aderência e freio).</li><li>Teste rápido: empurre o canto do carro — deve voltar e parar em ~1 balanço.</li></ul>`],
  ],
});

// ---------------- Tipos de suspensão ----------------
function circ2(p1, r1, p2, r2, up = true) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy); if (d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), mx = p1[0] + a * dx / d, my = p1[1] + a * dy / d;
  return up ? [mx + h * dy / d, my - h * dx / d] : [mx - h * dy / d, my + h * dx / d];
}
M({
  id: "suspensao", group: "Veículos e motores", title: "Tipos de suspensão", icon: "🚙", short: "Eixo rígido, McPherson, duplo A, braço arrastado, feixe de molas.",
  lead: "Cada suspensão guia a roda de um jeito diferente quando ela sobe e desce. Observe o ângulo da roda (cambagem) e o que acontece com a outra roda no eixo rígido.",
  h: 380,
  controls: [
    { k: "tipo", type: "seg", label: "Tipo", v: "duploA", options: [["rigido", "Eixo rígido"], ["mcp", "McPherson"], ["duploA", "Duplo A (bandejas)"], ["arrast", "Braço arrastado (lateral)"], ["feixe", "Feixe de molas (lateral)"]] },
    { k: "amp", label: "Curso da roda", min: 0, max: 60, v: 40, unit: "px" },
  ],
  draw(g, s) {
    const z = Math.sin(s.t * 1.5) * s.amp, T = this[s.tipo].bind(this);
    D.text(g, ["rigido", "mcp", "duploA"].includes(s.tipo) ? "vista de frente" : "vista de lado", 20, 26, { size: 12, color: C.muted });
    s.camber = T(g, z, s) || 0;
  },
  wheelAt(g, x, y, ang, r = 52) { g.save(); g.translate(x, y); g.rotate(ang); D.rect(g, -18, -r, 36, 2 * r, C.rubber, C.line); D.rect(g, -10, -r * 0.6, 20, r * 1.2, C.steelL, C.line); g.restore(); },
  upright(g, L, U, out = 46) { // roda presa na manga (de L até U), deslocada para fora
    const d = Math.hypot(U[0] - L[0], U[1] - L[1]), ux = (U[0] - L[0]) / d, uy = (U[1] - L[1]) / d, n = [uy, -ux];
    const mid = [(L[0] + U[0]) / 2, (L[1] + U[1]) / 2], ang = Math.atan2(ux, -uy);
    this.wheelAt(g, mid[0] + n[0] * out, mid[1] + n[1] * out, ang);
    return ang;
  },
  duploA(g, z) {
    const PL = [520, 270], PU = [470, 175], lenL = 180, lenU = 130, upr = 95;
    const L = [PL[0] - Math.sqrt(lenL * lenL - z * z), PL[1] - z];
    const c1 = circ2(PU, lenU, L, upr, true), c2 = circ2(PU, lenU, L, upr, false);
    const U = (!c1 ? c2 : !c2 ? c1 : (c1[0] < c2[0] ? c1 : c2)) || [L[0], L[1] - upr];
    D.rect(g, 490, 130, 280, 170, "#e8eef4", C.line); D.text(g, "chassi", 640, 220, { size: 12, color: C.muted });
    const ang = this.upright(g, L, U);
    D.link(g, ...PL, ...L, 12, "#9ec0f0"); D.link(g, ...PU, ...U, 12, "#9ec0f0"); D.link(g, ...L, ...U, 14, C.steel);
    const am = [L[0] + (PL[0] - L[0]) * 0.35, L[1] + (PL[1] - L[1]) * 0.35];
    D.spring(g, ...am, 470, 120, 7, 20); D.line(g, 450, 120, 500, 120, C.line, 3);
    for (const p of [PL, PU, L, U]) D.pin(g, ...p, 6);
    D.ground(g, 200, 330, 260);
    D.label(g, `cambagem ${nf(ang * 180 / Math.PI, 1)}°`, 60, 60);
    D.text(g, "bandeja de cima mais curta: a roda inclina para dentro ao subir (cambagem negativa) e segura melhor na curva", 450, 365, { align: "center", size: 12 });
    return ang;
  },
  mcp(g, z) {
    const PL = [520, 280], lenL = 170, Tm = [395, 70];
    const L = [PL[0] - Math.sqrt(lenL * lenL - z * z), PL[1] - z];
    D.path(g, [[490, 300], [490, 130], [420, 120], [420, 50], [780, 50], [780, 300]], C.line, 1.6, true, "#e8eef4"); D.text(g, "carroceria (torre do amortecedor)", 600, 180, { size: 12, color: C.muted, align: "center" });
    const U = [L[0] + (Tm[0] - L[0]) * 0.45, L[1] + (Tm[1] - L[1]) * 0.45];
    const ang = this.upright(g, L, U, 44);
    D.link(g, ...PL, ...L, 12, "#9ec0f0");
    D.damper(g, ...L, ...Tm, 130, 18); D.spring(g, ...U, Tm[0], Tm[1] + 8, 7, 34);
    D.pin(g, ...PL, 6); D.pin(g, ...L, 6); D.circle(g, ...Tm, 10, C.rubber, C.line);
    D.ground(g, 200, 340, 260);
    D.label(g, `cambagem ${nf(ang * 180 / Math.PI, 1)}°`, 60, 60);
    D.text(g, "o próprio amortecedor guia a roda: simples, barato e ocupa pouco espaço (a maioria dos carros populares)", 450, 372, { align: "center", size: 12 });
    return ang;
  },
  rigido(g, z) {
    const yL = 250 - z, yR = 250 + z * 0.0, xL = 200, xR = 700, ang = Math.atan2(yR - yL, xR - xL);
    D.rect(g, 250, 90 - z * 0.5, 400, 70, "#e8eef4", C.line); D.text(g, "carroceria", 450, 130, { align: "center", size: 12, color: C.muted });
    D.link(g, xL, yL, xR, yR, 22, C.steel); D.rect(g, 425, (yL + yR) / 2 - 22, 50, 44, C.steelD, C.line);
    this.wheelAt(g, xL - 10, yL, ang); this.wheelAt(g, xR + 10, yR, ang);
    D.spring(g, xL + 60, yL - 12, xL + 60, 160 - z * 0.5, 7, 22); D.spring(g, xR - 60, yR - 12, xR - 60, 160 - z * 0.5, 7, 22);
    D.label(g, `as duas rodas inclinam ${nf(ang * 180 / Math.PI, 1)}°`, 60, 60);
    D.text(g, "uma roda sobe e a outra é inclinada junto · robusto, ótimo para carga e fora de estrada, menos conforto", 450, 365, { align: "center", size: 12 });
    return ang;
  },
  arrast(g, z) {
    const P = [300, 200], len = 220, a = Math.asin(clamp(z / len, -0.9, 0.9)), W = [P[0] + len * Math.cos(a), P[1] + len * Math.sin(a) * -1 + 0];
    W[1] = P[1] + 60 - z;
    W[0] = P[0] + Math.sqrt(len * len - (W[1] - P[1]) ** 2);
    D.rect(g, 180, 80, 560, 80, "#e8eef4", C.line); D.text(g, "frente ←", 190, 100, { size: 12, color: C.muted });
    D.wheel(g, W[0], W[1], 60, -s_spin(z));
    D.link(g, ...P, ...W, 18, "#9ec0f0"); D.anchor(g, P[0], P[1], 12);
    D.spring(g, W[0] - 60, W[1] - 20, W[0] - 60, 160, 7, 22); D.damper(g, W[0] + 30, 160, W[0] + 10, W[1] - 10, 50, 12);
    g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.red; g.beginPath(); g.arc(P[0], P[1], len, -0.3, 0.6); g.stroke(); g.restore();
    D.text(g, "a roda sobe num arco em volta do pivô dianteiro · traseira de carros compactos e motos (balança)", 450, 365, { align: "center", size: 12 });
    return 0;
  },
  feixe(g, z) {
    const yC = 250 - z, x0 = 220, x1 = 680, bend = 30 + z * 0.6;
    D.rect(g, 180, 90 - z * 0.3, 560, 60, "#e8eef4", C.line);
    for (let i = 0; i < 5; i++) { const w = (x1 - x0) * (1 - i * 0.16) / 2, cx = 450; g.save(); g.strokeStyle = C.steelD; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - w, 180 + i * 7 - bend * (1 - i * 0.1)); g.quadraticCurveTo(cx, 180 + i * 7 + bend, cx + w, 180 + i * 7 - bend * (1 - i * 0.1)); g.stroke(); g.restore(); }
    D.line(g, x0, 150 - z * 0.3, x0, 180 - bend, C.line, 3); D.line(g, x1, 150 - z * 0.3, x1, 180 - bend, C.line, 3);
    D.wheel(g, 450, yC + 40, 70, 0); D.rect(g, 430, 180 + bend - 4, 40, 24, C.steel, C.line);
    D.text(g, "lâminas de aço empilhadas: são a mola E prendem o eixo · caminhões e picapes", 450, 365, { align: "center", size: 12 });
    return 0;
  },
  info(s) {
    const c = { rigido: "Eixo rígido: o mais simples e resistente. Como as rodas são ligadas, um buraco de um lado mexe no outro.", mcp: "McPherson: o amortecedor faz parte da estrutura e serve de pivô de direção. Cambagem muda pouco e de forma menos favorável que no duplo A.", duploA: "Duplo A: duas bandejas de tamanhos diferentes controlam com precisão a cambagem. Carros esportivos e caminhonetes de luxo.", arrast: "Braço arrastado: simples e compacto, a roda se move no plano lateral (sem mudar cambagem).", feixe: "Feixe de molas: aguenta muito peso e não precisa de braços extras, mas é duro e pesado." }[s.tipo];
    return { stats: [["Cambagem agora", `${nf((s.camber || 0) * 180 / Math.PI, 1)}°`]], cap: c };
  },
  explain: [
    ["Funções da suspensão", `<ul><li>Manter o pneu encostado no chão (aderência).</li><li>Isolar a carroceria dos impactos (conforto).</li><li>Controlar a geometria (cambagem, convergência) ao subir, descer e frear.</li></ul>`],
    ["Independente × rígida", `<p><b>Independente:</b> cada roda trabalha sozinha (McPherson, duplo A, multilink). <b>Rígida:</b> as rodas compartilham o eixo.</p>`],
    ["Barra estabilizadora", `<p>Uma barra de torção liga os dois lados: na curva, quando um lado afunda, ela torce e puxa o outro, reduzindo a inclinação da carroceria.</p>`],
  ],
});
function s_spin(z) { return z / 60; }

// ---------------- Direção e Ackermann ----------------
M({
  id: "direcao", group: "Veículos e motores", title: "Direção: cremalheira e Ackermann", icon: "🎯", short: "Por que as rodas da frente viram ângulos diferentes.",
  lead: "Na curva, a roda de dentro faz um círculo menor e precisa virar mais. A geometria de Ackermann faz os prolongamentos dos eixos das rodas se encontrarem num ponto só, no eixo traseiro.",
  h: 400,
  controls: [
    { k: "vol", label: "Volante", min: -540, max: 540, step: 10, v: 360, unit: "°" },
    { k: "ack", type: "seg", label: "Geometria", v: "ack", options: [["ack", "Ackermann"], ["par", "Paralela (rodas iguais)"]] },
  ],
  geo(s) {
    const L = 2.6, w = 1.5, ratio = 16, avg = s.vol / ratio * Math.PI / 180;
    if (Math.abs(avg) < 1e-4) return { di: 0, do: 0, R: Infinity, avg };
    const R = L / Math.tan(Math.abs(avg)), sg = Math.sign(avg);
    if (s.ack === "par") return { di: avg, do: avg, R, avg };
    const di = Math.atan(L / (R - w / 2)), dO = Math.atan(L / (R + w / 2));
    return { di: sg * di, do: sg * dO, R, avg };
  },
  draw(g, s) {
    const { di, do: dO, R, avg } = this.geo(s), sc = 42, cx = 330, fy = 120, ry = fy + 2.6 * sc, hw = 0.75 * sc;
    D.rect(g, cx - hw - 20, fy - 50, 2 * hw + 40, ry - fy + 100, "#e8eef4", C.line);
    // rodas traseiras
    for (const x of [cx - hw, cx + hw]) D.rect(g, x - 9, ry - 26, 18, 52, C.rubber, C.line);
    D.line(g, cx - hw, ry, cx + hw, ry, C.steelD, 3);
    // rodas dianteiras (esq/dir): para curva à direita (avg>0) a direita é a de dentro
    const right = avg >= 0 ? di : dO, left = avg >= 0 ? dO : di;
    const wheel = (x, a) => { g.save(); g.translate(x, fy); g.rotate(a); D.rect(g, -9, -26, 18, 52, C.rubber, C.line); g.restore(); };
    wheel(cx - hw, left); wheel(cx + hw, right);
    // cremalheira e barras
    const rack = s.vol / 540 * 18;
    D.rect(g, cx - hw + 20 + rack, fy + 30, 2 * hw - 40, 10, C.steel, C.line); D.circle(g, cx + rack * 0, fy + 35, 9, "#f6b880", C.line);
    D.line(g, cx - hw + 20 + rack, fy + 35, cx - hw + Math.sin(left) * 0 - 18 * Math.cos(left) * 0 + 0, fy + 24, C.steelD, 3);
    D.line(g, cx + hw - 20 + rack, fy + 35, cx + hw, fy + 24, C.steelD, 3);
    // prolongamento dos eixos das rodas
    if (isFinite(R) && R < 60) {
      const tcx = cx + Math.sign(avg) * R * sc, tcy = ry;
      g.save(); g.setLineDash([5, 4]); g.lineWidth = 1.2;
      for (const [x, a, c] of [[cx - hw, left, C.red], [cx + hw, right, C.blue]]) { g.strokeStyle = c; g.beginPath(); g.moveTo(x, fy); g.lineTo(x + Math.cos(a) * 2000 * Math.sign(avg), fy + Math.sin(a) * 2000 * Math.sign(avg)); g.stroke(); }
      g.strokeStyle = C.muted; g.beginPath(); g.moveTo(cx - hw, ry); g.lineTo(tcx, ry); g.stroke(); g.restore();
      if (tcx > 0 && tcx < 900) D.circle(g, tcx, tcy, 6, s.ack === "ack" ? C.green : C.red, C.line);
    }
    // volante
    g.save(); g.translate(110, 90); g.rotate(s.vol * Math.PI / 180); D.circle(g, 0, 0, 50, null, C.line, 8); D.line(g, -50, 0, 50, 0, C.line, 6); D.line(g, 0, 0, 0, 50, C.line, 6); D.circle(g, 0, 0, 12, C.steelD, C.line); g.restore();
    D.text(g, `volante ${s.vol}°`, 110, 170, { align: "center", size: 12 });
    D.label(g, `roda esq. ${nf(left * 180 / Math.PI, 1)}° · dir. ${nf(right * 180 / Math.PI, 1)}°`, 600, 30);
  },
  info(s) {
    const { di, do: dO, R } = this.geo(s);
    return { stats: [["Raio da curva (eixo traseiro)", isFinite(R) ? `${nf(R, 1)} m` : "reta"], ["Roda de dentro", `${nf(Math.abs(di) * 180 / Math.PI, 1)}°`], ["Roda de fora", `${nf(Math.abs(dO) * 180 / Math.PI, 1)}°`], ["Relação de direção", "16 : 1"]],
      cap: s.ack === "ack" ? "Com Ackermann, as linhas tracejadas se cruzam num ponto só (verde) no prolongamento do eixo traseiro: todas as rodas giram em volta dele, sem arrastar." : "Com as duas rodas no mesmo ângulo, as linhas não se encontram no eixo traseiro: uma das rodas é arrastada de lado na curva (pneu chiando e gastando)." };
  },
  explain: [
    ["Cremalheira", `<p>O pinhão no fim da coluna de direção empurra a cremalheira para os lados; as barras (terminais) empurram os braços das rodas. Relação típica: 14 a 18 graus de volante por grau de roda.</p>`],
    ["Ackermann", `<p><span class="f">tan δ<sub>dentro</sub> = L / (R − b/2)</span> · <span class="f">tan δ<sub>fora</sub> = L / (R + b/2)</span> (L = entre-eixos, b = bitola). Os braços de direção apontam para o centro do eixo traseiro para conseguir isso.</p>`],
    ["Alinhamento", `<ul><li><b>Convergência:</b> rodas levemente “de bico” para dentro ou fora.</li><li><b>Cáster:</b> inclinação do eixo de esterço — faz o volante voltar sozinho.</li></ul>`],
  ],
});

// ---------------- Freio hidráulico ----------------
M({
  id: "freio", group: "Veículos e motores", title: "Freio hidráulico e ABS", icon: "🛑", short: "Pascal multiplicando a força do pé.",
  lead: "O pé empurra um pistão pequeno; o óleo leva a mesma pressão até pistões grandes na pinça, que apertam as pastilhas no disco. Freie forte na pista molhada com e sem ABS.",
  h: 380,
  controls: [
    { k: "pe", label: "Força do pé", min: 0, max: 500, step: 10, v: 250, unit: "N" },
    { k: "brake", type: "hold", label: "🛑 Segure para frear" },
    { k: "mu", type: "seg", label: "Pista", v: 0.9, options: [[0.9, "Asfalto seco"], [0.5, "Molhado"], [0.15, "Gelo"]] },
    { k: "abs", type: "check", label: "ABS ligado", v: true },
  ],
  init(s) { s.v = 22; s.w = 22; s.ang = 0; s.stop = 0; s.marks = 0; s.absOn = false; },
  calc(s) {
    const pedalRatio = 4, Am = Math.PI * 0.011 ** 2, Ac = 2 * Math.PI * 0.027 ** 2, booster = 3;
    const Fm = (s.brake ? s.pe : 0) * pedalRatio * booster, p = Fm / Am, Fc = p * Ac;
    return { Fm, p, Fc, Tb: Fc * 2 * 0.4 * 0.11 * 4 }; // 4 rodas, μ pastilha 0,4, raio 11 cm
  },
  draw(g, s, dt) {
    const c = this.calc(s), mass = 1200, R = 0.3, Iw = 1.2, mu = +s.mu;
    // dinâmica simples (carro inteiro como uma roda)
    if (s.v <= 0.05 && s.w <= 0.05) { s.stop += dt; if (s.stop > 1.5 && !s.brake) { s.v = 22; s.w = 22; s.stop = 0; s.marks = 0; } }
    let Tb = c.Tb;
    // ABS: a central limita a pressão para a roda ficar perto do escorregamento ideal (~10–15%), pulsando
    s.absOn = s.abs && s.brake && s.v > 1 && Tb > mu * mass * 9.81 * R * 0.9;
    if (s.absOn) Tb = mu * mass * 9.81 * R * (0.86 + 0.08 * Math.sin(s.t * 70));
    const slip = s.v > 0.1 ? clamp((s.v - s.w) / s.v, 0, 1) : 0, muEff = mu * (slip < 0.15 ? slip / 0.15 : 1 - 0.25 * (slip - 0.15) / 0.85);
    const Fx = muEff * mass * 9.81;
    s.v = Math.max(0, s.v - Fx / mass * dt);
    s.w = Math.max(0, s.w + (Fx * R - Tb) / (Iw * 4) * R * dt);
    if (!s.brake && s.w < s.v) s.w = s.v;
    if (s.w > s.v) s.w = s.v;
    if (slip > 0.9 && s.v > 0.5) s.marks = Math.min(300, s.marks + s.v * dt * 20);
    s.ang += s.w * dt / R * 0.25;
    // pedal → cilindro mestre
    const press = s.brake ? s.pe / 500 : 0;
    D.anchor(g, 90, 150, 10); g.save(); g.translate(90, 150); g.rotate(0.3 + press * 0.35); D.link(g, 0, 0, 0, 160, 12, C.steelD); D.rect(g, -26, 150, 52, 16, C.rubber, C.line); g.restore();
    const mx = 110 + press * 20;
    D.line(g, 98, 205, mx + 40, 205, C.steelD, 5);
    D.rect(g, 150, 185, 110, 40, "#fff", C.line, 2); D.rect(g, 150 + 8 + press * 20, 189, 20, 32, C.steel, C.line);
    D.rect(g, 178 + press * 20, 191, 80 - press * 20, 28, C.oilL, null);
    D.text(g, "cilindro mestre (pistão pequeno)", 150, 245, { size: 11 });
    // tubulação
    D.pipe(g, [[260, 205], [520, 205], [520, 130]], C.oilL, 10);
    D.gauge(g, 380, 140, 30, c.p / 12e6, `${nf(c.p / 1e5, 0)} bar`);
    // disco e pinça
    const dx = 640, dy = 210, dr = 110, hot = clamp(s.marks / 300, 0, 1) * 0 + (s.brake && s.w > 0.5 ? 0.4 : 0);
    D.circle(g, dx, dy, dr, hot ? `rgb(${200 + 55 * hot},${170 - 60 * hot},150)` : C.steelL, C.line); D.circle(g, dx, dy, 40, C.steel, C.line);
    g.save(); g.translate(dx, dy); g.rotate(s.ang); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; D.circle(g, Math.cos(a) * 75, Math.sin(a) * 75, 5, "#fff", C.line, 1); } D.line(g, 45, 0, dr - 5, 0, C.red, 3); g.restore();
    const gap = s.brake ? 0 : 6;
    D.rect(g, dx - 40, dy - dr - 30, 80, 46, "#c8343c", C.line); D.text(g, "pinça", dx, dy - dr - 36, { align: "center", size: 12 });
    D.rect(g, dx - 30, dy - dr + 8 - gap, 60, 10, "#6a4a2a", C.line);
    D.text(g, s.w < 0.3 && s.v > 0.5 ? "RODA TRAVADA!" : s.absOn ? "ABS pulsando" : "", dx, dy + dr + 30, { align: "center", bold: true, color: s.absOn ? C.orange : C.red });
    // estrada e velocidade
    D.label(g, `velocidade ${nf(s.v * 3.6, 0)} km/h · roda ${nf(s.w * 3.6, 0)} km/h`, 40, 330);
    if (s.marks > 0) D.line(g, 400, 355, 400 + s.marks, 355, "#222", 4);
    D.text(g, s.marks > 0 ? "marca de pneu arrastando" : "", 400, 375, { size: 11, color: C.muted });
  },
  info(s) {
    const c = this.calc(s);
    return { stats: [["Força no pistão mestre (pedal ×4, servo ×3)", `${nf(c.Fm / 1000, 2)} kN`], ["Pressão no óleo", `${nf(c.p / 1e5, 0)} bar`], ["Força de cada pinça", `${nf(c.Fc / 1000, 1)} kN`], ["Multiplicação hidráulica", `${nf(2 * 0.027 ** 2 / 0.011 ** 2, 1)}×`]],
      cap: s.abs ? "Com ABS, quando a roda começa a travar (escorregar mais de ~15%), a central alivia a pressão por um instante e aplica de novo — dezenas de vezes por segundo. A roda continua girando: o carro freia forte e ainda obedece ao volante." : "Sem ABS, pisando forte demais a roda trava e o pneu arrasta: o atrito cai (cinético) e o carro não responde ao volante." };
  },
  explain: [
    ["Pascal", `<p>A pressão é a mesma em todo o óleo: <span class="f">p = F<sub>mestre</sub> / A<sub>mestre</sub></span> e <span class="f">F<sub>pinça</sub> = p × A<sub>pinça</sub></span>. Pistão da pinça maior = mais força (e o pedal anda mais).</p>`],
    ["Peças", `<ul><li><b>Servo-freio:</b> usa vácuo do motor para multiplicar a força do pé.</li><li><b>Disco + pinça</b> ou <b>tambor + sapatas</b>.</li><li>Fluido de freio absorve água com o tempo: troque a cada 2 anos (ferve e o pedal fica “borrachudo”).</li></ul>`],
    ["Ar na linha", `<p>Ar se comprime, óleo não: com ar o pedal afunda sem frear. Por isso se “sangra” o freio.</p>`],
  ],
});

// ---------------- Motor 4 tempos ----------------
M({
  id: "motor4t", group: "Veículos e motores", title: "Motor 4 tempos", icon: "🔥", short: "Admissão, compressão, explosão, escape.",
  lead: "Duas voltas do virabrequim, quatro cursos do pistão. As válvulas são abertas pelo comando (que gira na metade da rotação) e a vela solta a faísca no fim da compressão.",
  h: 420,
  controls: [
    { k: "rpm", label: "Rotação (desenho)", min: 5, max: 90, v: 20, unit: "rpm" },
    { k: "diesel", type: "check", label: "Diesel (sem vela: o ar esquenta ao ser comprimido e o diesel é injetado)", v: false },
  ],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * s.rpm / 60 * TAU;
    const th = ((s.a % (2 * TAU)) + 2 * TAU) % (2 * TAU), deg = th * 180 / Math.PI;
    const cx = 300, crankY = 330, r = 50, L = 140, bore = 120;
    const yP = crankY - (r * Math.cos(th) + Math.sqrt(L * L - (r * Math.sin(th)) ** 2)); // topo do pino do pistão
    const cylTop = crankY - (r + L) - 70, pistonTop = yP - 30;
    const phase = deg < 180 ? 0 : deg < 360 ? 1 : deg < 540 ? 2 : 3;
    const names = ["1. ADMISSÃO", "2. COMPRESSÃO", "3. COMBUSTÃO (expansão)", "4. ESCAPE"];
    const gas = [C.airL, "#9ec8f0", "#ff8a3a", "#a0a0a0"][phase];
    // gás na câmara
    const burn = phase === 2 ? Math.max(0, 1 - (deg - 360) / 120) : 0;
    D.rect(g, cx - bore / 2, cylTop, bore, pistonTop - cylTop, phase === 2 ? `rgb(255,${140 + 80 * (1 - burn)},${60 + 80 * (1 - burn)})` : gas, null);
    // paredes e cabeçote
    D.hatch(g, cx - bore / 2 - 16, cylTop - 30, 16, 250); D.hatch(g, cx + bore / 2, cylTop - 30, 16, 250);
    D.hatch(g, cx - bore / 2 - 16, cylTop - 46, bore + 32, 16);
    // válvulas (admissão à esquerda, escape à direita)
    const lift = (open0, open1) => { if (deg < open0 || deg > open1) return 0; return Math.sin((deg - open0) / (open1 - open0) * Math.PI) * 16; };
    const li = lift(0, 190), le = lift(530, 720);
    for (const [vx, l, col, lab] of [[cx - 30, li, C.blue, "admissão"], [cx + 30, le, C.dark, "escape"]]) {
      D.line(g, vx, cylTop - 80, vx, cylTop + l - 4, C.steelD, 5); D.path(g, [[vx - 18, cylTop + l], [vx + 18, cylTop + l], [vx + 8, cylTop + l - 8], [vx - 8, cylTop + l - 8]], C.line, 1.2, true, C.steel);
      D.spring(g, vx, cylTop - 80, vx, cylTop - 50, 5, 14);
      D.text(g, lab, vx, cylTop - 92, { align: "center", size: 11, color: col });
    }
    if (li > 1) D.flow(g, [[cx - 120, cylTop - 30], [cx - 40, cylTop - 30], [cx - 30, cylTop + 20]], C.blue, 3, s.t, 1.5);
    if (le > 1) D.flow(g, [[cx + 30, cylTop + 20], [cx + 40, cylTop - 30], [cx + 120, cylTop - 30]], "#666", 3, s.t, 1.5);
    // vela ou injetor
    D.rect(g, cx - 5, cylTop - 70, 10, 30, s.diesel ? C.steelD : "#e8e8e8", C.line);
    if (deg > 345 && deg < 375) { if (s.diesel) D.flow(g, [[cx, cylTop - 40], [cx, cylTop + 30]], "#8a6a20", 3, s.t, 3, [3, 4]); else D.circle(g, cx, cylTop - 34, 10 + Math.random() * 6, "rgba(255,240,120,.95)", null); }
    // pistão, biela, virabrequim
    D.rect(g, cx - bore / 2 + 3, pistonTop, bore - 6, 50, C.steelL, C.line); D.line(g, cx - bore / 2 + 3, pistonTop + 8, cx + bore / 2 - 3, pistonTop + 8, C.muted, 1); D.line(g, cx - bore / 2 + 3, pistonTop + 14, cx + bore / 2 - 3, pistonTop + 14, C.muted, 1);
    const Bx = cx + r * Math.sin(th), By = crankY - r * Math.cos(th);
    D.circle(g, cx, crankY, r + 18, "#e4e4e4", C.line, 1); D.link(g, cx, crankY, Bx, By, 22, C.steel); D.link(g, Bx, By, cx, yP, 16, "#9ec0f0");
    D.pin(g, cx, crankY, 8); D.pin(g, Bx, By, 6); D.pin(g, cx, yP, 6);
    if (phase === 2) D.arrow(g, cx + bore / 2 + 40, pistonTop - 40, cx + bore / 2 + 40, pistonTop + 20, C.red, 4);
    // painel de fases
    names.forEach((n, i) => D.text(g, n, 560, 90 + i * 40, { bold: i === phase, size: 15, color: i === phase ? C.red : C.muted }));
    D.text(g, `virabrequim: ${nf(deg, 0)}° de 720°`, 560, 270, { size: 12 });
    D.text(g, `comando de válvulas: ${nf(deg / 2, 0)}° de 360°`, 560, 292, { size: 12 });
    const desc = ["pistão desce, válvula de admissão aberta: entra ar (e combustível)", "válvulas fechadas, pistão sobe: comprime a mistura ~10× (diesel ~18×)", s.diesel ? "diesel injetado no ar quente: inflama sozinho e empurra o pistão" : "faísca! a queima aumenta a pressão e empurra o pistão (único tempo que gera força)", "válvula de escape aberta, pistão sobe e expulsa os gases"][phase];
    D.label(g, desc, 30, 405, { size: 12 });
  },
  info(s) {
    return { stats: [["Voltas por ciclo", "2 do virabrequim"], ["Tempo que dá força", "1 de 4"], ["Taxa de compressão típica", s.diesel ? "16 a 20 : 1" : "9 a 12 : 1"]],
      cap: "Só um dos quatro tempos empurra; nos outros o motor gasta energia. O volante (e os outros cilindros, em tempos diferentes) mantém o giro uniforme. Motor de 4 cilindros: uma explosão a cada meia volta." };
  },
  explain: [
    ["Ordem", `<ol style="padding-left:18px"><li>Admissão</li><li>Compressão</li><li>Combustão/expansão</li><li>Escape</li></ol><p>“Aspira, comprime, explode, expulsa.”</p>`],
    ["Gasolina × diesel", `<ul><li><b>Otto (gasolina, etanol):</b> mistura comprimida e acesa por faísca.</li><li><b>Diesel:</b> comprime só ar até esquentar ~600 °C; o combustível injetado pega fogo sozinho.</li></ul>`],
    ["Números", `<p>Cilindrada = área do pistão × curso × nº de cilindros. Um 1.0 de 3 cilindros tem ~333 cm³ por cilindro.</p>`],
  ],
});
