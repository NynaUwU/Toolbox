// Componente compartilhado das ferramentas de rádio (RTL-SDR): conexão, espectro + cascata,
// sintonia manual, áudio, gravações e log. Uso:  const sdr = new SdrPanel(el, { tool, profile, presets, ... })
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtHz = hz => (Math.abs(hz) >= 1e6 ? (hz / 1e6).toFixed(4) + " MHz" : (hz / 1e3).toFixed(1) + " kHz");
const GAINS = [0, 0.9, 1.4, 2.7, 3.7, 7.7, 8.7, 12.5, 14.4, 15.7, 16.6, 19.7, 20.7, 22.9, 25.4, 28, 29.7, 32.8, 33.8, 36.4, 37.2, 38.6, 40.2, 42.1, 43.4, 43.9, 44.5, 48, 49.6];
const STEPS = [[100, "100 Hz"], [1000, "1 kHz"], [5000, "5 kHz"], [8333, "8,33 kHz"], [12500, "12,5 kHz"], [25000, "25 kHz"], [100000, "100 kHz"], [1e6, "1 MHz"]];

// Paleta da cascata (preto → azul → ciano → amarelo → vermelho → branco)
const LUT = (() => {
  const stops = [[0, 0, 0, 0], [0.25, 0, 0, 160], [0.45, 0, 200, 255], [0.65, 255, 255, 0], [0.85, 255, 40, 0], [1, 255, 255, 255]];
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255, k = stops.findIndex(s => s[0] >= t), a = stops[Math.max(0, k - 1)], b = stops[k];
    const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return out;
})();

const CSS = `
.sdr { display: flex; flex-direction: column; gap: 6px; }
.sdr-top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sdr-freq { font: bold 22px "Courier New", monospace; width: 190px; text-align: right; padding: 1px 6px; height: 30px; }
.sdr-status { font-size: 11px; }
.sdr-status b.ok { color: #006400; } .sdr-status b.bad { color: #a00000; }
.sdr-scope { position: relative; background: #000; user-select: none; }
.sdr-scope canvas { display: block; width: 100%; }
.sdr-scope .spec { height: 130px; cursor: crosshair; } .sdr-scope .wf { height: 150px; cursor: crosshair; }
.sdr-hover { position: absolute; top: 2px; left: 4px; color: #ff0; font: 11px "Courier New", monospace; pointer-events: none; text-shadow: 1px 1px #000; }
.sdr-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.sdr-row label { white-space: nowrap; }
.sdr-row select, .sdr-row input[type=number] { max-width: 150px; }
.sdr-level { width: 90px; height: 10px; background: #000; display: inline-block; vertical-align: middle; position: relative; }
.sdr-level i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #0a0, #ff0, #f00); }
.sdr-setup { background: #ffffe1; border: 1px solid #000; padding: 8px; }
.sdr-setup ol { margin: 4px 0 4px 18px; padding: 0; }
.sdr-log { height: 160px; overflow: auto; background: #fff; font: 11px "Courier New", monospace; white-space: pre-wrap; padding: 4px; }
.sdr-log .t { color: #808080; }
button.on { box-shadow: inset -1px -1px #fff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px grey; font-weight: bold; }
`;

export class SdrPanel {
  constructor(root, opt = {}) {
    this.root = root; this.opt = opt; this.state = null; this.device = {}; this.center = 0; this.rate = 2048000;
    this.dbMin = opt.dbMin ?? -100; this.dbMax = opt.dbMax ?? -20; this.listen = false; this.vol = 0.8; this.autoDone = false; this.autoFrames = 0;
    if (!document.getElementById("sdr98-css")) { const st = document.createElement("style"); st.id = "sdr98-css"; st.textContent = CSS; document.head.append(st); }
    this.render(); this.connect();
  }

  render() {
    const o = this.opt;
    this.root.classList.add("sdr");
    this.root.innerHTML = `
      <div class="sdr-setup" data-r="setup" hidden></div>
      <div class="sdr-top">
        <button data-r="dn" title="Descer um passo">◀</button>
        <input class="sdr-freq" data-r="freq" title="Frequência (MHz) — Enter para sintonizar">
        <button data-r="up" title="Subir um passo">▶</button>
        <select data-r="step" title="Passo">${STEPS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        ${o.presets ? `<select data-r="preset" title="Frequências prontas"><option value="">Frequências…</option>${o.presets.map((p, i) => p.group ? `<optgroup label="${esc(p.group)}">` : `<option value="${i}">${esc(p.label)}</option>`).join("")}</select>` : ""}
        <span style="flex:1"></span>
        <span class="sdr-status" data-r="status">conectando…</span>
      </div>
      <div class="sdr-scope sunken-panel"><canvas class="spec" data-r="spec"></canvas><canvas class="wf" data-r="wf"></canvas><div class="sdr-hover" data-r="hover"></div></div>
      <div class="sdr-row">
        ${o.modes === false ? "" : `<label>Modo <select data-r="mode"></select></label>`}
        ${o.modes === false ? "" : `<label>Banda <input type="number" data-r="bw" step="500" min="500" style="width:80px"> Hz</label>`}
        <label>Ganho <select data-r="gain"><option value="auto">Automático</option>${GAINS.map(g => `<option value="${g}">${g} dB</option>`).join("")}</select></label>
        ${o.audio === false ? "" : `<label>Squelch <input type="range" data-r="sq" min="-120" max="0" value="-120" style="width:90px"></label>
        <button data-r="listen">🔊 Ouvir</button><input type="range" data-r="vol" min="0" max="100" value="80" style="width:70px" title="Volume">`}
        <span title="Nível do canal"><span class="sdr-level"><i data-r="lvl"></i></span></span>
      </div>
      <div class="sdr-row">
        ${o.audio === false ? "" : `<button data-r="recA">⏺ Gravar áudio</button>`}
        <button data-r="recIQ" title="Grava as amostras IQ brutas (para reprocessar depois)">⏺ Gravar IQ</button>
        <button data-r="snap">📷 Salvar espectro</button>
        <span data-r="recInfo" class="muted"></span>
        <span style="flex:1"></span>
        <button data-r="auto" title="Ajustar a escala ao sinal atual">Auto</button>
        <label>Escala <input type="range" data-r="ref" min="-60" max="0" value="${this.dbMax}" style="width:70px" title="Topo (dB)"><input type="range" data-r="rng" min="20" max="100" value="${this.dbMax - this.dbMin}" style="width:70px" title="Faixa (dB)"></label>
      </div>
      <details><summary>Ajustes avançados</summary><div class="sdr-row" style="margin-top:4px">
        <label>Taxa <select data-r="rate">${[[250000, "250 kS/s"], [1024000, "1,024 MS/s"], [1536000, "1,536 MS/s"], [2000000, "2 MS/s"], [2048000, "2,048 MS/s"], [2400000, "2,4 MS/s"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <label>Correção <input type="number" data-r="ppm" step="1" style="width:55px"> ppm</label>
        <label title="RTL-SDR V3: ondas curtas (HF) abaixo de 28,8 MHz pelo ramo Q">Amostragem direta <select data-r="ds"><option value="0">Desligada</option><option value="2">Ramo Q (HF no V3)</option><option value="1">Ramo I</option></select></label>
        <div class="field-row"><input type="checkbox" data-r="bias" id="bias-${Math.random().toString(36).slice(2)}"><label data-r="biasL">Bias-tee (alimenta LNA/antena ativa)</label></div>
      </div></details>`;
    const $ = n => this.root.querySelector(`[data-r="${n}"]`);
    this.$ = $;
    const biasId = $("bias").id; $("biasL").setAttribute("for", biasId);
    this.spec = $("spec"); this.wf = $("wf");
    // eventos
    $("freq").onkeydown = e => { if (e.key === "Enter") this.setFreq(parseFloat(String($("freq").value).replace(",", ".")) * 1e6); };
    $("freq").onblur = () => this.showFreq();
    $("up").onclick = () => this.setFreq(this.tuned() + +$("step").value);
    $("dn").onclick = () => this.setFreq(this.tuned() - +$("step").value);
    if ($("preset")) $("preset").onchange = () => { const p = o.presets[+$("preset").value]; if (p) this.applyPreset(p); $("preset").value = ""; };
    if ($("mode")) $("mode").onchange = () => this.tune({ mode: $("mode").value, bw: null });
    if ($("bw")) $("bw").onchange = () => this.tune({ bw: +$("bw").value });
    $("gain").onchange = () => this.tune({ gain: $("gain").value === "auto" ? "auto" : +$("gain").value });
    if ($("sq")) $("sq").onchange = () => this.tune({ squelch: +$("sq").value <= -120 ? null : +$("sq").value });
    if ($("listen")) $("listen").onclick = () => this.toggleListen();
    if ($("vol")) $("vol").oninput = () => { this.vol = $("vol").value / 100; if (this.gainNode) this.gainNode.gain.value = this.vol; };
    if ($("recA")) $("recA").onclick = () => this.send({ cmd: "record", kind: "audio", on: !this.recOn("audio"), name: o.recName?.() });
    $("recIQ").onclick = () => this.send({ cmd: "record", kind: "iq", on: !this.recOn("iq") });
    $("snap").onclick = () => this.snapshot();
    $("ref").oninput = $("rng").oninput = () => { this.dbMax = +$("ref").value; this.dbMin = this.dbMax - +$("rng").value; this.autoDone = true; };
    $("auto").onclick = () => { this.autoDone = false; this.autoFrames = 0; };
    $("step").value = String(o.step || 12500);
    $("rate").onchange = () => this.tune({ rate: +$("rate").value });
    $("ppm").onchange = () => this.tune({ ppm: +$("ppm").value || 0 });
    $("ds").onchange = () => this.tune({ directSampling: +$("ds").value });
    $("bias").onchange = () => this.tune({ biasTee: $("bias").checked });
    // espectro: clique sintoniza, roda ajusta
    for (const c of [this.spec, this.wf]) {
      c.addEventListener("click", e => { const f = this.xToFreq(e); if (o.clickTunes === false) return; o.clickTunes === "center" ? this.setFreq(f) : this.tuneTo(f); });
      c.addEventListener("mousemove", e => { $("hover").textContent = fmtHz(this.xToFreq(e)); });
      c.addEventListener("mouseleave", () => { $("hover").textContent = ""; });
      c.addEventListener("wheel", e => { e.preventDefault(); this.setFreq(this.tuned() + (e.deltaY < 0 ? 1 : -1) * +$("step").value); }, { passive: false });
    }
    addEventListener("resize", () => this.sizeCanvases());
    this.sizeCanvases();
  }

  sizeCanvases() {
    for (const c of [this.spec, this.wf]) { const w = c.clientWidth || 600; if (c.width !== w) { c.width = w; c.height = c.clientHeight || 130; } }
  }
  xToFreq(e) { const r = e.target.getBoundingClientRect(); return this.center + ((e.clientX - r.left) / r.width - 0.5) * this.rate; }
  tuned() { return this.state ? this.state.freq + this.state.vfo : 0; }
  showFreq() { if (document.activeElement !== this.$("freq")) this.$("freq").value = (this.tuned() / 1e6).toFixed(6); }

  /** Sintoniza a frequência f: move só o canal se f está dentro da faixa, senão re-centraliza o dongle. */
  tuneTo(f) {
    const s = this.state; if (!s) return;
    const off = f - s.freq, lim = s.rate * 0.42;
    if (Math.abs(off) < lim && this.opt.keepCenter !== false) this.tune({ vfo: Math.round(off) });
    else this.setFreq(f);
  }
  setFreq(f) {
    if (!(f > 0)) return;
    const off = this.opt.centerOffset ?? (this.state?.mode === "wfm" ? 0 : 250e3); // foge do pico DC no centro
    this.tune({ freq: Math.round(f + off), vfo: -off });
  }
  applyPreset(p) {
    const off = p.centerOffset ?? this.opt.centerOffset ?? (p.mode === "wfm" ? 0 : 250e3);
    this.tune({ freq: Math.round(p.freq + off), vfo: -off, ...(p.mode ? { mode: p.mode } : {}), ...(p.bw ? { bw: p.bw } : { bw: null }), ...(p.rate ? { rate: p.rate } : {}), ...(p.extra || {}) });
    this.opt.onPreset?.(p);
  }
  tune(m) { this.send({ cmd: "tune", tool: this.opt.tool, ...m }); }
  recOn(kind) { return Boolean(this.rec?.[kind]); }

  // ---------- conexão ----------
  connect() {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/sdr`);
    ws.binaryType = "arraybuffer"; this.ws = ws;
    ws.onopen = () => {
      this.$("status").textContent = "conectado ao servidor…";
      if (this.opt.profile) this.tune({ ...this.opt.profile });
      if (this.listen) this.send({ cmd: "audio", on: true });
    };
    ws.onclose = () => { this.$("status").innerHTML = '<b class="bad">● desconectado</b> — tentando de novo…'; setTimeout(() => this.connect(), 2500); };
    ws.onmessage = e => (typeof e.data === "string" ? this.onJson(JSON.parse(e.data)) : this.onBinary(e.data));
  }
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }

  onJson(m) {
    if (m.type === "state") {
      this.state = m.state; this.device = m.device; this.rec = m.rec;
      const $ = this.$;
      if ($("mode") && !$("mode").options.length) $("mode").innerHTML = Object.entries(m.modes).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
      if ($("mode")) $("mode").value = m.state.mode;
      if ($("bw")) $("bw").value = m.state.bw || m.modes[m.state.mode]?.bw || "";
      $("gain").value = String(m.state.gain); $("rate").value = String(m.state.rate); $("ppm").value = m.state.ppm; $("ds").value = String(m.state.directSampling); $("bias").checked = !!m.state.biasTee;
      if ($("sq") && document.activeElement !== $("sq")) $("sq").value = m.state.squelch ?? -120;
      this.showFreq();
      const d = m.device, ok = d.status === "conectado";
      $("status").innerHTML = `${ok ? '<b class="ok">●</b>' : '<b class="bad">●</b>'} ${esc(d.source || "RTL-SDR")} ${ok ? `(${esc(d.tuner)})` : `— ${esc(d.status)}`}${m.clients > 1 ? ` · ${m.clients} conectados` : ""}${m.state.tool && m.state.tool !== this.opt.tool ? ` · sintonizado por: ${esc(m.state.tool)}` : ""}`;
      for (const [k, b] of [["audio", "recA"], ["iq", "recIQ"]]) if ($(b)) { const on = this.recOn(k); $(b).classList.toggle("on", on); $(b).textContent = `${on ? "⏹ Parar" : "⏺ Gravar"} ${k === "audio" ? "áudio" : "IQ"}`; }
      const recs = Object.entries(m.rec || {}).map(([k, r]) => `${k}: ${(r.bytes / 1048576).toFixed(1)} MB`);
      $("recInfo").textContent = recs.length ? `● gravando — ${recs.join(" · ")}` : "";
      this.renderSetup(d);
      this.opt.onState?.(m);
    } else if (m.type === "event") this.opt.onEvent?.(m.ev);
    else if (m.type === "planes") this.opt.onPlanes?.(m.list);
  }

  async renderSetup(d) {
    const box = this.$("setup");
    if (d.status === "conectado" && d.source !== "demonstração (simulador)") { box.hidden = true; return; }
    if (this._setupFor === d.status + d.source) return; this._setupFor = d.status + d.source;
    const t = await (await fetch("/api/sdr/tools")).json();
    const demo = t.demo;
    box.hidden = false;
    box.innerHTML = demo
      ? `🧪 <b>Modo demonstração</b>: sinais simulados (FM 98,5/100,1 · aviação 118,1 · APRS 145,825 · DTMF 146,52 · controle 433,92 · ADS-B 1090 · satélite 137,9 · TV 55,25 · WWV 10 MHz). <button class="local-only" data-a="demo-off">Usar o RTL-SDR de verdade</button>`
      : `<b>📡 Configurar o RTL-SDR</b>${d.error ? `<p class="error">${esc(d.error)}</p>` : ""}
        <ol>
          <li><b>Driver (uma vez):</b> o Windows precisa do driver WinUSB para o dongle — é a única coisa instalada no sistema.
            <button class="local-only" data-a="zadig">Baixar e abrir o Zadig</button> → menu <i>Options › List All Devices</i> → escolha <i>Bulk-In, Interface (Interface 0)</i> → <i>WinUSB</i> → <i>Replace Driver</i>.</li>
          <li><b>Programas do rádio (portáteis):</b> ${Object.entries(t.tools).filter(([k]) => k !== "zadig").map(([k, v]) => `${esc(v.label)} ${v.ok ? "✔" : `<button class="local-only" data-a="install:${k}">⬇ Baixar</button>`}`).join(" · ")}</li>
          <li>Conecte o dongle e recarregue a página.</li>
        </ol>
        <button class="local-only" data-a="demo-on">🧪 Ver em modo demonstração (sem dongle)</button>
        <span data-r="setupMsg" class="muted"></span>`;
    box.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
      const a = b.dataset.a, post = (u, body) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(r => r.json());
      if (a === "demo-on" || a === "demo-off") { await post("/api/sdr/demo", { on: a === "demo-on" }); this._setupFor = null; }
      else if (a === "zadig") { b.disabled = true; const { id } = await post("/api/sdr/install", { name: "zadig" }); await this.waitJob(id, b); await post("/api/sdr/zadig"); }
      else if (a.startsWith("install:")) { b.disabled = true; const { id } = await post("/api/sdr/install", { name: a.slice(8) }); await this.waitJob(id, b); this._setupFor = null; this.renderSetup(this.device); }
    });
  }
  async waitJob(id, btn) {
    for (;;) {
      const j = await (await fetch(`/api/jobs/${id}`)).json();
      btn.textContent = j.status === "running" ? `${j.stage}${j.progress != null ? ` ${j.progress}%` : ""}` : j.status === "done" ? "✔ pronto" : `✖ ${j.error}`;
      if (j.status !== "running") return j;
      await new Promise(r => setTimeout(r, 700));
    }
  }

  onBinary(buf) {
    const t = new Uint8Array(buf, 0, 1)[0];
    if (t === 1) {
      const dv = new DataView(buf); this.center = dv.getFloat64(8, true); this.rate = dv.getFloat64(16, true);
      this.draw(new Float32Array(buf, 24));
    } else if (t === 2) this.playAudio(new DataView(buf).getFloat32(4, true), new Int16Array(buf, 8));
    else if (t === 3) { const dv = new DataView(buf); this.opt.onTv?.(dv.getUint16(2, true), dv.getUint16(4, true), new Uint8Array(buf, 8)); }
  }

  // ---------- desenho ----------
  draw(db) {
    this.sizeCanvases();
    // escala automática nos primeiros quadros (piso de ruído = mediana; topo = pico + margem)
    if (!this.autoDone && ++this.autoFrames > 5) {
      const sorted = Float32Array.from(db).sort(), floor = sorted[Math.floor(sorted.length / 2)], peak = sorted[sorted.length - 1];
      this.dbMin = Math.round(floor - 8); this.dbMax = Math.round(Math.max(peak + 5, floor + 40));
      this.$("ref").value = this.dbMax; this.$("rng").value = this.dbMax - this.dbMin; this.autoDone = true;
    }
    const sc = this.spec, g = sc.getContext("2d"), W = sc.width, H = sc.height, n = db.length;
    const lo = this.dbMin, hi = this.dbMax, y = v => H - ((v - lo) / (hi - lo)) * H;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    // grade de frequência
    g.strokeStyle = "#1a3a1a"; g.fillStyle = "#6c6"; g.font = "10px Tahoma"; g.lineWidth = 1;
    const span = this.rate, stepHz = [1e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6].find(s => span / s <= 10) || 1e6;
    const f0 = this.center - span / 2;
    for (let f = Math.ceil(f0 / stepHz) * stepHz; f < f0 + span; f += stepHz) {
      const x = ((f - f0) / span) * W; g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke();
      g.fillText((f / 1e6).toFixed(stepHz < 1e5 ? 3 : 2), x + 2, H - 3);
    }
    for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) { const yy = y(v); g.beginPath(); g.moveTo(0, yy + 0.5); g.lineTo(W, yy + 0.5); g.stroke(); g.fillText(v, 2, yy - 2); }
    // canal sintonizado (faixa de banda)
    if (this.state) {
      const bw = this.state.bw || 12500, xc = ((this.state.vfo + span / 2) / span) * W, xw = Math.max(2, (bw / span) * W);
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(xc - xw / 2, 0, xw, H);
      g.strokeStyle = "#f33"; g.beginPath(); g.moveTo(xc + 0.5, 0); g.lineTo(xc + 0.5, H); g.stroke();
      const lvl = Math.max(0, Math.min(100, (this.levelDb(db, xc / W, xw / W) - lo) / (hi - lo) * 100));
      this.$("lvl").style.width = lvl + "%";
    }
    // traço do espectro
    g.beginPath(); g.strokeStyle = "#ffff60"; g.fillStyle = "rgba(255,255,96,0.15)";
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * W; i ? g.lineTo(x, y(db[i])) : g.moveTo(x, y(db[i])); }
    g.stroke(); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    // cascata: desloca 1 linha e pinta a nova no topo
    const wc = this.wf, wg = wc.getContext("2d"), WW = wc.width, WH = wc.height;
    wg.drawImage(wc, 0, 0, WW, WH - 1, 0, 1, WW, WH - 1);
    const row = wg.createImageData(WW, 1);
    for (let x = 0; x < WW; x++) {
      const v = db[Math.min(n - 1, Math.floor((x / WW) * n))], k = Math.max(0, Math.min(255, Math.round(((v - lo) / (hi - lo)) * 255)));
      row.data[x * 4] = LUT[k * 3]; row.data[x * 4 + 1] = LUT[k * 3 + 1]; row.data[x * 4 + 2] = LUT[k * 3 + 2]; row.data[x * 4 + 3] = 255;
    }
    wg.putImageData(row, 0, 0);
    this.opt.onSpectrum?.(db, this.center, this.rate);
  }
  levelDb(db, c, w) { const n = db.length, a = Math.max(0, Math.floor((c - w / 2) * n)), b = Math.min(n - 1, Math.ceil((c + w / 2) * n)); let m = -200; for (let i = a; i <= b; i++) m = Math.max(m, db[i]); return m; }

  // ---------- áudio ----------
  async toggleListen() {
    this.listen = !this.listen;
    if (this.listen && !this.ctx) { this.ctx = new AudioContext(); this.gainNode = this.ctx.createGain(); this.gainNode.gain.value = this.vol; this.gainNode.connect(this.ctx.destination); this.next = 0; }
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    this.send({ cmd: "audio", on: this.listen });
    this.$("listen").classList.toggle("on", this.listen); this.$("listen").textContent = this.listen ? "🔇 Parar" : "🔊 Ouvir";
  }
  playAudio(rate, pcm) {
    if (!this.listen || !this.ctx) return;
    const buf = this.ctx.createBuffer(1, pcm.length, rate), ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const now = this.ctx.currentTime;
    if (this.next < now + 0.05 || this.next > now + 0.6) this.next = now + 0.12; // re-sincroniza se atrasar/adiantar demais
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.gainNode); src.start(this.next);
    this.next += buf.duration;
  }

  // ---------- capturas ----------
  async snapshot(extraCanvas) {
    const a = this.spec, b = this.wf, c = document.createElement("canvas");
    c.width = a.width; c.height = a.height + b.height + 20;
    const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(a, 0, 0); g.drawImage(b, 0, a.height);
    g.fillStyle = "#fff"; g.font = "12px Tahoma"; g.fillText(`${fmtHz(this.tuned())} · ${new Date().toLocaleString("pt-BR")}`, 6, c.height - 6);
    return saveCanvas(extraCanvas || c, `Espectro ${(this.tuned() / 1e6).toFixed(4)} MHz`);
  }
}

/** Salva um canvas como PNG em Output/SDR/Capturas e oferece o download. */
export async function saveCanvas(canvas, name) {
  const blob = await new Promise(ok => canvas.toBlob(ok, "image/png"));
  const r = await fetch(`/api/save-image?folder=sdr&name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob });
  const j = await r.json();
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.png`; a.click();
  return j.file;
}

/** Log de texto dos decodificadores (com download .txt). */
export class SdrLog {
  constructor(root, title = "Recebido") {
    this.lines = [];
    root.innerHTML = `<fieldset><legend>${esc(title)}</legend><div class="sdr-log sunken-panel"></div>
      <div class="sdr-row" style="margin-top:4px"><button data-l="dl">⬇ Baixar log (.txt)</button><button data-l="clr">Limpar</button><span class="muted" data-l="n"></span>
      <span class="muted">· também gravado em Output\\SDR\\Logs</span></div></fieldset>`;
    this.box = root.querySelector(".sdr-log"); this.n = root.querySelector('[data-l="n"]');
    root.querySelector('[data-l="clr"]').onclick = () => { this.lines = []; this.box.innerHTML = ""; this.n.textContent = ""; };
    root.querySelector('[data-l="dl"]').onclick = () => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([this.lines.join("\n") + "\n"], { type: "text/plain" }));
      a.download = `log ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`; a.click();
    };
  }
  add(ev) {
    if (!ev.text) return;
    const t = new Date(ev.time || Date.now()).toLocaleTimeString("pt-BR"), line = `${t}  ${fmtHz(ev.freq || 0)}  ${ev.text}`;
    this.lines.push(line);
    const div = document.createElement("div"); div.innerHTML = `<span class="t">${esc(t)}</span> ${esc(ev.text)}`;
    const atBottom = this.box.scrollTop + this.box.clientHeight >= this.box.scrollHeight - 5;
    this.box.append(div); if (this.box.childElementCount > 1000) this.box.firstElementChild.remove();
    if (atBottom) this.box.scrollTop = this.box.scrollHeight;
    this.n.textContent = `${this.lines.length} linhas`;
  }
}
