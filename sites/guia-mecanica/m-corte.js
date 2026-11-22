// MechLab — Corte e usinagem: formação do cavaco, cisalhamento, torno/fresa/furadeira, serras e cortes térmicos.
"use strict";

// ---------------- Como a ferramenta corta ----------------
const CHIP = { al: ["Alumínio", "contínuo (fita longa)", 0.35], aco: ["Aço", "contínuo, enrola em espiral", 0.6], ff: ["Ferro fundido", "quebradiço (pedacinhos)", 0.5], lat: ["Latão", "segmentado (escamas)", 0.45] };
M({
  id: "cavaco", group: "Corte e usinagem", title: "Como a ferramenta corta (cavaco)", icon: "🔪", short: "Cunha, ângulos e o cavaco que sai.",
  lead: "Toda ferramenta de corte é uma cunha. Ela não “fatia” o metal: empurra e cisalha uma camada, que sai como cavaco. Mude o ângulo de saída e veja a força e o formato do cavaco.",
  h: 380,
  controls: [
    { k: "mat", type: "seg", label: "Material", v: "aco", options: Object.entries(CHIP).map(([k, v]) => [k, v[0]]) },
    { k: "rake", label: "Ângulo de saída (γ)", min: -10, max: 30, v: 12, unit: "°" },
    { k: "clear", label: "Ângulo de folga (α)", min: 0, max: 15, v: 7, unit: "°" },
    { k: "ap", label: "Profundidade de corte", min: 10, max: 50, v: 28, unit: "px" },
  ],
  init(s) { s.chips = []; },
  draw(g, s, dt) {
    const y0 = 220, ap = s.ap, x = 470, off = (s.t * 70) % 40;
    const rk = s.rake * Math.PI / 180, cl = s.clear * Math.PI / 180;
    // peça andando para a direita; a camada a ser cortada está à esquerda da ferramenta
    D.hatch(g, 0, y0, 900, 140, "#c8d4e0");
    D.rect(g, 0, y0 - ap, x, ap, "#c8d4e0", C.line, 1.2); g.save(); g.beginPath(); g.rect(0, y0 - ap, x, ap); g.clip(); for (let i = -1; i < 14; i++) D.line(g, i * 40 + off, y0 - ap, i * 40 + off + ap, y0, "#9aa", 1); g.restore();
    D.arrow(g, 620, y0 + 60, 720, y0 + 60, C.blue, 3); D.text(g, "peça avança", 620, y0 + 82, { size: 12, color: C.blue });
    // plano de cisalhamento (Merchant: φ ≈ 45° + γ/2 − β/2)
    const beta = 0.6 + CHIP[s.mat][2] * 0.2, phi = Math.PI / 4 + rk / 2 - beta / 2;
    D.line(g, x, y0, x - ap / Math.tan(phi), y0 - ap, C.red, 2, [5, 3]);
    D.text(g, `plano de cisalhamento (φ ≈ ${nf(phi * 180 / Math.PI, 0)}°)`, 40, y0 - ap - 12, { size: 12, color: C.red });
    // cavaco sobe pela face da ferramenta e enrola
    if (s.mat === "ff" || s.mat === "lat") {
      if (Math.random() < dt * 8) s.chips.push({ x: x - 10, y: y0 - ap - 10, vx: -60 - Math.random() * 60, vy: -140 - Math.random() * 60, a: 0, sz: 4 + Math.random() * 6 });
      for (const c of s.chips) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt; c.a += dt * 5; }
      s.chips = s.chips.filter(c => c.y < y0);
      for (const c of s.chips) { g.save(); g.translate(c.x, c.y); g.rotate(c.a); D.rect(g, -c.sz / 2, -c.sz / 3, c.sz, c.sz * 0.66, "#a8b4c0", C.line, 1); g.restore(); }
    }
    const thick = Math.min(20, ap * 0.55), curl = s.mat === "aco" ? 0.011 : s.mat === "al" ? 0.004 : 0.02, len = s.mat === "ff" ? 30 : s.mat === "lat" ? 70 : 230;
    g.save(); g.strokeStyle = "#8a96a4"; g.lineWidth = thick; g.lineCap = "butt"; g.lineJoin = "round"; g.beginPath();
    let px = x - Math.sin(rk) * 4 - thick / 2, py = y0 - ap, ang = Math.atan2(-Math.cos(rk), -Math.sin(rk)); g.moveTo(px, py);
    for (let i = 0; i < len; i += 3) { if (i > 20) ang -= curl * 3 * (1 + i / 150); px += Math.cos(ang) * 3; py += Math.sin(ang) * 3; g.lineTo(px, py); }
    g.stroke(); g.restore();
    // ferramenta (cunha): face inclinada γ à esquerda, folga α embaixo à direita
    D.path(g, [[x, y0], [x - Math.sin(rk) * 220, y0 - Math.cos(rk) * 220], [x + 190, y0 - 220], [x + 190, y0 - Math.tan(cl) * 190], [x, y0]], C.line, 1.6, true, "#f2c200");
    D.text(g, "ferramenta", x + 70, y0 - 140, { size: 13, bold: true });
    D.line(g, x, y0, x, y0 - 130, C.muted, 1, [3, 3]); D.text(g, `γ ${s.rake}°`, x - 50, y0 - 112, { size: 12, color: C.purple });
    D.text(g, `α ${s.clear}°`, x + 120, y0 - 6, { size: 12, color: C.purple });
    const F = (1.4 - s.rake / 50) * ap * 18 * (s.mat === "al" ? 0.4 : s.mat === "aco" ? 1 : 0.7);
    D.label(g, `força de corte ≈ ${nf(F, 0)} N`, 680, 40, { color: C.red });
    if (s.clear < 2) D.label(g, "folga pequena demais: as costas da ferramenta esfregam na peça", 520, 70, { color: C.red });
  },
  info(s) {
    return { stats: [["Cavaco do " + CHIP[s.mat][0].toLowerCase(), CHIP[s.mat][1]], ["Ângulo de saída", s.rake < 0 ? "negativo: forte, mais força" : s.rake > 18 ? "bem positivo: corta fácil, gume frágil" : "positivo moderado"]],
      cap: "<b>γ (saída)</b> positivo deixa a cunha mais “afiada”: menos força e melhor acabamento, mas o gume quebra mais fácil. Ferramentas de metal duro para aço usam γ pequeno ou até negativo. <b>α (folga)</b> evita que as costas da ferramenta esfreguem — só alguns graus bastam." };
  },
  explain: [
    ["Os ângulos", `<ul><li><b>γ — saída:</b> inclinação da face por onde o cavaco sobe.</li><li><b>α — folga:</b> espaço atrás do gume.</li><li><b>β — cunha:</b> o que sobra (γ + α + β = 90°). β grande = gume forte.</li></ul>`],
    ["Cavaco", `<ul><li><b>Contínuo:</b> materiais dúcteis (alumínio, aço). Precisa de quebra-cavaco.</li><li><b>Segmentado:</b> latão, aço duro em alta velocidade.</li><li><b>Descontínuo:</b> ferro fundido, bronze — sai em pó/pedaços.</li></ul>`],
    ["Calor", `<p>Quase toda a energia do corte vira calor — 80% vai embora com o cavaco. Por isso o cavaco de aço sai azul e o fluido de corte ajuda tanto.</p>`],
  ],
});

// ---------------- Cisalhamento (guilhotina e tesoura) ----------------
M({
  id: "cisalha", group: "Corte e usinagem", title: "Cisalhamento: guilhotina e tesoura", icon: "✂️", short: "Cortar chapa sem cavaco, e por que a folga importa.",
  lead: "Na guilhotina e na tesoura, duas lâminas passam rente uma da outra: o material primeiro dobra, depois é cisalhado e no fim racha. A folga entre as lâminas decide se o corte sai limpo ou com rebarba.",
  h: 380,
  controls: [
    { k: "folga", label: "Folga entre as lâminas", min: 2, max: 25, v: 8, unit: "% da espessura" },
    { k: "esp", label: "Espessura da chapa", min: 1, max: 6, step: 0.5, v: 3, unit: "mm", d: 1 },
  ],
  draw(g, s) {
    const ph = (s.t * 0.35) % 1.4, d = clamp(ph, 0, 1), th = 60, cx = 330, y = 190, gap = s.folga / 100 * th;
    const pen = d * th; // quanto a lâmina desceu dentro da chapa
    const broke = pen > th * (0.25 + 0.4 * (1 - s.folga / 30));
    // chapa: parte presa (esquerda) e parte cortada (direita, cai após romper)
    const fall = broke ? (pen - th * 0.5) * 1.5 + 0 : 0;
    D.hatch(g, 80, y, cx - 80, th, "#c8d4e0");
    g.save(); g.translate(0, broke ? pen * 0.6 + fall : pen * 0.6); D.hatch(g, cx + gap, y, 380, th, "#c8d4e0"); g.restore();
    if (!broke) { g.save(); g.fillStyle = "#c8d4e0"; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + gap, y + pen * 0.6); g.lineTo(cx + gap, y + th + pen * 0.6); g.lineTo(cx, y + th); g.closePath(); g.fill(); g.strokeStyle = C.red; g.lineWidth = 2; g.stroke(); g.restore(); }
    // lâminas
    D.path(g, [[cx - 60, y + th], [cx, y + th], [cx, y + th + 120], [cx - 60, y + th + 120]], C.line, 1.6, true, C.steelD);
    D.path(g, [[cx + gap, y - 130 + pen], [cx + gap + 80, y - 130 + pen], [cx + gap + 80, y + pen], [cx + gap, y + pen]], C.line, 1.6, true, C.steelD);
    D.arrow(g, cx + gap + 40, y - 190 + pen, cx + gap + 40, y - 140 + pen, C.red, 3);
    D.text(g, "lâmina fixa", cx - 30, y + th + 140, { align: "center", size: 12 }); D.text(g, "lâmina móvel", cx + gap + 40, y - 200 + pen, { align: "center", size: 12 });
    // perfil da aresta cortada (resultado)
    const ox = 640, oy = 110, H = 160, ro = clamp(s.folga / 25, 0.05, 1);
    const zR = 0.08 + 0.15 * ro, zS = 0.55 - 0.3 * ro, zF = 1 - zR - zS, burr = 4 + ro * 26;
    D.text(g, "aresta do corte (ampliada)", ox + 60, oy - 12, { align: "center", size: 12, bold: true });
    D.rect(g, ox, oy, 120, H * zR, "#e0d0b0", C.line, 1); D.text(g, "arredondamento", ox + 128, oy + H * zR / 2 + 4, { size: 11 });
    D.rect(g, ox, oy + H * zR, 120, H * zS, "#f4f4f4", C.line, 1); D.text(g, "parte lisa (cisalhada)", ox + 128, oy + H * (zR + zS / 2) + 4, { size: 11 });
    D.rect(g, ox, oy + H * (zR + zS), 120, H * zF, "#b8b0a8", C.line, 1); for (let i = 0; i < 12; i++) D.line(g, ox + i * 10, oy + H * (zR + zS), ox + i * 10 + 6, oy + H, "#888", 1);
    D.text(g, "fratura (áspera)", ox + 128, oy + H * (zR + zS + zF / 2) + 4, { size: 11 });
    D.path(g, [[ox + 60, oy + H], [ox + 64, oy + H + burr], [ox + 70, oy + H]], C.line, 1.5, true, "#b8b0a8"); D.text(g, `rebarba ~${nf(burr / 60 * s.esp * 0.1, 2)} mm`, ox + 80, oy + H + burr, { size: 11, color: C.red });
  },
  info(s) {
    const ideal = s.folga >= 5 && s.folga <= 10;
    return { stats: [["Folga", `${nf(s.esp * s.folga / 100, 2)} mm`], ["Qualidade", ideal ? "boa (5–10%)" : s.folga < 5 ? "folga pequena: desgasta as lâminas" : "folga grande: rebarba e borda torta"]],
      cap: "A rachadura começa nos dois gumes e precisa se encontrar no meio. Com a folga certa as duas trincas se alinham: corte limpo. Folga grande: o material dobra antes de romper (rebarba). Folga pequena: as trincas não se encontram e as lâminas sofrem." };
  },
  explain: [
    ["Etapas", `<ol style="padding-left:18px"><li>Deformação: a chapa dobra (arredondamento).</li><li>Cisalhamento: faixa lisa e brilhante.</li><li>Fratura: o resto racha de uma vez.</li></ol>`],
    ["Tesoura", `<p>É uma guilhotina com pivô: as lâminas se cruzam aos poucos, então o corte acontece num ponto que corre ao longo da lâmina — menos força. Tesoura “frouxa” = folga grande = papel dobrado em vez de cortado.</p>`],
    ["Força", `<p><span class="f">F ≈ comprimento × espessura × resistência ao cisalhamento</span>. Guilhotinas inclinam a lâmina de cima para cortar aos poucos e reduzir a força.</p>`],
  ],
});

// ---------------- Torno, fresa e furadeira ----------------
const VC = { al: ["Alumínio", 250], aco: ["Aço carbono", 90], inox: ["Inox", 60], ff: ["Ferro fundido", 80], mad: ["Madeira", 400], pla: ["Plástico (nylon/PVC)", 150] };
M({
  id: "usinagem", group: "Corte e usinagem", title: "Torno, fresa e furadeira", icon: "🛠️", short: "Quem gira, quem avança, e a rotação certa.",
  lead: "No torno a peça gira e a ferramenta anda; na fresadora e na furadeira a ferramenta gira. A rotação certa sai da velocidade de corte do material: rpm = Vc × 1000 / (π × D).",
  h: 380,
  controls: [
    { k: "maq", type: "seg", label: "Máquina", v: "torno", options: [["torno", "Torno"], ["fresa", "Fresadora"], ["fura", "Furadeira"]] },
    { k: "mat", type: "seg", label: "Material", v: "aco", options: Object.entries(VC).map(([k, v]) => [k, v[0]]) },
    { k: "D", label: "Diâmetro (peça no torno / ferramenta)", min: 3, max: 120, v: 40, unit: "mm" },
    { k: "conc", type: "seg", label: "Fresamento", v: "disc", options: [["disc", "Discordante (convencional)"], ["conc", "Concordante"]] },
  ],
  init(s) { s.a = 0; s.feed = 0; },
  rpm(s) { return VC[s.mat][1] * 1000 / (Math.PI * s.D); },
  draw(g, s, dt) {
    s.a += dt * 3; s.feed = (s.feed + dt * 0.08) % 1;
    if (s.maq === "torno") {
      const cx = 140, cy = 180, L = 560, R = clamp(s.D * 0.9, 20, 90), cut = 10, fx = cx + 60 + s.feed * (L - 120);
      D.rect(g, 40, cy - 110, 90, 220, C.steelD, C.line); D.text(g, "placa", 85, cy + 130, { align: "center", size: 12 });
      for (let k = 0; k < 3; k++) { const a = s.a + k * TAU / 3; D.rect(g, 120, cy + Math.sin(a) * (R + 6) - 8, 28, 16, C.steel, C.line); }
      // peça: já usinada (menor) até a ferramenta, bruta depois
      D.rect(g, cx, cy - R + cut, fx - cx, 2 * (R - cut), "#d8dee6", C.line); D.rect(g, fx, cy - R, cx + L - fx, 2 * R, "#b8c4d0", C.line);
      g.save(); g.beginPath(); g.rect(cx, cy - R, L, 2 * R); g.clip(); for (let i = 0; i < 30; i++) { const yy = cy + Math.sin(s.a * 1.5 + i * 0.6) * R; D.line(g, cx, yy, cx + L, yy, "rgba(0,0,0,.08)", 1); } g.restore();
      D.path(g, [[fx, cy + R - cut], [fx + 18, cy + R + 40], [fx + 60, cy + R + 40], [fx + 60, cy + R + 10], [fx + 6, cy + R - cut]], C.line, 1.5, true, "#f2c200");
      D.rect(g, fx + 30, cy + R + 40, 90, 30, C.steelD, C.line); D.text(g, "ferramenta", fx + 75, cy + R + 90, { align: "center", size: 12 });
      D.arrow(g, fx + 70, cy + R + 110, fx + 130, cy + R + 110, C.red, 3); D.text(g, "avanço", fx + 140, cy + R + 114, { size: 12, color: C.red });
      D.rot(g, cx + 40, cy, R + 20, 1, C.blue, -1.4);
      for (let i = 0; i < 4; i++) { const t = (s.t * 2 + i * 0.25) % 1; D.circle(g, fx + 10 - t * 40, cy + R + 10 + t * 60, 4 + i, null, "#8a96a4", 2); }
    } else if (s.maq === "fresa") {
      const cx = 400, cy = 140, R = 70, n = 4, dir = s.conc === "conc" ? 1 : -1, wx = (s.feed * 300) % 300;
      D.hatch(g, 60, 220, 760, 100, "#c8d4e0"); D.rect(g, 60 + wx + 120, 200, 760 - wx - 120, 20, "#c8d4e0", C.line);
      g.save(); g.translate(cx, cy); g.rotate(s.a * (s.conc === "conc" ? -1 : 1));
      D.circle(g, 0, 0, R, C.steelL, C.line); for (let i = 0; i < n; i++) { g.save(); g.rotate(i * TAU / n); D.path(g, [[R - 4, -6], [R + 14, 0], [R - 4, 8]], C.line, 1.3, true, "#f2c200"); g.restore(); }
      D.pin(g, 0, 0, 12); g.restore();
      D.rot(g, cx, cy, R + 30, s.conc === "conc" ? -1 : 1, C.blue, -2.6);
      D.arrow(g, 760, 340, 660, 340, C.red, 3); D.text(g, "peça avança", 660, 362, { size: 12, color: C.red });
      // espessura do cavaco
      D.path(g, s.conc === "conc" ? [[cx - 60, 200], [cx - 10, 200], [cx - 10, 210]] : [[cx - 60, 210], [cx - 10, 200], [cx - 60, 200]], C.red, 2, true, "rgba(198,40,40,.3)");
      D.label(g, s.conc === "conc" ? "concordante: o dente entra GROSSO e sai fino" : "discordante: o dente entra FINO e sai grosso", 470, 60);
      void dir;
    } else {
      const cx = 400, top = 90, depth = 60 + s.feed * 150, R = clamp(s.D * 1.2, 10, 60);
      D.hatch(g, 160, 220, 480, 140, "#c8d4e0");
      D.rect(g, cx - R, 220, 2 * R, Math.max(0, top + depth - 220), "#fff", null);
      D.rect(g, cx - R, top, 2 * R, depth, C.steelL, C.line);
      g.save(); g.beginPath(); g.rect(cx - R, top, 2 * R, depth); g.clip(); for (let i = -4; i < 30; i++) { const yy = top + ((i * 18 + s.a * 30) % 540); D.line(g, cx - R, yy, cx + R, yy - R * 0.9, C.steelD, 3); } g.restore();
      D.path(g, [[cx - R, top + depth], [cx, top + depth + R * 0.6], [cx + R, top + depth]], C.line, 1.5, true, C.steelL);
      D.rect(g, cx - 40, top - 50, 80, 50, C.steelD, C.line); D.text(g, "mandril", cx, top - 58, { align: "center", size: 12 });
      D.rot(g, cx, top + 30, R + 20, 1, C.blue, -2.2);
      for (let i = 0; i < 6; i++) { const t = (s.t * 1.5 + i / 6) % 1; D.circle(g, cx + (i % 2 ? 1 : -1) * (R + 8 + t * 30), 200 - t * 40, 3, "#8a96a4", null); }
      D.text(g, "os canais helicoidais levam o cavaco para fora", cx + R + 40, 170, { size: 12 });
    }
  },
  info(s) {
    const rpm = this.rpm(s), vc = VC[s.mat][1];
    return { stats: [["Velocidade de corte (Vc)", `${vc} m/min`], ["Rotação recomendada", `${nf(rpm, 0)} rpm`], ["Diâmetro", `${s.D} mm`], ["Regra", "diâmetro maior → rpm menor"]],
      cap: s.maq === "fresa" ? (s.conc === "conc" ? "Concordante: melhor acabamento e vida da ferramenta, mas puxa a peça — precisa de máquina sem folga (CNC)." : "Discordante: o dente começa “esfregando” até morder; empurra a peça contra o avanço — mais seguro em máquinas com folga no fuso.") : s.maq === "fura" ? "Broca: rpm alto em brocas finas, baixo em brocas grossas. Use broca de centro antes, e tire a broca de vez em quando para soltar o cavaco." : "Torno: a peça gira e a ferramenta remove material ao andar. Avanço pequeno = melhor acabamento; profundidade grande = mais rápido." };
  },
  explain: [
    ["Fórmula", `<p><span class="f">rpm = Vc × 1000 / (π × D)</span></p><p>Vc depende do material da peça E da ferramenta (aço rápido ≈ 1/3 do metal duro).</p>`],
    ["Avanço e profundidade", `<ul><li><b>Avanço:</b> quanto a ferramenta anda por volta (mm/rot) ou por dente (fresa).</li><li><b>Profundidade (ap):</b> quanto entra na peça.</li><li>Rotação alta + avanço baixo esfrega e queima a ferramenta.</li></ul>`],
    ["Sinais de problema", `<ul><li>Cavaco azul/fumaça: rpm alto demais.</li><li>Vibração (“chatter”): ferramenta muito para fora, rpm errado.</li><li>Cavaco em pó no aço: ferramenta cega.</li></ul>`],
  ],
});

// ---------------- Serras ----------------
M({
  id: "serras", group: "Corte e usinagem", title: "Serras: dentes, passo e travamento", icon: "🪚", short: "Quantos dentes, para que lado e por que a serra não prende.",
  lead: "Cada dente é uma pequena ferramenta de corte. O travamento (dentes tortos para os lados) abre um corte mais largo que a lâmina, para ela não prender. Pelo menos 3 dentes devem estar dentro do material.",
  h: 380,
  controls: [
    { k: "tpi", label: "Dentes por polegada (TPI)", min: 6, max: 32, v: 18 },
    { k: "esp", label: "Espessura do material", min: 1, max: 30, v: 6, unit: "mm" },
  ],
  draw(g, s) {
    const stroke = Math.sin(s.t * 2.2), x0 = 120 + stroke * 60, y = 150, p = 25.4 / s.tpi * 8, push = Math.cos(s.t * 2.2) > 0;
    const matW = s.esp * 8;
    // material (corte na seção)
    D.hatch(g, 420 - matW / 2, y + 12, matW, 120, "#d8c8b0");
    // lâmina com dentes
    D.rect(g, x0, y - 50, 600, 50, C.steelL, C.line);
    const pts = [[x0, y]]; for (let x = x0; x < x0 + 600; x += p) { pts.push([x + p * 0.7, y + p * 0.55], [x + p, y]); }
    D.path(g, pts, C.line, 1.2, false, null);
    g.save(); g.beginPath(); g.moveTo(x0, y); pts.forEach(q => g.lineTo(...q)); g.lineTo(x0 + 600, y); g.closePath(); g.fillStyle = C.steel; g.fill(); g.restore();
    D.arrow(g, x0 + 250, y - 80, x0 + 250 + (push ? 80 : -80), y - 80, push ? C.green : C.muted, 3);
    D.text(g, push ? "empurrando: corta" : "voltando: não corta (alivie)", x0 + 200, y - 92, { size: 12, color: push ? C.green : C.muted });
    const inMat = Math.floor(matW / p);
    D.label(g, `dentes dentro do material: ${inMat}`, 560, 260, { color: inMat < 3 ? C.red : C.green });
    // vista de cima: travamento
    const ox = 120, oy = 300;
    D.text(g, "vista de cima: travamento", ox, oy - 8, { size: 12, bold: true });
    D.rect(g, ox, oy + 6, 300, 10, C.steel, C.line);
    for (let i = 0; i < 12; i++) { const x = ox + 10 + i * 24, side = i % 3 === 0 ? 0 : i % 3 === 1 ? -1 : 1; D.rect(g, x, oy + 4 + side * 7, 10, 14, C.steelD, C.line); }
    D.line(g, ox, oy - 2, ox + 300, oy - 2, C.red, 1, [3, 3]); D.line(g, ox, oy + 26, ox + 300, oy + 26, C.red, 1, [3, 3]);
    D.text(g, "largura do corte (kerf) > espessura da lâmina", ox + 310, oy + 16, { size: 12, color: C.red });
  },
  info(s) {
    const pitch = 25.4 / s.tpi, n = s.esp / pitch;
    let rec = "6 a 10 TPI (madeira grossa, corte rápido)"; if (s.esp < 3) rec = "24 a 32 TPI (chapa fina, tubo de parede fina)"; else if (s.esp < 6) rec = "18 a 24 TPI (perfis e tubos)"; else if (s.esp < 15) rec = "14 a 18 TPI (barras de aço)";
    return { stats: [["Passo", `${nf(pitch, 2)} mm`], ["Dentes no material", nf(n, 1)], ["Recomendado para essa espessura", rec]],
      cap: n < 3 ? "Menos de 3 dentes no material: cada dente pega muito de uma vez, a serra trava e os dentes quebram. Use mais TPI (dentes mais finos)." : n > 25 ? "Muitos dentes no material: o espaço entre dentes (garganta) enche de cavaco e a serra para de cortar. Use menos TPI." : "Boa escolha: os dentes têm espaço para levar o cavaco e não engancham." };
  },
  explain: [
    ["Regra dos 3 dentes", `<p>Sempre pelo menos 3 dentes dentro do material. Chapa fina pede dentes finos; madeira grossa pede dentes grandes.</p>`],
    ["Sentido", `<ul><li><b>Serra de arco (metal):</b> dentes apontando para a frente — corta empurrando.</li><li><b>Serrote japonês:</b> corta puxando (lâmina fina, não flamba).</li><li><b>Serra circular:</b> dentes viram para cima pela frente da peça.</li></ul>`],
    ["Travamento", `<p>Dentes alternados para os lados abrem um corte mais largo. Lâmina sem travamento (ou gasto) esquenta e prende.</p>`],
  ],
});

// ---------------- Cortes térmicos e especiais ----------------
const PROC = {
  oxi: ["Oxicorte", "Aço carbono", "3 a 300 mm", "± 1 mm", "chama aquece o aço a ~900 °C e um jato de oxigênio queima (oxida) o ferro"],
  plasma: ["Plasma", "Qualquer metal condutor", "1 a 50 mm", "± 0,5 mm", "arco elétrico transforma o gás em plasma (~20 000 °C) que derrete e sopra o metal"],
  laser: ["Laser", "Metais, madeira, acrílico", "0,1 a 25 mm", "± 0,05 mm", "feixe de luz concentrado num ponto minúsculo derrete/vaporiza o material"],
  agua: ["Jato d'água", "Quase tudo (pedra, vidro, borracha, metal)", "1 a 200 mm", "± 0,1 mm", "água a ~4000 bar com areia abrasiva desgasta o material — sem calor"],
  disco: ["Disco abrasivo (esmerilhadeira)", "Metais, pedra", "até ~60 mm", "manual", "grãos duros do disco arrancam micro-cavacos em alta velocidade — faíscas são cavacos em brasa"],
};
M({
  id: "cortes", group: "Corte e usinagem", title: "Oxicorte, plasma, laser e jato d'água", icon: "⚡", short: "Cortar com calor, luz, água ou abrasivo.",
  lead: "Quando não dá para usar lâmina, corta-se derretendo, queimando ou desgastando o material. Cada processo tem seu tipo de material, espessura e precisão.",
  h: 360,
  controls: [{ k: "p", type: "seg", label: "Processo", v: "plasma", options: Object.entries(PROC).map(([k, v]) => [k, v[0]]) }],
  init(s) { s.sp = []; },
  draw(g, s, dt) {
    const f = (s.t * 0.12) % 1, x = 120 + f * 600, y = 200;
    D.hatch(g, 80, y, 720, 40, "#c8d4e0");
    D.rect(g, 120, y, x - 120, 40, "#fff", null); D.line(g, 120, y, x, y, C.line, 1.2); D.line(g, 120, y + 40, x, y + 40, C.line, 1.2);
    const col = { oxi: "#ff9a2a", plasma: "#c8a8ff", laser: "#ff2a2a", agua: "#6ab0f0", disco: "#ffcf3f" }[s.p];
    if (s.p === "disco") { D.circle(g, x, y - 30, 70, C.steelD, C.line); g.save(); g.translate(x, y - 30); g.rotate(s.t * 20); D.line(g, 0, 0, 60, 0, "#999", 3); g.restore(); D.circle(g, x, y - 30, 12, C.steel, C.line); }
    else {
      D.path(g, [[x - 24, y - 140], [x + 24, y - 140], [x + 12, y - 20], [x - 12, y - 20]], C.line, 1.5, true, C.steel);
      if (s.p === "laser") { D.line(g, x, y - 20, x, y + 40, col, 3); D.line(g, x - 12, y - 140, x, y - 20, "rgba(255,40,40,.4)", 2); D.line(g, x + 12, y - 140, x, y - 20, "rgba(255,40,40,.4)", 2); }
      else { g.save(); g.fillStyle = col; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x - 6, y - 20); g.lineTo(x + 6, y - 20); g.lineTo(x + 3, y + 46); g.lineTo(x - 3, y + 46); g.fill(); g.restore(); }
    }
    if (Math.random() < dt * 60) s.sp.push({ x, y: s.p === "disco" ? y : y + 40, vx: (s.p === "disco" ? -200 : -40) - Math.random() * 120, vy: (s.p === "disco" ? -80 : 40) + Math.random() * 120, t: 0.6 });
    for (const p of s.sp) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.t -= dt; }
    s.sp = s.sp.filter(p => p.t > 0);
    for (const p of s.sp) D.line(g, p.x, p.y, p.x - p.vx * 0.02, p.y - p.vy * 0.02, s.p === "agua" ? "rgba(106,176,240,.8)" : "rgba(255,170,40,.9)", 2);
    D.label(g, PROC[s.p][4], 40, 330, { size: 12 });
  },
  info(s) { const p = PROC[s.p]; return { stats: [["Materiais", p[1]], ["Espessura típica", p[2]], ["Precisão", p[3]]], cap: { oxi: "Oxicorte só funciona em aço carbono: o ferro precisa queimar no oxigênio. Inox e alumínio não queimam assim — para eles, plasma.", plasma: "Plasma corta qualquer metal que conduz eletricidade, rápido e barato. A borda sai um pouco chanfrada.", laser: "Laser: corte estreitíssimo e preciso, ideal para chapas finas e peças pequenas. Metais muito refletivos (cobre) são difíceis.", agua: "Jato d'água não aquece: não muda a dureza nem empena. Corta materiais que derreteriam ou trincariam com calor.", disco: "Disco abrasivo: o mais acessível. Use proteção — disco quebrado vira estilhaço e as faíscas queimam." }[s.p] }; },
  explain: [
    ["Zona afetada pelo calor", `<p>Processos térmicos endurecem/mudam a estrutura perto do corte (ZTA). Pode trincar ao dobrar depois. Jato d'água e serra não têm ZTA.</p>`],
    ["Kerf (largura do corte)", `<ul><li>Laser: ~0,2 mm</li><li>Jato d'água: ~1 mm</li><li>Plasma: ~1,5–3 mm</li><li>Oxicorte: ~2–4 mm</li></ul>`],
  ],
});
