// Hub do RTL-SDR: uma única fonte (o dongle é um só) compartilhada por todas as ferramentas e navegadores.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { RtlTcp } from "./rtltcp.mjs";
import { startSimulator } from "./sim.mjs";
import { fft, hann, Nco } from "./dsp.mjs";
import { Channel, MODES } from "./channel.mjs";
import { Dtmf, Afsk1200, Ook, Adsb, Tv, Ticks } from "./decoders.mjs";
import { sdrTool } from "./install.mjs";
import { readConfig, writeConfig, outDir, uniquePath } from "../paths.mjs";

const U8 = Float32Array.from({ length: 256 }, (_, i) => (i - 127.5) / 127.5);
const FFT_N = 2048, BINS = 1024;
const WIN = hann(FFT_N);
const DEFAULTS = { freq: 100.1e6, rate: 2048000, gain: "auto", ppm: 0, vfo: 0, mode: "wfm", bw: null, squelch: null, decoders: [], directSampling: 0, biasTee: false, tvLines: 525, tool: "" };
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const fmtF = hz => (hz >= 1e6 ? (hz / 1e6).toFixed(4).replace(/\.?0+$/, "") + " MHz" : (hz / 1e3).toFixed(1) + " kHz");

class Hub {
  constructor() {
    this.clients = new Set();
    this.state = { ...DEFAULTS, ...(readConfig().sdr || {}) };
    this.device = { status: "parado", source: null, tuner: null, error: null };
    this.rec = {}; // { audio, iq, baseband } -> { file, stream, bytes, started }
    this.rtl = null; this.proc = null; this.sim = null; this.idleTimer = null;
    this.specRe = new Float32Array(FFT_N * 4); this.specIm = new Float32Array(FFT_N * 4); this.specPos = 0; this.specCount = 0;
    this.rebuild();
  }

  // ---------- clientes (WebSocket) ----------
  attach(ws, req) {
    ws.wants = { audio: false };
    this.clients.add(ws);
    clearTimeout(this.idleTimer);
    this.ensureSource();
    this.sendState(ws);
    ws.on("message", (data, isBinary) => { if (!isBinary) { try { this.command(ws, JSON.parse(data)); } catch (e) { this.send(ws, { type: "error", text: e.message }); } } });
    ws.on("close", () => { this.clients.delete(ws); this.broadcastState(); this.maybeIdle(); });
  }
  send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  broadcast(obj) { const s = JSON.stringify(obj); for (const ws of this.clients) if (ws.readyState === 1) ws.send(s); }
  sendBinary(buf, filter) { for (const ws of this.clients) if (ws.readyState === 1 && (!filter || filter(ws)) && ws.bufferedAmount < 2e6) ws.send(buf); }
  publicState() {
    return { type: "state", state: this.state, device: this.device, clients: this.clients.size, modes: MODES,
      audioRate: this.channel?.audioRate, rec: Object.fromEntries(Object.entries(this.rec).map(([k, r]) => [k, { file: r.rel, bytes: r.bytes, started: r.started }])) };
  }
  sendState(ws) { this.send(ws, this.publicState()); }
  broadcastState() { this.broadcast(this.publicState()); }

  command(ws, m) {
    switch (m.cmd) {
      case "tune": this.tune(m); break;
      case "audio": ws.wants.audio = !!m.on; this.rebuildNeeds(); break;
      case "record": m.on ? this.startRec(m.kind, m.name) : this.stopRec(m.kind); break;
      case "planes": this.send(ws, { type: "planes", list: this.adsb?.list() || [] }); break;
    }
  }

  /** Aplica mudanças de sintonia (parciais). */
  tune(m) {
    const s = this.state, before = { ...s };
    for (const k of ["freq", "rate", "gain", "ppm", "vfo", "mode", "bw", "squelch", "decoders", "directSampling", "biasTee", "tvLines", "tool"]) if (k in m) s[k] = m[k];
    s.freq = Math.max(24e3, Math.min(1.766e9, +s.freq));
    s.rate = [250000, 1024000, 1536000, 2000000, 2048000, 2400000].includes(+s.rate) ? +s.rate : 2048000;
    s.vfo = Math.max(-s.rate / 2, Math.min(s.rate / 2, +s.vfo || 0));
    if (this.rtl) {
      if (s.rate !== before.rate) this.rtl.setRate(s.rate);
      if (s.freq !== before.freq) this.rtl.setFreq(s.freq);
      if (s.gain !== before.gain) this.applyGain();
      if (s.ppm !== before.ppm) this.rtl.setPpm(s.ppm);
      if (s.directSampling !== before.directSampling) this.rtl.setDirectSampling(s.directSampling);
      if (s.biasTee !== before.biasTee) this.rtl.setBiasTee(s.biasTee);
    }
    const structural = ["rate", "mode", "bw", "vfo", "squelch", "decoders", "tvLines"].some(k => JSON.stringify(s[k]) !== JSON.stringify(before[k]));
    if (structural) this.rebuild();
    writeConfig({ sdr: { ...s } });
    this.broadcastState();
  }
  applyGain() { const g = this.state.gain; if (g === "auto") { this.rtl.setGainManual(false); this.rtl.setAgc(true); } else { this.rtl.setAgc(false); this.rtl.setGainManual(true); this.rtl.setGain(+g); } }

  // ---------- cadeia de processamento ----------
  rebuild() {
    const s = this.state, emit = ev => this.onEvent(ev);
    this.channel = new Channel(s.rate);
    this.channel.configure({ offset: s.vfo, mode: s.mode, bw: s.bw, squelch: s.squelch });
    const ar = this.channel.audioRate, d = new Set(s.decoders || []);
    this.dec = {
      dtmf: d.has("dtmf") ? new Dtmf(ar, emit) : null,
      afsk: d.has("aprs") ? new Afsk1200(ar, emit) : null,
      ticks: d.has("ticks") ? new Ticks(ar, emit, 1000) : null,
      ook: d.has("ook") ? new Ook(s.rate, emit) : null,
    };
    this.adsb = d.has("adsb") ? (this.adsb || new Adsb(emit)) : null;
    this.tv = d.has("tv") ? new Tv(s.rate, emit, { lines: s.tvLines }) : null;
    this.tvNco = d.has("tv") ? new Nco(s.vfo, s.rate) : null;
    this.setRtl433(d.has("rtl433"));
    this.rebuildNeeds();
  }
  rebuildNeeds() {
    const audioDec = this.dec && (this.dec.dtmf || this.dec.afsk || this.dec.ticks);
    this.needChannel = this.state.mode !== "iq"
      ? [...this.clients].some(ws => ws.wants.audio) || audioDec || this.rec.audio
      : Boolean(this.rec.baseband);
  }

  onIq(buf) {
    const n = buf.length >> 1, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 0; i < n; i++) { re[i] = U8[buf[2 * i]]; im[i] = U8[buf[2 * i + 1]]; }
    if (this.r433?.stdin.writable && this.r433.stdin.writableLength < 4e6) this.r433.stdin.write(buf);
    if (this.rec.iq) this.writeRec("iq", buf);
    this.spectrum(re, im);
    if (this.needChannel) {
      const { audio, iq1 } = this.channel.process(re, im);
      if (audio) {
        const pcm = new Int16Array(audio.length);
        for (let i = 0; i < audio.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, audio[i] * 32767));
        if (this.clients.size) {
          const out = Buffer.alloc(8 + pcm.byteLength); out[0] = 2; out.writeFloatLE(this.channel.audioRate, 4); Buffer.from(pcm.buffer).copy(out, 8);
          this.sendBinary(out, ws => ws.wants.audio);
        }
        if (this.rec.audio) this.writeRec("audio", Buffer.from(pcm.buffer));
        this.dec.dtmf?.feed(audio); this.dec.afsk?.feed(audio); this.dec.ticks?.feed(audio, Date.now());
      }
      if (this.rec.baseband && iq1) { // banda base (satélites): IQ 16 bits com sinal
        const b = new Int16Array(iq1.re.length * 2);
        for (let i = 0; i < iq1.re.length; i++) { b[2 * i] = Math.max(-32767, Math.min(32767, iq1.re[i] * 32767)); b[2 * i + 1] = Math.max(-32767, Math.min(32767, iq1.im[i] * 32767)); }
        this.writeRec("baseband", Buffer.from(b.buffer));
      }
    }
    this.dec.ook?.feed(re, im);
    if (this.adsb && this.state.rate === 2000000) this.adsb.feed(re, im);
    if (this.tv) {
      const r = Float32Array.from(re), q = Float32Array.from(im); this.tvNco.mix(r, q);
      const env = new Float32Array(n); for (let i = 0; i < n; i++) env[i] = Math.hypot(r[i], q[i]);
      this.tv.feed(env);
    }
  }

  spectrum(re, im) {
    const N4 = FFT_N * 4;
    for (let i = 0; i < re.length; i++) { this.specRe[this.specPos] = re[i]; this.specIm[this.specPos] = im[i]; this.specPos = (this.specPos + 1) % N4; }
    this.specCount += re.length;
    if (this.specCount < this.state.rate / 20 || !this.clients.size) return; // ~20 quadros/s
    this.specCount = 0;
    const acc = new Float32Array(FFT_N);
    for (let k = 0; k < 4; k++) {
      const r = new Float32Array(FFT_N), q = new Float32Array(FFT_N);
      for (let i = 0; i < FFT_N; i++) { const j = (this.specPos + k * FFT_N + i) % N4; r[i] = this.specRe[j] * WIN[i]; q[i] = this.specIm[j] * WIN[i]; }
      fft(r, q);
      for (let i = 0; i < FFT_N; i++) acc[i] += r[i] * r[i] + q[i] * q[i];
    }
    const out = Buffer.alloc(24 + BINS * 4); out[0] = 1; out.writeDoubleLE(this.state.freq, 8); out.writeDoubleLE(this.state.rate, 16);
    const norm = 4 * (FFT_N * 0.5) ** 2;
    for (let b = 0; b < BINS; b++) {
      let m = 0;
      for (let k = 0; k < 2; k++) { const i = (b * 2 + k + FFT_N / 2) % FFT_N; if (acc[i] > m) m = acc[i]; } // fftshift + máximo
      out.writeFloatLE(10 * Math.log10(m / norm + 1e-14), 24 + b * 4);
    }
    this.sendBinary(out);
    this.level = this.channel.level;
  }

  // ---------- eventos dos decodificadores ----------
  onEvent(ev) {
    if (ev.type === "tvframe") {
      const out = Buffer.alloc(8 + ev.pixels.length); out[0] = 3; out.writeUInt16LE(ev.w, 2); out.writeUInt16LE(ev.h, 4); Buffer.from(ev.pixels).copy(out, 8);
      return this.sendBinary(out);
    }
    ev.time = new Date().toISOString(); ev.freq = this.state.freq + this.state.vfo;
    if (ev.text) {
      const dir = outDir(path.join("SDR", "Logs"));
      fs.appendFile(path.join(dir, `${ev.type}-${ev.time.slice(0, 10)}.log`), `${ev.time}  ${fmtF(ev.freq)}  ${ev.text}\n`, () => {});
    }
    this.broadcast({ type: "event", ev: { ...ev, pulses: ev.pulses, profile: ev.profile } });
    if (ev.type === "adsb" && Date.now() - (this.lastPlanes || 0) > 1500) { this.lastPlanes = Date.now(); this.broadcast({ type: "planes", list: this.adsb.list() }); }
  }

  // ---------- rtl_433 (externo, opcional) ----------
  setRtl433(on) {
    if (!on) { if (this.r433) { this.r433.kill(); this.r433 = null; } return; }
    if (this.r433) return;
    const exe = sdrTool("rtl_433");
    if (!exe) { this.onEvent({ type: "info", text: "rtl_433 não instalado — usando só o analisador de pulsos." }); return; }
    const p = spawn(exe, ["-r", "cu8:-", "-s", String(this.state.rate), "-F", "json", "-M", "level", "-M", "protocol"], { windowsHide: true });
    let buf = "";
    p.stdout.on("data", d => {
      buf += d; let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        try {
          const j = JSON.parse(line);
          const fields = Object.entries(j).filter(([k]) => !["time", "model", "mod", "freq", "rssi", "snr", "noise", "protocol"].includes(k)).map(([k, v]) => `${k}=${v}`).join(" ");
          this.onEvent({ type: "rtl433", text: `${j.model || "?"}: ${fields}`, data: j });
        } catch {}
      }
    });
    p.stdin.on("error", () => {});
    p.on("exit", () => { if (this.r433 === p) this.r433 = null; });
    this.r433 = p;
  }

  // ---------- gravações ----------
  startRec(kind, name) {
    if (this.rec[kind]) return;
    const s = this.state, f = s.freq + s.vfo, base = `${name || fmtF(f).replace(" ", "")} ${stamp()}`;
    let file, header = null;
    if (kind === "audio") { file = uniquePath(outDir("Rádio"), base, "wav"); header = Buffer.alloc(44); }
    else if (kind === "iq") file = uniquePath(outDir(path.join("SDR", "IQ")), `${Math.round(s.freq)}Hz ${s.rate}sps ${stamp()}`, "cu8");
    else if (kind === "baseband") file = uniquePath(outDir(path.join("Satélites", "Gravações")), `${base} ${Math.round(this.channel.if1)}sps`, "cs16");
    else return;
    const stream = fs.createWriteStream(file);
    if (header) stream.write(header);
    this.rec[kind] = { file, rel: path.relative(path.dirname(path.dirname(file)), file), stream, bytes: 0, started: Date.now(), rate: this.channel.audioRate };
    this.rebuildNeeds(); this.broadcastState();
    return file;
  }
  writeRec(kind, buf) { const r = this.rec[kind]; if (!r) return; r.stream.write(buf); r.bytes += buf.length; }
  stopRec(kind) {
    const r = this.rec[kind]; if (!r) return null;
    delete this.rec[kind];
    return new Promise(resolve => r.stream.end(() => {
      if (kind === "audio") { // completa o cabeçalho WAV (PCM 16 bits mono)
        const h = Buffer.alloc(44), rate = Math.round(r.rate);
        h.write("RIFF", 0); h.writeUInt32LE(36 + r.bytes, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
        h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(r.bytes, 40);
        const fd = fs.openSync(r.file, "r+"); fs.writeSync(fd, h, 0, 44, 0); fs.closeSync(fd);
      }
      this.onEvent({ type: "rec", text: `Gravação salva: ${r.file}`, file: r.file });
      this.rebuildNeeds(); this.broadcastState(); resolve(r.file);
    }));
  }

  // ---------- fonte (dongle, simulador ou rtl_tcp externo) ----------
  setStatus(status, extra = {}) { Object.assign(this.device, { status, ...extra }); this.broadcastState(); }
  async ensureSource() {
    if (this.rtl || this.starting) return;
    this.starting = true;
    try {
      let host = "127.0.0.1", port = 1234, source;
      const ext = process.env.TOOLBOX_RTL_TCP;
      if (ext) { [host, port] = ext.split(":"); port = +port || 1234; source = `rtl_tcp externo (${ext})`; }
      else if (readConfig().sdrDemo) {
        if (!this.sim) this.sim = await startSimulator(1235);
        port = 1235; source = "demonstração (simulador)";
      } else {
        const exe = sdrTool("rtl_tcp");
        if (!exe) { this.setStatus("sem-ferramentas", { error: "Ferramentas RTL-SDR não baixadas.", source: null }); return; }
        this.setStatus("iniciando", { error: null, source: "RTL-SDR" });
        const err = await this.spawnRtlTcp(exe);
        if (err) { this.setStatus("erro", { error: err }); return; }
        source = "RTL-SDR";
      }
      const rtl = new RtlTcp(host, port);
      let header;
      for (let i = 0; i < 4 && !header; i++) { try { header = await rtl.connect(); } catch (e) { if (i === 3) throw e; await new Promise(r => setTimeout(r, 700)); } }
      this.rtl = rtl;
      rtl.on("iq", b => { try { this.onIq(b); } catch (e) { console.error("SDR:", e); } });
      rtl.on("close", () => { if (this.rtl === rtl) { this.rtl = null; this.setStatus("desconectado"); if (this.clients.size) setTimeout(() => this.ensureSource(), 3000); } });
      const s = this.state;
      rtl.setRate(s.rate); rtl.setFreq(s.freq); rtl.setPpm(s.ppm); this.applyGain(); rtl.setDirectSampling(s.directSampling); rtl.setBiasTee(s.biasTee);
      this.setStatus("conectado", { source, tuner: header.tuner, error: null });
    } catch (e) {
      this.setStatus("erro", { error: e.message });
    } finally { this.starting = false; }
  }
  spawnRtlTcp(exe) {
    return new Promise(resolve => {
      const p = spawn(exe, ["-a", "127.0.0.1", "-p", "1234", "-s", String(this.state.rate), "-f", String(Math.round(this.state.freq))], { cwd: path.dirname(exe), windowsHide: true });
      let out = "", done = false;
      const finish = err => { if (!done) { done = true; resolve(err); } };
      const onData = d => {
        out += d;
        if (/listening/i.test(out)) finish(null);
        if (/No supported devices|No matching devices/i.test(out)) finish("Nenhum RTL-SDR encontrado. Confira se o dongle está conectado.");
        if (/usb_(open|claim_interface) error|LIBUSB_ERROR|access denied/i.test(out)) finish("O Windows não liberou o dongle: instale o driver WinUSB com o Zadig (veja as instruções) ou feche outro programa que esteja usando o RTL-SDR.");
      };
      p.stdout.on("data", onData); p.stderr.on("data", onData);
      p.on("exit", code => { if (this.proc === p) this.proc = null; finish(`rtl_tcp encerrou (código ${code}). ${out.split(/\r?\n/).filter(Boolean).slice(-2).join(" ")}`); });
      p.on("error", e => finish(e.message));
      this.proc = p;
      setTimeout(() => finish(null), 6000);
    });
  }
  maybeIdle() {
    clearTimeout(this.idleTimer);
    if (this.clients.size || Object.keys(this.rec).length || this.keepAlive) return;
    this.idleTimer = setTimeout(() => this.stopSource(), 30000); // libera o dongle 30 s depois que todos saem
  }
  stopSource() {
    this.rtl?.close(); this.rtl = null;
    if (this.proc) { this.proc.kill(); this.proc = null; }
    this.setStatus("parado");
  }
  restartSource() { this.stopSource(); if (this.sim && !readConfig().sdrDemo) { this.sim.close(); this.sim = null; } this.ensureSource(); }
}

export const hub = new Hub();
