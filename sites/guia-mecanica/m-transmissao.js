// MechLab — Transmissão: engrenagens, tipos, planetário, correias/correntes, diferencial, embreagem e câmbio.
"use strict";
const rpmVis = rpm => rpm / 60 * TAU * 0.04; // rotação no desenho (bem mais lenta que a real)
/** Listras andando num retângulo (para mostrar giro visto de lado). dir: "v" ou "h". */
function stripes(g, x, y, w, h, off, gap = 10, dir = "v", slant = 0, c = "rgba(0,0,0,.35)", clip) {
  g.save(); g.beginPath();
  if (clip) clip.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); else g.rect(x, y, w, h);
  g.clip(); g.strokeStyle = c; g.lineWidth = 2; g.beginPath();
  const len = dir === "v" ? h : w, ext = Math.abs(slant) + 2 * gap, n = Math.ceil((len + ext) / gap), span = n * gap;
  for (let k = 0; k < n; k++) {
    const q = ((off + k * gap) % span + span) % span - Math.abs(slant) - gap;
    if (dir === "v") { g.moveTo(x, y + q); g.lineTo(x + w, y + q + slant); } else { g.moveTo(x + q, y); g.lineTo(x + q + slant, y + h); }
  }
  g.stroke(); g.restore();
}

// ---------------- Engrenagens e relação ----------------
M({
  id: "engrenagens", group: "Transmissão", title: "Engrenagens e relação", icon: "⚙️", short: "Troque rotação por torque contando dentes.",
  lead: "Engrenagem pequena girando a grande: sai mais devagar e com mais força. A relação é só a conta dos dentes. Coloque uma engrenagem no meio para inverter o sentido.",
  h: 380,
  controls: [
    { k: "z1", label: "Dentes da motora (azul)", min: 8, max: 48, v: 12 },
    { k: "z2", label: "Dentes da movida (laranja)", min: 8, max: 72, v: 36 },
    { k: "rpm", label: "Rotação de entrada", min: 100, max: 3000, step: 50, v: 900, unit: "rpm" },
    { k: "T", label: "Torque de entrada", min: 5, max: 200, v: 20, unit: "N·m" },
    { k: "idler", type: "check", label: "Engrenagem intermediária (louca) no meio", v: false },
  ],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * rpmVis(s.rpm);
    const zs = s.idler ? [s.z1, 14, s.z2] : [s.z1, s.z2], sum = zs.reduce((a, b) => a + b, 0);
    const m = Math.min(760 / sum, 280 / Math.max(...zs), 9), cy = 190;
    let x = 450 - m * sum / 2 + m * zs[0] / 2;
    const xs = [x]; for (let i = 1; i < zs.length; i++) { x += m * (zs[i - 1] + zs[i]) / 2; xs.push(x); }
    const angs = [s.a]; for (let i = 1; i < zs.length; i++) angs.push(D.mesh(angs[i - 1], zs[i - 1], zs[i]));
    const fills = s.idler ? ["#9ec0f0", C.steel, "#f6b880"] : ["#9ec0f0", "#f6b880"];
    zs.forEach((z, i) => {
      const r = m * z / 2;
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = "#999"; g.beginPath(); g.arc(xs[i], cy, r, 0, TAU); g.stroke(); g.restore();
      D.gear(g, xs[i], cy, r, z, angs[i], fills[i]);
      D.rot(g, xs[i], cy, r + 16, i % 2 ? -1 : 1, i === 0 ? C.blue : i === zs.length - 1 ? C.orange : C.muted);
    });
    const out = s.rpm * s.z1 / s.z2, Tout = s.T * s.z2 / s.z1 * 0.98;
    D.label(g, `${s.rpm} rpm · ${s.T} N·m`, xs[0] - 60, 360, { color: C.blue });
    D.label(g, `${nf(out, 0)} rpm · ${nf(Tout, 1)} N·m`, xs[xs.length - 1] - 70, 360, { color: C.orange });
    if (s.idler) D.label(g, "louca: só inverte", xs[1] - 52, 30);
  },
  info(s) {
    const i = s.z2 / s.z1, same = s.idler;
    return {
      stats: [["Relação (movida ÷ motora)", `${nf(i, 2)} : 1`], ["Rotação de saída", `${nf(s.rpm / i, 0)} rpm`], ["Torque de saída (~98%)", `${nf(s.T * i * 0.98, 1)} N·m`], ["Sentido da saída", same ? "igual à entrada" : "invertido"]],
      cap: i > 1 ? `<b>Redução:</b> a saída gira ${nf(i, 2)}× mais devagar e tem ${nf(i, 2)}× mais torque. A potência (torque × rotação) é a mesma, menos ~2% de perda.` : i < 1 ? `<b>Multiplicação:</b> a saída gira ${nf(1 / i, 2)}× mais rápido, com menos torque — como a marcha alta do carro.` : "Relação 1:1 — só transmite o giro (e inverte o sentido).",
    };
  },
  explain: [
    ["A conta", `<p><span class="f">i = Z<sub>movida</sub> / Z<sub>motora</sub></span></p><p><span class="f">rpm<sub>saída</sub> = rpm<sub>entrada</sub> / i</span> · <span class="f">T<sub>saída</sub> = T<sub>entrada</sub> × i × η</span></p>`],
    ["Para engrenar", `<ul><li>As duas precisam ter o mesmo <b>módulo</b> (tamanho do dente).</li><li>Distância entre centros = soma dos raios primitivos (linha tracejada).</li><li>Engrenagem louca não muda a relação, só o sentido.</li></ul>`],
    ["Onde se usa", `<ul><li>Redutores de motor, furadeiras, relógios, câmbios.</li><li>Bicicleta é a mesma conta com coroa e catraca (corrente).</li></ul>`],
  ],
});

// ---------------- Tipos de engrenagens ----------------
M({
  id: "tiposeng", group: "Transmissão", title: "Tipos de engrenagens", icon: "🔩", short: "Retas, helicoidais, cônicas, sem-fim, cremalheira e internas.",
  lead: "Cada formato resolve um problema: eixos paralelos, em ângulo, grande redução num espaço pequeno ou transformar giro em movimento reto.",
  h: 380,
  controls: [{ k: "tipo", type: "seg", label: "Tipo", v: "retos", options: [["retos", "Dentes retos"], ["heli", "Helicoidal"], ["conica", "Cônica"], ["semfim", "Coroa e sem-fim"], ["crem", "Pinhão e cremalheira"], ["interna", "Interna (anel)"]] }],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * 0.8; const a = s.a;
    const T = {
      retos: () => {
        D.gear(g, 330, 190, 90, 24, a, "#9ec0f0"); D.gear(g, 330 + 90 + 60, 190, 60, 16, D.mesh(a, 24, 16), "#f6b880");
        D.text(g, "eixos paralelos · simples e baratas · fazem barulho em alta rotação", 450, 345, { align: "center" });
      },
      heli: () => {
        D.gear(g, 200, 190, 90, 24, a, "#9ec0f0"); D.gear(g, 350, 190, 60, 16, D.mesh(a, 24, 16), "#f6b880");
        D.text(g, "vista de frente", 270, 60, { align: "center", size: 12, color: C.muted });
        // vista lateral com dentes inclinados
        D.rect(g, 560, 70, 90, 180, "#9ec0f0", C.line); stripes(g, 560, 70, 90, 180, a * 60, 14, "v", 30);
        D.rect(g, 560, 250, 90, 120, "#f6b880", C.line); stripes(g, 560, 250, 90, 120, -a * 90, 14, "v", -30);
        D.arrow(g, 680, 160, 740, 160, C.red, 3); D.label(g, "força axial", 690, 148, { color: C.red });
        D.text(g, "vista de lado: dentes inclinados", 605, 60, { align: "center", size: 12, color: C.muted });
        D.text(g, "o dente entra aos poucos → silenciosa e forte, mas empurra o eixo para o lado", 290, 350, { align: "center", size: 12 });
      },
      conica: () => {
        const cx = 420, cy = 210;
        const t1 = [[cx - 140, cy + 20], [cx + 10, cy + 20], [cx - 20, cy - 40], [cx - 110, cy - 40]], t2 = [[cx + 30, cy + 10], [cx + 30, cy - 160], [cx + 90, cy - 130], [cx + 90, cy - 20]];
        D.path(g, t1, C.line, 1.5, true, "#9ec0f0"); stripes(g, cx - 140, cy - 40, 150, 60, a * 40, 14, "h", -20, undefined, t1);
        D.path(g, t2, C.line, 1.5, true, "#f6b880"); stripes(g, cx + 30, cy - 160, 60, 170, a * 40, 14, "v", 20, undefined, t2);
        D.rect(g, cx - 75, cy + 20, 14, 120, C.steelD, C.line); D.rect(g, cx + 90, cy - 92, 200, 14, C.steelD, C.line);
        D.rot(g, cx - 68, cy + 110, 22, 1); D.rot(g, cx + 240, cy - 85, 22, -1);
        D.text(g, "eixos a 90° · diferencial do carro, furadeira de mão, moedor", 450, 360, { align: "center" });
      },
      semfim: () => {
        const z = 30, wr = 100;
        D.gear(g, 450, 150, wr, z, a / z * 4, "#f6b880");
        D.rect(g, 330, 255, 240, 60, "#9ec0f0", C.line); stripes(g, 330, 255, 240, 60, a * 30, 18, "h", 16);
        D.rect(g, 250, 278, 80, 14, C.steelD, C.line); D.rect(g, 570, 278, 80, 14, C.steelD, C.line);
        D.rot(g, 280, 285, 26, 1, C.blue, -1.2);
        D.text(g, `1 volta do sem-fim avança 1 dente → redução ${z}:1 num espaço pequeno`, 450, 345, { align: "center" });
        D.text(g, "normalmente a coroa não consegue girar o sem-fim (trava sozinha) — ótimo para guinchos e portões", 450, 368, { align: "center", size: 12, color: C.muted });
      },
      crem: () => {
        const z = 16, r = 70, osc = Math.sin(a * 0.8) * 2.2, cx = 450, cy = 160, p = TAU * r / z;
        D.gear(g, cx, cy, r, z, osc, "#9ec0f0");
        D.rack(g, 120, 780, cy + r, p, cx - osc * r, "#f6b880");
        D.arrow(g, 450 - osc * r, 300, 450 - osc * r + (Math.cos(a * 0.8) > 0 ? -50 : 50), 300, C.red, 3);
        D.text(g, "giro ↔ movimento reto · direção do carro, portão de correr, máquinas CNC", 450, 355, { align: "center" });
      },
      interna: () => {
        const zr = 48, zp = 16, R = 140, rp = R * zp / zr, cx = 450, cy = 190, ap = a * 1.5, ar = ap * zp / zr;
        D.ringGear(g, cx, cy, R, zr, ar);
        D.gear(g, cx + R - rp, cy, rp, zp, ap, "#9ec0f0");
        D.rot(g, cx + R - rp, cy, rp + 14, 1); D.rot(g, cx, cy, R + 30, 1, C.orange, -1.8);
        D.text(g, "os dois giram no mesmo sentido · compacta · base do trem planetário", 450, 372, { align: "center" });
      },
    };
    T[s.tipo]();
  },
  info(s) {
    const t = { retos: "Dentes retos: a mais comum. Contato do dente inteiro de uma vez — por isso faz o “zumbido” das marchas à ré.", heli: "Helicoidal: usada nas marchas à frente dos carros por ser silenciosa. Precisa de rolamentos que aguentem força axial.", conica: "Cônica: muda a direção do giro em 90°. No diferencial ela leva o giro do cardã para as rodas.", semfim: "Sem-fim: enorme redução numa etapa só, mas com atrito alto (rendimento baixo).", crem: "Cremalheira: uma engrenagem “desenrolada”. Cada volta do pinhão anda a circunferência dele.", interna: "Interna: dentes do lado de dentro. Com uma engrenagem no meio (sol) vira um trem planetário." }[s.tipo];
    return { stats: [], cap: t };
  },
  explain: [
    ["Escolhendo", `<ul><li><b>Eixos paralelos:</b> retas ou helicoidais.</li><li><b>Eixos em ângulo:</b> cônicas.</li><li><b>Eixos cruzados + grande redução:</b> sem-fim.</li><li><b>Giro → linha reta:</b> pinhão e cremalheira.</li></ul>`],
    ["Perfil evolvente", `<p>O formato curvo do dente (evolvente) faz a força passar sempre na mesma direção, então a transmissão é suave e a relação é constante — mesmo com a distância entre eixos um pouco errada.</p>`],
  ],
});

// ---------------- Trem planetário ----------------
M({
  id: "planetario", group: "Transmissão", title: "Trem planetário (epicicloidal)", icon: "🪐", short: "Sol, planetas e coroa: várias relações num só conjunto.",
  lead: "Travando uma das três partes (sol, portador ou coroa) e girando outra, o conjunto dá uma relação diferente. É assim que funcionam o câmbio automático, o redutor de parafusadeira e o híbrido do Prius.",
  h: 380,
  controls: [{ k: "mode", type: "seg", label: "Configuração", v: "ring", options: [["ring", "Coroa presa · entra no sol"], ["sun", "Sol preso · entra na coroa"], ["carrier", "Portador preso · entra no sol"], ["lock", "Tudo junto (1:1)"]] }],
  init(s) { s.as = 0; s.ac = 0; s.ar = Math.PI / 48; },
  draw(g, s, dt) {
    const Zs = 24, Zp = 12, Zr = 48, w = 0.7 * dt;
    let ws = 0, wc = 0, wr = 0;
    if (s.mode === "ring") { ws = w; wr = 0; wc = ws * Zs / (Zs + Zr); }
    else if (s.mode === "sun") { wr = w; ws = 0; wc = wr * Zr / (Zs + Zr); }
    else if (s.mode === "carrier") { ws = w; wc = 0; wr = -ws * Zs / Zr; }
    else { ws = wc = wr = w; }
    s.as += ws; s.ac += wc; s.ar += wr;
    const cx = 330, cy = 190, m = 5.6, rs = m * Zs / 2, rp = m * Zp / 2, R = m * Zr / 2, d = rs + rp;
    D.ringGear(g, cx, cy, R, Zr, s.ar, s.mode === "ring" ? "#e8b0b0" : C.steelL);
    // braços do portador
    const cpts = [0, 1, 2].map(i => { const t = s.ac + i * TAU / 3; return [cx + Math.cos(t) * d, cy + Math.sin(t) * d]; });
    D.path(g, cpts, C.line, 2, true, s.mode === "carrier" ? "rgba(232,176,176,.6)" : "rgba(122,58,184,.18)");
    cpts.forEach(([px, py], i) => {
      const th = s.ac + i * TAU / 3, ap = th + Math.PI + Math.PI / Zp - (s.as - th) * Zs / Zp;
      D.gear(g, px, py, rp, Zp, ap, "#b8e0a8");
      D.pin(g, px, py, 5);
    });
    D.gear(g, cx, cy, rs, Zs, s.as, s.mode === "sun" ? "#e8b0b0" : "#f6d070");
    // legenda
    const lx = 600;
    D.text(g, "Sol (amarelo)", lx, 70, { bold: true }); D.text(g, "Planetas (verdes) presos no portador (roxo)", lx, 95, { bold: true, size: 12 }); D.text(g, "Coroa (anel de fora)", lx, 120, { bold: true });
    D.text(g, "vermelho = peça travada", lx, 150, { color: C.red });
    const r = this.ratio(s);
    D.label(g, r.txt, lx, 200, { size: 13 });
  },
  ratio(s) {
    const Zs = 24, Zr = 48;
    if (s.mode === "ring") return { i: 1 + Zr / Zs, txt: "saída no portador: redução 3 : 1", inn: "sol", out: "portador" };
    if (s.mode === "sun") return { i: 1 + Zs / Zr, txt: "saída no portador: redução 1,5 : 1", inn: "coroa", out: "portador" };
    if (s.mode === "carrier") return { i: -Zr / Zs, txt: "saída na coroa: 2 : 1 e ao contrário (ré)", inn: "sol", out: "coroa" };
    return { i: 1, txt: "tudo gira junto: 1 : 1 (marcha direta)", inn: "qualquer", out: "qualquer" };
  },
  info(s) {
    const r = this.ratio(s);
    return { stats: [["Entrada", r.inn], ["Saída", r.out], ["Relação", `${nf(Math.abs(r.i), 2)} : 1${r.i < 0 ? " (inverte)" : ""}`]],
      cap: "Fórmula de Willis: <span class=\"f\">(ω<sub>sol</sub> − ω<sub>port</sub>) / (ω<sub>coroa</sub> − ω<sub>port</sub>) = −Z<sub>coroa</sub>/Z<sub>sol</sub></span>. No câmbio automático, embreagens e cintas internas decidem qual peça trava em cada marcha." };
  },
  explain: [
    ["As peças", `<ul><li><b>Sol:</b> engrenagem do centro.</li><li><b>Planetas:</b> giram em volta do sol, presos ao <b>portador</b>.</li><li><b>Coroa:</b> anel com dentes internos por fora.</li></ul>`],
    ["Regra de montagem", `<p><span class="f">Z<sub>coroa</sub> = Z<sub>sol</sub> + 2·Z<sub>planeta</sub></span> e a soma sol + coroa divisível pelo número de planetas (aqui 24 + 48 = 72, ÷ 3).</p>`],
    ["Por que é tão usado", `<ul><li>Coaxial: entrada e saída no mesmo eixo.</li><li>A carga divide entre vários planetas → pequeno e forte.</li><li>Várias relações só travando peças diferentes.</li></ul>`],
  ],
});

// ---------------- Correias e correntes ----------------
M({
  id: "correias", group: "Transmissão", title: "Correias e correntes", icon: "⛓️", short: "Levar o giro longe, trocando diâmetros.",
  lead: "Polia pequena puxando polia grande reduz a rotação, como nas engrenagens — mas com o eixo longe. A correia cruzada inverte o sentido.",
  h: 360,
  controls: [
    { k: "tipo", type: "seg", label: "Tipo", v: "v", options: [["v", "Correia em V"], ["dent", "Correia dentada"], ["corr", "Corrente"], ["cruz", "Correia cruzada"]] },
    { k: "d1", label: "Diâmetro da motora", min: 40, max: 200, v: 80, unit: "mm" },
    { k: "d2", label: "Diâmetro da movida", min: 40, max: 300, v: 200, unit: "mm" },
    { k: "rpm", label: "Rotação do motor", min: 300, max: 3600, step: 50, v: 1750, unit: "rpm" },
  ],
  init(s) { s.a = 0; },
  draw(g, s, dt) {
    s.a += dt * rpmVis(s.rpm);
    const r1 = s.d1 * 0.5, r2 = s.d2 * 0.5, x1 = 230, x2 = 640, y = 180, a2 = (s.tipo === "cruz" ? -1 : 1) * s.a * r1 / r2;
    const belt = s.a * r1; // comprimento andado
    if (s.tipo === "cruz") this.cross(g, x1, y, r1, x2, y, r2, belt);
    else if (s.tipo === "corr") { D.belt(g, x1, y, r1 + 4, x2, y, r2 + 4, "#444", 8, belt, [7, 5]); D.belt(g, x1, y, r1 + 4, x2, y, r2 + 4, "#aaa", 3, belt, [3, 9]); }
    else if (s.tipo === "dent") { D.belt(g, x1, y, r1 + 3, x2, y, r2 + 3, C.rubber, 6); D.belt(g, x1, y, r1 + 3, x2, y, r2 + 3, "#888", 6, belt, [3, 5]); }
    else { D.belt(g, x1, y, r1 + 3, x2, y, r2 + 3, C.rubber, 7); D.belt(g, x1, y, r1 + 3, x2, y, r2 + 3, "#d8d8d8", 2, belt, [10, 22]); }
    if (s.tipo === "corr") { D.gear(g, x1, y, r1, Math.max(9, Math.round(r1 / 5)), s.a, "#9ec0f0", { mark: true }); D.gear(g, x2, y, r2, Math.max(9, Math.round(r2 / 5)), a2, "#f6b880"); }
    else { D.pulley(g, x1, y, r1, s.a, "#9ec0f0"); D.pulley(g, x2, y, r2, a2, "#f6b880"); }
    D.rot(g, x1, y, r1 + 18, 1, C.blue); D.rot(g, x2, y, r2 + 18, s.tipo === "cruz" ? -1 : 1, C.orange);
    // seção da correia em V
    if (s.tipo === "v") { D.text(g, "seção", 80, 330, { size: 12, color: C.muted }); D.path(g, [[120, 300], [160, 300], [152, 325], [128, 325]], C.line, 1.5, true, C.rubber); D.path(g, [[108, 292], [120, 300], [128, 325], [152, 325], [160, 300], [172, 292]], C.steelD, 2); D.text(g, "a cunha da correia no canal aumenta o atrito", 185, 318, { size: 12 }); }
  },
  cross(g, x1, y1, r1, x2, y2, r2, t) {
    const d = Math.hypot(x2 - x1, y2 - y1), b = Math.acos((r1 + r2) / d);
    const P = (cx, cy, r, ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    const p1 = P(x1, y1, r1, b), q1 = P(x1, y1, r1, -b), p2 = P(x2, y2, r2, Math.PI + b), q2 = P(x2, y2, r2, Math.PI - b);
    g.save(); g.strokeStyle = C.rubber; g.lineWidth = 7; g.beginPath(); g.moveTo(...p1); g.lineTo(...p2); g.arc(x2, y2, r2, Math.PI + b, Math.PI - b, false); g.lineTo(...q1); g.arc(x1, y1, r1, -b, b, false); g.stroke();
    g.strokeStyle = "#d8d8d8"; g.lineWidth = 2; g.setLineDash([10, 22]); g.lineDashOffset = -t; g.stroke(); g.restore();
  },
  info(s) {
    const i = s.d2 / s.d1, v = Math.PI * s.d1 / 1000 * s.rpm / 60;
    const notes = { v: "Correia em V: barata e silenciosa, aceita pequenos trancos. Pode patinar um pouco (≈2%).", dent: "Correia dentada: não patina — mantém o sincronismo exato (comando de válvulas do motor, impressoras 3D).", corr: "Corrente: aguenta muita força, não patina, precisa de lubrificação e esticador (moto, bicicleta).", cruz: "Correia cruzada: o “X” inverte o sentido de giro. Só serve para correias planas e velocidades baixas." };
    return { stats: [["Relação", `${nf(i, 2)} : 1`], ["Rotação da movida", `${nf(s.rpm / i, 0)} rpm`], ["Velocidade da correia", `${nf(v, 1)} m/s`], ["Sentido", s.tipo === "cruz" ? "invertido" : "igual"]], cap: notes[s.tipo] };
  },
  explain: [
    ["A conta", `<p><span class="f">rpm<sub>2</sub> = rpm<sub>1</sub> × D<sub>1</sub> / D<sub>2</sub></span> · <span class="f">v = π·D·rpm / 60</span></p>`],
    ["Cuidados", `<ul><li>Tensão certa: frouxa patina e chia, apertada demais acaba com os rolamentos.</li><li>Polias alinhadas — desalinhamento come a correia.</li><li>Ângulo de abraçamento pequeno na polia pequena → patina.</li></ul>`],
    ["Bicicleta", `<p>Coroa da frente com 44 dentes e catraca de 11 → a roda dá 4 voltas por pedalada. Marcha leve: coroa pequena e catraca grande.</p>`],
  ],
});

// ---------------- Diferencial ----------------
M({
  id: "diferencial", group: "Transmissão", title: "Diferencial", icon: "🚗", short: "Por que as rodas podem girar diferente na curva.",
  lead: "Na curva, a roda de fora percorre um caminho maior. O diferencial deixa cada roda girar na sua velocidade, mas sempre com o mesmo torque — e é por isso que uma roda no gelo deixa o carro parado.",
  h: 380,
  controls: [
    { k: "turn", label: "Curva (← esquerda · direita →)", min: -100, max: 100, v: 40, unit: "%" },
    { k: "cena", type: "seg", label: "Situação", v: "normal", options: [["normal", "Asfalto"], ["gelo", "Roda esquerda no gelo"]] },
    { k: "lock", type: "check", label: "Bloquear diferencial", v: false },
  ],
  init(s) { s.ac = 0; s.aL = 0; s.aR = 0; s.asp = 0; },
  speeds(s) {
    const k = s.turn / 100 * 0.45;
    if (s.cena === "gelo" && !s.lock) return { c: 1, L: 2, R: 0, moving: false };
    if (s.lock) return { c: 1, L: 1, R: 1, moving: true, scrub: Math.abs(k) > 0.05 };
    return { c: 1, L: 1 + k, R: 1 - k, moving: true };
  },
  draw(g, s, dt) {
    const v = this.speeds(s), w = 1.6 * dt;
    s.ac += v.c * w; s.aL += v.L * w; s.aR += v.R * w; s.asp += (v.L - v.R) / 2 * w * 2;
    // vista de cima do carro
    const cx = 200, cy = 190, k = s.turn / 100;
    if (Math.abs(k) > 0.02 && v.moving) { const R = 160 / Math.abs(k), sx = cx + Math.sign(k) * R; g.save(); g.setLineDash([5, 5]); g.strokeStyle = C.muted; for (const off of [-45, 45]) { g.beginPath(); g.arc(sx, cy + 60, R + off * Math.sign(k), 0, TAU); g.stroke(); } g.restore(); }
    D.rect(g, cx - 45, cy - 100, 90, 200, "#d8e4f0", C.line); D.text(g, "frente", cx, cy - 108, { align: "center", size: 11, color: C.muted });
    const wheel = (x, y, spd, label, ice) => {
      if (ice) D.rect(g, x - 22, y - 34, 44, 68, "#d8f0ff", "#6ab0d8");
      D.rect(g, x - 9, y - 22, 18, 44, C.rubber, C.line); stripes(g, x - 9, y - 22, 18, 44, spd * 40, 8, "v", 0, "rgba(255,255,255,.5)");
      if (label) D.text(g, label, x + (x < cx ? -14 : 14), y + 40, { align: x < cx ? "right" : "left", size: 12 });
    };
    wheel(cx - 54, cy - 65, 0); wheel(cx + 54, cy - 65, 0);
    wheel(cx - 54, cy + 60, s.aL, `${nf(v.L * 100, 0)}%`, s.cena === "gelo"); wheel(cx + 54, cy + 60, s.aR, `${nf(v.R * 100, 0)}%`);
    D.line(g, cx - 45, cy + 60, cx + 45, cy + 60, C.steelD, 4); D.rect(g, cx - 12, cy + 48, 24, 24, C.steel, C.line);
    D.line(g, cx, cy - 60, cx, cy + 48, C.steelD, 3); D.text(g, "cardã", cx + 6, cy - 20, { size: 11, color: C.muted });
    // esquema do diferencial (corte)
    const ox = 600, oy = 190;
    D.rect(g, ox - 75, oy - 75, 150, 150, "rgba(122,58,184,.12)", C.purple, 2); D.text(g, "caixa (portador)", ox, oy - 82, { align: "center", size: 12, color: C.purple });
    stripes(g, ox - 75, oy - 75, 10, 150, s.ac * 40, 12, "v", 0, "rgba(122,58,184,.6)");
    D.path(g, [[ox - 75, oy - 120], [ox - 95, oy - 120], [ox - 95, oy + 120], [ox - 75, oy + 120]], C.line, 1.5, true, "#f6b880"); stripes(g, ox - 95, oy - 120, 20, 240, s.ac * 40, 10, "v");
    D.text(g, "coroa", ox - 100, oy + 140, { align: "center", size: 12 });
    D.path(g, [[ox - 140, oy + 95], [ox - 96, oy + 80], [ox - 96, oy + 120], [ox - 140, oy + 108]], C.line, 1.5, true, "#9ec0f0"); D.line(g, ox - 220, oy + 101, ox - 140, oy + 101, C.steelD, 6); D.text(g, "pinhão (do cardã)", ox - 225, oy + 130, { size: 12 });
    // planetárias (laterais) e satélites
    D.path(g, [[ox - 55, oy - 40], [ox - 30, oy - 25], [ox - 30, oy + 25], [ox - 55, oy + 40]], C.line, 1.5, true, "#b8e0a8"); stripes(g, ox - 55, oy - 40, 25, 80, s.aL * 40, 10, "v");
    D.path(g, [[ox + 55, oy - 40], [ox + 30, oy - 25], [ox + 30, oy + 25], [ox + 55, oy + 40]], C.line, 1.5, true, "#b8e0a8"); stripes(g, ox + 30, oy - 40, 25, 80, s.aR * 40, 10, "v");
    D.path(g, [[ox - 28, oy - 60], [ox + 28, oy - 60], [ox + 18, oy - 30], [ox - 18, oy - 30]], C.line, 1.5, true, "#f6d070"); stripes(g, ox - 28, oy - 60, 56, 30, s.asp * 40, 9, "h");
    D.path(g, [[ox - 28, oy + 60], [ox + 28, oy + 60], [ox + 18, oy + 30], [ox - 18, oy + 30]], C.line, 1.5, true, "#f6d070"); stripes(g, ox - 28, oy + 30, 56, 30, -s.asp * 40, 9, "h");
    D.line(g, ox - 260 + 40, oy, ox - 55, oy, C.steelD, 7); D.line(g, ox + 55, oy, ox + 250, oy, C.steelD, 7);
    D.text(g, "semieixo esq.", ox - 210, oy - 8, { size: 12 }); D.text(g, "semieixo dir.", ox + 150, oy - 8, { size: 12 });
    D.text(g, "satélites (amarelos): só giram quando as rodas giram diferente", ox, 360, { align: "center", size: 12 });
    if (s.lock) D.label(g, "🔒 bloqueado: tudo gira junto", ox - 60, 40, { color: C.red });
  },
  info(s) {
    const v = this.speeds(s);
    let cap;
    if (s.cena === "gelo" && !s.lock) cap = "<b>Diferencial aberto com uma roda no gelo:</b> ele manda sempre o <b>mesmo torque</b> para as duas rodas. A do gelo quase não tem aderência, então o torque é minúsculo dos dois lados: ela gira o dobro e a outra fica parada. Solução: bloqueio ou autoblocante.";
    else if (s.lock && Math.abs(s.turn) > 5) cap = "Bloqueado na curva: as duas rodas são obrigadas a girar igual, então uma <b>arrasta</b> no chão (pneu raspando, direção pesada). Por isso só se bloqueia fora de estrada.";
    else if (Math.abs(s.turn) > 2) cap = `Na curva, a roda de fora gira mais (${nf(Math.max(v.L, v.R) * 100, 0)}%) e a de dentro menos (${nf(Math.min(v.L, v.R) * 100, 0)}%). A média continua igual à da caixa — os satélites giram para compensar.`;
    else cap = "Em linha reta, tudo gira junto como um bloco: os satélites ficam parados em relação à caixa.";
    return { stats: [["Roda esquerda", `${nf(v.L * 100, 0)}%`], ["Roda direita", `${nf(v.R * 100, 0)}%`], ["Caixa do diferencial", "100%"], ["Carro", v.moving ? "andando" : "parado (patinando)"]], cap };
  },
  explain: [
    ["Regra de ouro", `<p><span class="f">ω<sub>esq</sub> + ω<sub>dir</sub> = 2·ω<sub>caixa</sub></span></p><p>O torque é dividido <b>igual</b> entre as rodas — limitado pela roda com menos aderência.</p>`],
    ["Tipos", `<ul><li><b>Aberto:</b> o comum.</li><li><b>Autoblocante (LSD):</b> embreagens ou engrenagens Torsen limitam a diferença.</li><li><b>Bloqueável:</b> trava 100% (jipes).</li><li><b>Central:</b> nos 4×4, entre os eixos dianteiro e traseiro.</li></ul>`],
  ],
});

// ---------------- Embreagem e câmbio ----------------
const GEARS = { N: 0, 1: 3.6, 2: 2.1, 3: 1.4, 4: 1.0, 5: 0.8, R: -3.3 };
M({
  id: "cambio", group: "Transmissão", title: "Embreagem e caixa de câmbio", icon: "🕹️", short: "Desligar o motor das rodas e escolher a relação.",
  lead: "A embreagem separa o motor da caixa usando atrito; o câmbio escolhe qual par de engrenagens leva o giro até as rodas. Pise na embreagem e troque a marcha.",
  h: 400,
  controls: [
    { k: "ped", label: "Pedal da embreagem", min: 0, max: 100, v: 0, unit: "%" },
    { k: "gear", type: "seg", label: "Marcha", v: "1", options: Object.keys(GEARS).map(k => [k, k === "N" ? "Neutro" : k === "R" ? "Ré" : `${k}ª`]) },
    { k: "rpm", label: "Rotação do motor", min: 800, max: 6000, step: 100, v: 2500, unit: "rpm" },
  ],
  init(s) { s.ae = 0; s.ad = 0; s.ao = 0; },
  calc(s) {
    const p = s.ped / 100, eng = p < 0.35 ? 1 : p > 0.75 ? 0 : 1 - (p - 0.35) / 0.4, r = GEARS[s.gear];
    const disc = eng; // fração da rotação do motor que chega ao disco (com o carro "acompanhando")
    const outRpm = r ? s.rpm * disc / r : 0, kmh = outRpm / 4.1 * TAU * 0.3 * 60 / 1000;
    return { p, eng, r, disc, outRpm, kmh, slip: eng > 0 && eng < 1 };
  },
  draw(g, s, dt) {
    const c = this.calc(s), w = rpmVis(s.rpm) * dt;
    s.ae += w; s.ad += w * c.disc; s.ao += c.r ? w * c.disc / c.r : 0;
    // ---- embreagem (corte) ----
    const y = 200, gap = c.p * 10;
    D.text(g, "EMBREAGEM (corte)", 40, 40, { bold: true });
    D.line(g, 20, y, 90, y, C.steelD, 8); D.text(g, "virabrequim", 20, y + 22, { size: 11, color: C.muted });
    D.rect(g, 90, y - 110, 26, 220, C.steel, C.line); stripes(g, 90, y - 110, 26, 220, s.ae * 40, 12); D.text(g, "volante", 103, y + 128, { align: "center", size: 11 });
    const dx = 116 + gap;
    D.rect(g, dx, y - 90, 8, 180, c.slip ? "#ff8a3a" : "#8a5a2a", C.line); D.rect(g, dx + 8, y - 80, 6, 160, C.steelL, C.line); stripes(g, dx, y - 90, 14, 180, s.ad * 40, 12);
    D.text(g, "disco", dx + 7, y - 96, { align: "center", size: 11 });
    const px = dx + 14 + gap;
    D.rect(g, px, y - 95, 18, 190, C.steelL, C.line); stripes(g, px, y - 95, 18, 190, s.ae * 40, 12); D.text(g, "platô", px + 9, y + 112, { align: "center", size: 11 });
    // mola diafragma e rolamento
    const bx = px + 60 - c.p * 25;
    D.path(g, [[px + 18, y - 80], [bx, y - 20]], C.dark, 3); D.path(g, [[px + 18, y + 80], [bx, y + 20]], C.dark, 3);
    D.rect(g, bx, y - 22, 16, 44, "#d0d0d0", C.line); D.text(g, "rolamento", bx + 8, y + 40, { align: "center", size: 11 });
    D.line(g, dx + 7, y, 300, y, C.steelD, 6); D.text(g, "eixo da caixa", 230, y + 22, { size: 11, color: C.muted });
    D.arrow(g, bx + 70, y - 60, bx + 22, y - 30, C.red, 3); D.text(g, "garfo (pedal)", bx + 30, y - 66, { size: 11, color: C.red });
    if (c.slip) D.label(g, "patinando: atrito vira calor", 40, 360, { color: C.orange });
    // ---- caixa ----
    const ox = 400, top = 150, bot = 250, pairs = [["1", 3.6], ["2", 2.1], ["3", 1.4], ["4", 1.0], ["5", 0.8]];
    D.text(g, "CAIXA DE CÂMBIO (vista lateral)", ox, 40, { bold: true });
    const cd = bot - top;
    D.line(g, ox - 10, top, ox + 440, top, C.steelD, 8); D.text(g, "primário (motor)", ox - 14, top + 4, { size: 11, color: C.muted, align: "right" });
    D.line(g, ox - 10, bot, ox + 440, bot, c.r ? C.steelD : C.steel, 8); D.text(g, "saída (rodas)", ox - 14, bot + 4, { size: 11, color: C.muted, align: "right" });
    stripes(g, ox - 10, bot - 4, 450, 8, s.ao * 40, 14, "h", 0, "rgba(255,255,255,.7)");
    pairs.forEach(([k, ratio], i) => {
      const x = ox + 20 + i * 76, ri = cd / (1 + ratio), ro = cd - ri, on = s.gear === k;
      D.rect(g, x, top - ri, 26, 2 * ri, on ? "#9ec0f0" : C.steelL, C.line); stripes(g, x, top - ri, 26, 2 * ri, s.ad * 40, 9);
      D.rect(g, x, bot - ro, 26, 2 * ro, on ? "#f6b880" : C.steelL, C.line); stripes(g, x, bot - ro, 26, 2 * ro, s.ad * 40 / ratio, 9);
      D.text(g, `${k}ª`, x + 13, bot + ro + 16, { align: "center", bold: on, color: on ? C.red : C.ink });
      if (on) { D.rect(g, x + 28, bot - 12, 10, 24, C.red, C.line); }
    });
    const rx = ox + 20 + 5 * 76;
    D.rect(g, rx, top - 28, 20, 56, s.gear === "R" ? "#9ec0f0" : C.steelL, C.line); D.rect(g, rx, bot - 50, 20, 100, s.gear === "R" ? "#f6b880" : C.steelL, C.line);
    D.circle(g, rx + 40, (top + bot) / 2 - 10, 18, s.gear === "R" ? "#c8e8b0" : C.steelL, C.line); D.text(g, "R", rx + 10, bot + 66, { align: "center", bold: s.gear === "R" });
    D.label(g, s.gear === "N" ? "neutro: nenhum par preso no eixo de saída" : `par da ${s.gear === "R" ? "ré (com engrenagem louca)" : s.gear + "ª"} travado pelo anel (vermelho)`, ox, 380);
  },
  info(s) {
    const c = this.calc(s);
    return {
      stats: [["Embreagem", c.eng >= 1 ? "acoplada" : c.eng <= 0 ? "desacoplada" : `patinando (${nf(c.eng * 100, 0)}%)`], ["Relação da marcha", c.r ? `${nf(Math.abs(c.r), 2)} : 1${c.r < 0 ? " (ré)" : ""}` : "—"], ["Rotação de saída", `${nf(Math.abs(c.outRpm), 0)} rpm`], ["Velocidade (dif. 4,1 e roda 60 cm)", `${nf(Math.abs(c.kmh), 0)} km/h`]],
      cap: c.eng <= 0 ? "Pedal no fundo: a mola diafragma solta o platô, o disco fica livre e o motor gira sozinho. É a hora de trocar a marcha." : c.slip ? "Meio-pedal: o disco escorrega no volante — é assim que o carro sai devagar, mas gasta o disco e esquenta." : "Pedal solto: a mola aperta o disco entre o volante e o platô e tudo gira junto (sem perda).",
    };
  },
  explain: [
    ["Embreagem", `<ul><li>Mola diafragma aperta o <b>disco</b> entre o <b>volante</b> e o <b>platô</b>.</li><li>O pedal empurra o rolamento, que alivia a mola.</li><li>Torque transmitido <span class="f">T = μ·F<sub>mola</sub>·r<sub>médio</sub>·2</span> (duas faces).</li></ul>`],
    ["Câmbio manual", `<ul><li>Todos os pares ficam <b>sempre engrenados</b> e girando.</li><li>Na saída, as engrenagens giram soltas até um <b>anel deslizante</b> (com sincronizador) travar uma delas no eixo.</li><li>A ré usa uma engrenagem louca para inverter.</li></ul>`],
    ["Por que tantas marchas", `<p>O motor só tem força numa faixa de rotação. As marchas mantêm o motor nessa faixa do carro parado até a velocidade máxima.</p>`],
  ],
});
