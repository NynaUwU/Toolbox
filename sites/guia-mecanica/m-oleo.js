// MechLab — Hidráulica (óleo): circuito com válvula direcional, cilindros, válvulas em corte e macaco hidráulico.
"use strict";
const PRES = "#d43a2a", RET = "#3a7ad8", IDLE = "#b0b0b0";

/** Símbolo ISO de válvula 4/3 (3 quadrados). pos: -1 recuar, 0 centro, 1 avançar. */
function valve43(g, x, y, pos, sz = 46) {
  const shift = -pos * sz; // o quadrado ativo fica alinhado com as conexões
  for (let i = -1; i <= 1; i++) {
    const bx = x + i * sz + shift - sz / 2, active = i === pos;
    D.rect(g, bx, y, sz, sz, active ? "#fff8d0" : "#fff", C.line, 1.6);
    const p = [bx + sz * 0.3, y + sz], t = [bx + sz * 0.7, y + sz], a = [bx + sz * 0.3, y], b = [bx + sz * 0.7, y];
    if (i === 1) { D.arrow(g, p[0], p[1], a[0], a[1] + 2, C.line, 1.5, 7); D.arrow(g, b[0], b[1], t[0], t[1] - 2, C.line, 1.5, 7); }
    if (i === -1) { D.arrow(g, p[0], p[1], b[0], b[1] + 2, C.line, 1.5, 7); D.arrow(g, a[0], a[1], t[0], t[1] - 2, C.line, 1.5, 7); }
    if (i === 0) { D.line(g, p[0], p[1], t[0], t[1] - 10, C.line, 1.5); D.line(g, t[0], t[1] - 10, t[0], t[1], C.line, 1.5); D.line(g, p[0], p[1], p[0], p[1] - 10, C.line, 1.5); D.line(g, p[0], p[1] - 10, t[0], p[1] - 10, C.line, 1.5); D.line(g, a[0] - 4, a[1] + 8, a[0] + 4, a[1] + 8, C.line, 2); D.line(g, b[0] - 4, b[1] + 8, b[0] + 4, b[1] + 8, C.line, 2); D.line(g, a[0], a[1], a[0], a[1] + 8, C.line, 1.5); D.line(g, b[0], b[1], b[0], b[1] + 8, C.line, 1.5); }
  }
  // molas e alavanca
  D.spring(g, x - 1.5 * sz + shift - 22, y + sz / 2, x - 1.5 * sz + shift, y + sz / 2, 4, 10);
  D.spring(g, x + 1.5 * sz + shift, y + sz / 2, x + 1.5 * sz + shift + 22, y + sz / 2, 4, 10);
}

// ---------------- Circuito hidráulico ----------------
M({
  id: "hcircuito", group: "Hidráulica (óleo)", title: "Circuito hidráulico básico", icon: "🛢️", short: "Bomba, alívio, válvula direcional e cilindro.",
  lead: "Mexa na alavanca da válvula direcional: o óleo da bomba vai para um lado do cilindro e o outro lado volta ao tanque. Coloque carga demais e veja a válvula de alívio abrir.",
  h: 420,
  controls: [
    { k: "pos", type: "seg", label: "Alavanca da válvula 4/3", v: 1, options: [[-1, "◀ Recuar"], [0, "Neutro"], [1, "Avançar ▶"]] },
    { k: "load", label: "Carga no cilindro", min: 0, max: 120, v: 40, unit: "kN" },
    { k: "relief", label: "Ajuste da válvula de alívio", min: 50, max: 250, v: 160, unit: "bar" },
    { k: "Q", label: "Vazão da bomba", min: 5, max: 60, v: 20, unit: "L/min" },
  ],
  init(s) { s.x = 0.3; },
  calc(s) {
    const D1 = 0.08, d = 0.045, A = Math.PI * D1 * D1 / 4, Ar = A - Math.PI * d * d / 4;
    const area = s.pos >= 0 ? A : Ar, pNeed = s.pos === 0 ? 3e5 : s.load * 1000 / area + 5e5;
    const atEnd = (s.pos === 1 && s.x >= 1) || (s.pos === -1 && s.x <= 0);
    const relief = s.relief * 1e5, stall = s.pos !== 0 && (pNeed > relief || atEnd);
    const p = s.pos === 0 ? 3e5 : stall ? relief : pNeed;
    const v = s.pos === 0 || stall ? 0 : (s.Q / 60000) / area; // m/s
    return { A, Ar, p, v, stall, pNeed, F: relief * area / 1000 };
  },
  draw(g, s, dt) {
    const c = this.calc(s);
    s.x = clamp(s.x + s.pos * c.v * dt / 0.5, 0, 1); // curso de 0,5 m
    const ext = s.pos === 1 && !c.stall, ret = s.pos === -1 && !c.stall, sp = s.Q / 20;
    // posições
    const tank = [120, 360], pump = [120, 250], vx = 430, vy = 170, cylX = 520, cylY = 60, cylW = 200, cylH = 60;
    // tanque
    D.rect(g, tank[0] - 60, tank[1] - 30, 120, 50, C.oilL, C.line, 2); D.text(g, "tanque", tank[0], tank[1] + 34, { align: "center", size: 12 });
    // bomba (símbolo)
    D.circle(g, ...pump, 22, "#fff", C.line, 2); D.path(g, [[pump[0], pump[1] - 22], [pump[0] - 8, pump[1] - 10], [pump[0] + 8, pump[1] - 10]], C.line, 1, true, C.line);
    D.line(g, pump[0] - 30, pump[1], pump[0] - 22, pump[1], C.line, 2); D.text(g, "bomba", pump[0] - 40, pump[1] + 40, { size: 12 });
    D.line(g, pump[0], tank[1] - 30, pump[0], pump[1] + 22, RET, 3); D.flow(g, [[pump[0], tank[1] - 30], [pump[0], pump[1] + 22]], C.oil, 3, s.t, sp);
    // linha de pressão até a válvula (P)
    const P = [vx - 46 * 0.2, vy + 46], T = [vx + 46 * 0.2, vy + 46];
    const pLine = [[pump[0], pump[1] - 22], [pump[0], 120], [300, 120], [300, 260], [P[0], 260], [P[0], P[1]]];
    D.path(g, pLine, c.stall || s.pos !== 0 ? PRES : "#e8a090", 3);
    // alívio
    const rx = 300, ry = 300, ropen = c.stall;
    D.rect(g, rx - 18, ry, 36, 40, "#fff", C.line, 1.6); D.arrow(g, rx - 10, ry + 34, rx + (ropen ? 10 : -4), ry + 6, C.line, 1.5, 6); D.spring(g, rx + 18, ry + 20, rx + 36, ry + 20, 3, 8);
    D.line(g, rx, 260, rx, ry, PRES, 3); D.path(g, [[rx, ry + 40], [rx, 345], [tank[0] + 40, 345], [tank[0] + 40, tank[1] - 30]], ropen ? PRES : IDLE, 3);
    if (ropen) D.flow(g, [[rx, ry + 40], [rx, 345], [tank[0] + 40, 345], [tank[0] + 40, tank[1] - 30]], C.hot, 3, s.t, sp);
    D.text(g, "alívio", rx + 42, ry + 26, { size: 12, color: ropen ? C.red : C.ink, bold: ropen });
    // retorno ao tanque (T)
    D.path(g, [[T[0], T[1]], [T[0], 380], [tank[0] + 60, 380]], RET, 3);
    // válvula
    valve43(g, vx, vy, s.pos); D.text(g, "válvula direcional 4/3", vx, vy + 76, { align: "center", size: 12 });
    // linhas A e B até o cilindro
    const A = [vx - 46 * 0.2, vy], B = [vx + 46 * 0.2, vy], capEnd = [cylX, cylY + cylH / 2], rodEnd = [cylX + cylW - 10, cylY + cylH];
    const aLine = [A, [A[0], 120], [cylX - 30, 120], [cylX - 30, capEnd[1]], capEnd], bLine = [B, [B[0], 140], [rodEnd[0], 140], rodEnd];
    D.path(g, aLine, ext ? PRES : ret ? RET : IDLE, 3); D.path(g, bLine, ret ? PRES : ext ? RET : IDLE, 3);
    if (ext) { D.flow(g, pLine, C.oil, 3, s.t, sp); D.flow(g, aLine, C.oil, 3, s.t, sp); D.flow(g, [...bLine].reverse(), C.oil, 3, s.t, sp * 0.7); D.flow(g, [[T[0], T[1]], [T[0], 380], [tank[0] + 60, 380]], C.oil, 3, s.t, sp * 0.7); }
    if (ret) { D.flow(g, pLine, C.oil, 3, s.t, sp); D.flow(g, bLine, C.oil, 3, s.t, sp); D.flow(g, [...aLine].reverse(), C.oil, 3, s.t, sp * 1.4); D.flow(g, [[T[0], T[1]], [T[0], 380], [tank[0] + 60, 380]], C.oil, 3, s.t, sp * 1.4); }
    if (s.pos === 0) { D.flow(g, pLine, C.oil, 2, s.t, sp * 0.5); D.flow(g, [[T[0], T[1]], [T[0], 380], [tank[0] + 60, 380]], C.oil, 2, s.t, sp * 0.5); }
    // cilindro
    const px = cylX + 10 + s.x * (cylW - 40);
    D.rect(g, cylX, cylY, cylW, cylH, "#fff", C.line, 2.5);
    D.rect(g, cylX + 2, cylY + 2, px - cylX - 2, cylH - 4, ext ? "#f6c0b0" : C.oilL, null); D.rect(g, px + 12, cylY + 2, cylX + cylW - px - 14, cylH - 4, ret ? "#f6c0b0" : C.oilL, null);
    const tipX = px + 12 + 120;
    D.rect(g, px, cylY + 2, 12, cylH - 4, C.steel, C.line); D.rect(g, px + 12, cylY + cylH / 2 - 9, 120, 18, C.steelL, C.line);
    D.weight(g, tipX + 30, cylY + cylH / 2 + 24, 60, 48, `${s.load} kN`); D.arrow(g, tipX + 76, cylY + cylH + 40, tipX + 40, cylY + cylH + 40, C.blue, 3); D.text(g, "carga", tipX + 30, cylY + cylH + 60, { size: 11, color: C.blue });
    D.gauge(g, 250, 60, 26, c.p / 250e5, `${nf(c.p / 1e5, 0)} bar`);
  },
  info(s) {
    const c = this.calc(s);
    return { stats: [["Pressão no sistema", `${nf(c.p / 1e5, 0)} bar`], ["Velocidade do cilindro", `${nf(c.v * 100, 1)} cm/s`], ["Força máxima (avanço)", `${nf(s.relief * 1e5 * c.A / 1000, 0)} kN`], ["Estado", s.pos === 0 ? "neutro: bomba alivia para o tanque" : c.stall ? "travado: óleo passando pelo alívio (esquenta!)" : s.pos > 0 ? "avançando" : "recuando"]],
      cap: c.stall ? "A carga pede mais pressão do que o alívio deixa (ou o cilindro chegou no fim do curso): o óleo da bomba volta ao tanque pela válvula de alívio. Toda essa energia vira calor — por isso não se deixa um sistema “no fim do curso” por muito tempo." : "A <b>bomba cria vazão</b>, não pressão: a pressão só sobe até o necessário para empurrar a carga. No recuo o cilindro anda mais rápido porque a haste ocupa parte da área (menos volume para encher)." };
  },
  explain: [
    ["Peças", `<ul><li><b>Tanque:</b> guarda e resfria o óleo.</li><li><b>Bomba:</b> engrenagens/palhetas/pistões.</li><li><b>Alívio:</b> limita a pressão máxima (segurança).</li><li><b>Direcional:</b> escolhe o caminho.</li><li><b>Atuador:</b> cilindro (linha reta) ou motor hidráulico (giro).</li></ul>`],
    ["Contas", `<p><span class="f">F = p × A</span> · <span class="f">v = Q / A</span></p><p>100 bar num pistão de 80 mm ≈ 50 kN (5 toneladas).</p>`],
    ["Cores do esquema", `<p><span style="color:${PRES}">■</span> pressão · <span style="color:${RET}">■</span> retorno · <span style="color:#999">■</span> parado. A posição da válvula ativa é o quadrado alinhado com as conexões.</p>`],
  ],
});

// ---------------- Cilindros ----------------
M({
  id: "cilindros", group: "Hidráulica (óleo)", title: "Cilindros: simples e dupla ação", icon: "🧪", short: "Força e velocidade para cada lado.",
  lead: "No cilindro de dupla ação o óleo empurra para os dois lados — mas do lado da haste a área é menor: recua com menos força e mais rápido. O de simples ação volta pela mola ou pelo peso.",
  h: 360,
  controls: [
    { k: "tipo", type: "seg", label: "Tipo", v: "dupla", options: [["dupla", "Dupla ação"], ["simples", "Simples ação (mola)"], ["tele", "Telescópico"]] },
    { k: "D", label: "Diâmetro do pistão", min: 30, max: 160, v: 80, unit: "mm" },
    { k: "d", label: "Diâmetro da haste", min: 12, max: 110, v: 45, unit: "mm" },
    { k: "p", label: "Pressão", min: 20, max: 250, v: 150, unit: "bar" },
  ],
  draw(g, s) {
    const ph = (Math.sin(s.t * 0.9) + 1) / 2, ext = Math.cos(s.t * 0.9) > 0, y = 170;
    if (s.tipo === "tele") {
      const n = 4, base = 140, L = 120;
      for (let i = 0; i < n; i++) { const w = 90 - i * 18, x = base + i * L * ph; D.rect(g, x, y - w / 2, L + 10, w, i ? C.steelL : "#fff", C.line, 2); }
      D.text(g, "estágios saem um de dentro do outro: curso grande com cilindro recolhido curto (caçambas, guindastes)", 450, 340, { align: "center", size: 12 });
      return;
    }
    const x0 = 120, W = 420, H = clamp(s.D * 1.1, 40, 150), hr = clamp(Math.min(s.d, s.D - 8) * 1.1, 12, H - 8), px = x0 + 10 + ph * (W - 40);
    D.rect(g, x0, y - H / 2, W, H, "#fff", C.line, 2.5);
    D.rect(g, x0 + 2, y - H / 2 + 2, px - x0 - 2, H - 4, ext ? "#f6c0b0" : C.oilL, null);
    if (s.tipo === "dupla") D.rect(g, px + 14, y - H / 2 + 2, x0 + W - px - 16, H - 4, ext ? C.oilL : "#f6c0b0", null);
    else D.spring(g, px + 14, y, x0 + W - 4, y, 10, H * 0.7, C.dark, 2.5);
    D.rect(g, px, y - H / 2 + 2, 14, H - 4, C.steel, C.line);
    D.rect(g, px + 14, y - hr / 2, x0 + W - px + 200, hr, C.steelL, C.line);
    D.arrow(g, x0 + W + 240, y - 50, x0 + W + 240 + (ext ? 60 : -60), y - 50, ext ? C.red : C.blue, 3);
    D.text(g, ext ? "avançando" : "recuando", x0 + W + 230, y - 62, { size: 12, color: ext ? C.red : C.blue });
    // portas
    D.line(g, x0 + 20, y - H / 2, x0 + 20, y - H / 2 - 40, ext ? PRES : RET, 4);
    if (s.tipo === "dupla") D.line(g, x0 + W - 20, y - H / 2, x0 + W - 20, y - H / 2 - 40, ext ? RET : PRES, 4);
    D.text(g, "área cheia", x0 + 60, y + H / 2 + 22, { size: 12 }); if (s.tipo === "dupla") D.text(g, "área anular (sem a haste)", x0 + W - 200, y + H / 2 + 22, { size: 12 });
  },
  info(s) {
    const A = Math.PI * (s.D / 1000) ** 2 / 4, a = Math.PI * (Math.min(s.d, s.D - 5) / 1000) ** 2 / 4, p = s.p * 1e5;
    if (s.tipo === "tele") return { stats: [], cap: "Telescópico: normalmente de simples ação (desce com o peso). A força cai a cada estágio que sai, porque a área diminui." };
    const st = [["Força avançando", `${nf(p * A / 1000, 1)} kN`]];
    if (s.tipo === "dupla") st.push(["Força recuando", `${nf(p * (A - a) / 1000, 1)} kN`], ["Recuo é mais rápido em", `${nf(A / (A - a), 2)}×`]);
    else st.push(["Retorno", "pela mola (pouca força)"]);
    return { stats: st, cap: s.tipo === "dupla" ? "Mesma pressão, áreas diferentes: o lado da haste empurra menos. Num macaco de oficina você sente isso: sobe devagar e com força, desce rápido." : "Simples ação: o óleo empurra para um lado só; a mola (ou o peso da carga) traz de volta. Mais simples e barato — macacos, prensas pequenas, freios." };
  },
  explain: [
    ["Fórmulas", `<p>Avanço: <span class="f">F = p × π·D²/4</span></p><p>Recuo: <span class="f">F = p × π·(D² − d²)/4</span></p><p>Velocidade: <span class="f">v = Q / área</span></p>`],
    ["Cuidados", `<ul><li>Haste riscada destrói a vedação (vazamento).</li><li>Haste longa em compressão pode flambar.</li><li>Ar no cilindro = movimento “borrachudo”.</li></ul>`],
  ],
});

// ---------------- Válvulas ----------------
M({
  id: "valvulas", group: "Hidráulica (óleo)", title: "Válvulas por dentro", icon: "🔧", short: "Retenção, alívio, controle de vazão e direcional em corte.",
  lead: "Por dentro, quase toda válvula é uma esfera, um cone ou um carretel empurrado por uma mola. Mude a pressão ou o sentido e veja o que abre e o que fecha.",
  h: 360,
  controls: [
    { k: "v", type: "seg", label: "Válvula", v: "ret", options: [["ret", "Retenção"], ["alivio", "Alívio"], ["vazao", "Controle de vazão"], ["carretel", "Direcional (carretel)"]] },
    { k: "p", label: "Pressão na entrada", min: 0, max: 250, v: 120, unit: "bar" },
    { k: "aj", label: "Ajuste (mola / agulha)", min: 10, max: 100, v: 60, unit: "%" },
    { k: "dir", type: "seg", label: "Sentido do óleo", v: 1, options: [[1, "→ normal"], [-1, "← contrário"]] },
  ],
  draw(g, s) {
    const cy = 190;
    if (s.v === "ret" || s.v === "alivio") {
      const setting = s.v === "ret" ? 3 : s.aj * 2.5, pIn = s.v === "ret" ? (s.dir > 0 ? s.p : 0) : s.p, open = pIn > setting;
      const lift = open ? clamp((pIn - setting) / 30, 0.2, 1) * 22 : 0;
      D.pipe(g, [[60, cy], [360, cy]], C.oilL, 36); D.pipe(g, [[540, cy], [840, cy]], C.oilL, 36);
      D.rect(g, 360, cy - 70, 180, 140, "#fff", C.line, 3); D.path(g, [[400, cy - 20], [430, cy - 20], [430, cy + 20], [400, cy + 20]], null);
      D.rect(g, 360, cy - 18, 70, 36, C.oilL, null); D.rect(g, 428, cy - 30, 8, 60, C.steelD, null);
      D.circle(g, 446 + lift, cy, 22, C.steel, C.line); D.spring(g, 468 + lift, cy, 536, cy, 6, 28);
      if (open) { D.flow(g, [[60, cy], [430, cy], [470 + lift, cy - 40], [540, cy - 40], [840, cy]], C.oil, 4, s.t, 2); }
      D.label(g, open ? (s.v === "ret" ? "aberta: passa" : `abriu: pressão ${s.p} bar > ajuste ${nf(setting, 0)} bar`) : (s.v === "ret" ? (s.dir < 0 ? "sentido contrário: a esfera é empurrada contra a sede e veda" : "sem pressão: fechada") : `fechada: ${s.p} bar < ajuste ${nf(setting, 0)} bar`), 300, 330, { color: open ? C.green : C.red });
      if (s.dir < 0 && s.v === "ret") D.arrow(g, 800, cy - 60, 600, cy - 60, C.red, 3);
    } else if (s.v === "vazao") {
      const open = (100 - s.aj) / 100, flow = s.dir > 0 ? open : 1;
      D.pipe(g, [[60, cy], [840, cy]], C.oilL, 36);
      D.rect(g, 420, 40, 60, cy - 60, C.steelL, C.line); D.path(g, [[430, cy - 20 - open * 0 + (1 - open) * 30], [470, cy - 20 + (1 - open) * 30], [450, cy - 18 + (1 - open) * 34 + 10]], C.line, 1.5, true, C.steelD);
      D.rect(g, 445, cy - 120, 10, 100 + (1 - open) * 30, C.steelD, C.line); D.rot(g, 450, 70, 26, 1);
      D.flow(g, [[60, cy], [840, cy]], C.oil, 4 * (0.3 + flow * 0.7), s.t, 0.5 + flow * 2);
      // retenção em paralelo (bypass)
      D.pipe(g, [[300, cy], [300, cy + 90], [600, cy + 90], [600, cy]], C.oilL, 20); D.circle(g, 450, cy + 90, 10, C.steel, C.line);
      if (s.dir < 0) D.flow(g, [[600, cy], [600, cy + 90], [300, cy + 90], [300, cy]], C.oil, 3, s.t, 2);
      D.label(g, s.dir > 0 ? `agulha ${nf(open * 100, 0)}% aberta: controla a velocidade do cilindro` : "sentido contrário: passa livre pela retenção do desvio", 240, 340, { color: C.blue });
    } else {
      const pos = s.dir > 0 ? 1 : -1, sh = pos * 30, x0 = 220, w = 460;
      D.rect(g, x0, cy - 50, w, 100, "#fff", C.line, 3);
      for (const [px, lab] of [[300, "T"], [420, "A"], [480, "P"], [540, "B"], [600, "T"]]) { D.rect(g, px - 12, cy + 50, 24, 50, C.oilL, C.line); D.text(g, lab, px, cy + 118, { align: "center", bold: true }); }
      D.rect(g, x0 + 20 + sh, cy - 30, w - 40, 60, C.steelL, C.line);
      for (const lx of [310, 450, 510, 590]) D.rect(g, lx + sh - 22, cy - 40, 30, 80, C.steel, C.line);
      D.text(g, pos > 0 ? "carretel à direita: P → A e B → T" : "carretel à esquerda: P → B e A → T", 450, cy - 70, { align: "center", size: 13, bold: true });
      D.arrow(g, 450, cy - 100, 450 + sh * 2, cy - 100, C.red, 3);
    }
  },
  info(s) {
    const c = { ret: "Retenção: deixa passar só num sentido. Está dentro de bombas, macacos e em paralelo com outras válvulas.", alivio: "Alívio: normalmente fechada. Quando a pressão vence a mola, abre e manda o óleo para o tanque — protege mangueiras, bomba e você.", vazao: "Controle de vazão: um estrangulamento ajustável (agulha). Menos vazão para o cilindro = movimento mais lento. A retenção em paralelo deixa o retorno livre.", carretel: "Direcional de carretel: os ressaltos do carretel tampam ou ligam os canais P (pressão), T (tanque), A e B (cilindro). Acionada por alavanca, mola, solenoide ou piloto." }[s.v];
    return { stats: [], cap: c };
  },
  explain: [
    ["Famílias", `<ul><li><b>Direcionais:</b> escolhem o caminho.</li><li><b>De pressão:</b> alívio, redutora, sequência.</li><li><b>De vazão:</b> estranguladores (velocidade).</li><li><b>De bloqueio:</b> retenção, retenção pilotada.</li></ul>`],
    ["Nomenclatura 4/3", `<p>4 vias (P, T, A, B) e 3 posições. 5/2 (pneumática) = 5 vias e 2 posições.</p>`],
  ],
});

// ---------------- Macaco hidráulico ----------------
M({
  id: "macaco", group: "Hidráulica (óleo)", title: "Macaco hidráulico", icon: "🚘", short: "Bombear devagar para levantar um carro.",
  lead: "Cada bombada do pistão pequeno empurra um pouquinho de óleo para baixo do pistão grande, passando por uma válvula de retenção que não deixa voltar. Para descer, abre-se a válvula de alívio.",
  h: 380,
  controls: [
    { k: "pump", type: "hold", label: "⬆⬇ Segure para bombear" },
    { k: "rel", type: "hold", label: "Segure para abrir o alívio (descer)" },
    { k: "kg", label: "Carga", min: 200, max: 3000, step: 100, v: 1200, unit: "kg" },
  ],
  init(s) { s.h = 0; s.ph = 0; },
  draw(g, s, dt) {
    const prev = s.ph;
    if (s.pump) s.ph += dt * 4;
    const stroke = (Math.sin(s.ph) + 1) / 2, down = Math.cos(s.ph) < 0 && s.pump; // pistão pequeno descendo
    if (s.pump && Math.sin(s.ph) < Math.sin(prev)) s.h = Math.min(120, s.h + Math.abs(Math.sin(s.ph) - Math.sin(prev)) * 3);
    if (s.rel) s.h = Math.max(0, s.h - dt * 30);
    const base = 320, ramX = 520, ramW = 110, ramTop = 200 - s.h;
    // reservatório (em volta) e corpo
    D.rect(g, 360, 120, 330, base - 120, C.oilL, C.line, 2.5); D.text(g, "reservatório", 612, 140, { size: 12 });
    D.rect(g, ramX - ramW / 2 - 6, 140, ramW + 12, base - 140, "#fff", C.line, 2); D.rect(g, ramX - ramW / 2, ramTop + 40, ramW, base - ramTop - 40, "#f6c0b0", null);
    D.rect(g, ramX - ramW / 2, ramTop, ramW, 40, C.steel, C.line); D.rect(g, ramX - 30, ramTop - 40, 60, 40, C.steelL, C.line);
    D.weight(g, ramX, ramTop - 40, 160, 50, `${s.kg} kg`);
    // bomba pequena
    const px = 250, ptop = 170 + stroke * 50;
    D.rect(g, px - 20, 150, 40, base - 150, "#fff", C.line, 2); D.rect(g, px - 18, ptop + 20, 36, base - ptop - 20, "#f6c0b0", null);
    D.rect(g, px - 18, ptop, 36, 20, C.steel, C.line); D.line(g, px, ptop, px, 100, C.steelD, 6);
    D.anchor(g, 150, 100, 10); D.link(g, 150, 100, 380, 100 + (ptop - 170) * 1.3, 12, C.steelD);
    // canais e válvulas de retenção
    D.pipe(g, [[px, base], [px, base + 30], [ramX, base + 30], [ramX, base]], C.oilL, 14);
    D.pipe(g, [[px + 20, 220], [360, 220]], C.oilL, 10);
    D.circle(g, 320, 220, 8, down ? C.red : C.green, C.line); D.text(g, "retenção entrada", 290, 205, { size: 11 });
    D.circle(g, 390, base + 30, 8, down ? C.green : C.red, C.line); D.text(g, "retenção saída", 360, base + 56, { size: 11 });
    if (s.pump && down) D.flow(g, [[px, base], [px, base + 30], [ramX, base + 30], [ramX, base]], C.oil, 3, s.t, 2);
    if (s.pump && !down) D.flow(g, [[360, 220], [px + 20, 220]], C.oil, 3, s.t, 2);
    D.rect(g, 660, base - 10, 30, 20, s.rel ? C.green : C.steelD, C.line); D.text(g, "alívio", 675, base + 26, { align: "center", size: 11 });
    if (s.rel && s.h > 0) D.flow(g, [[ramX + ramW / 2, base - 5], [660, base]], C.oil, 3, s.t, 2);
    D.label(g, `altura: ${nf(s.h / 2, 0)} mm`, 720, 60);
  },
  info(s) {
    const ratio = (110 / 36) ** 2, F = s.kg * 9.81 / ratio / 7;
    return { stats: [["Razão das áreas", `${nf(ratio, 1)}×`], ["Braço da alavanca", "≈ 7×"], ["Força na mão", `${nf(F, 0)} N (${nf(F / 9.81, 1)} kg)`]],
      cap: "Duas multiplicações: a alavanca (≈7×) e a hidráulica (áreas, ≈9×). Por isso dá para levantar 1 tonelada com a força de alguns quilos — fazendo muitas bombadas." };
  },
  explain: [
    ["Ciclo de bombeamento", `<ol style="padding-left:18px"><li>Sobe o pistão pequeno: a retenção de entrada abre e puxa óleo do reservatório.</li><li>Desce: a de entrada fecha, a de saída abre e o óleo vai para baixo do pistão grande.</li><li>A retenção de saída não deixa o óleo voltar: a carga fica parada.</li></ol>`],
    ["Segurança", `<p>Nunca fique embaixo de um carro só no macaco: use cavaletes. Vedações podem vazar e a carga desce.</p>`],
  ],
});
