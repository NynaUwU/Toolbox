// Decodificadores em JavaScript puro. Cada um recebe amostras e chama emit(evento).
import { crc16x25 } from "./sim.mjs";

const TAU = Math.PI * 2;

// =============== DTMF (tons de teclado telefônico) ===============
const ROWS = [697, 770, 852, 941], COLS = [1209, 1336, 1477, 1633];
const KEYS = ["123A", "456B", "789C", "*0#D"];
export class Dtmf {
  constructor(fs, emit) { this.fs = fs; this.emit = emit; this.N = Math.round(fs * 0.02); this.buf = []; this.prev = null; this.last = null; this.silent = 0; }
  goertzel(x, f) {
    const k = 2 * Math.cos(TAU * f / this.fs); let s1 = 0, s2 = 0;
    for (let i = 0; i < x.length; i++) { const s = x[i] + k * s1 - s2; s2 = s1; s1 = s; }
    return s1 * s1 + s2 * s2 - k * s1 * s2;
  }
  feed(audio) {
    for (const v of audio) {
      this.buf.push(v);
      if (this.buf.length < this.N) continue;
      const x = this.buf; this.buf = [];
      let e = 0; for (const s of x) e += s * s;
      const norm = (x.length * e) / 2 + 1e-9;
      const r = ROWS.map(f => this.goertzel(x, f) / norm), c = COLS.map(f => this.goertzel(x, f) / norm);
      const ri = r.indexOf(Math.max(...r)), ci = c.indexOf(Math.max(...c));
      const ok = r[ri] + c[ci] > 0.6 && r[ri] > 0.15 && c[ci] > 0.15 && e / x.length > 1e-4;
      const key = ok ? KEYS[ri][ci] : null;
      if (key && key === this.prev && key !== this.last) { this.last = key; this.emit({ type: "dtmf", text: `DTMF: ${key}`, digit: key }); }
      if (!key) { if (++this.silent > 2) this.last = null; } else this.silent = 0;
      this.prev = key;
    }
  }
}

// =============== AFSK 1200 / AX.25 / APRS ===============
export class Afsk1200 {
  constructor(fs, emit) {
    this.fs = fs; this.emit = emit; this.N = Math.round(fs / 1200);
    this.wm = TAU * 1200 / fs; this.ws = TAU * 2200 / fs; this.pm = 0; this.ps = 0;
    this.ring = new Float32Array(this.N * 4); this.ri = 0; this.mI = 0; this.mQ = 0; this.sI = 0; this.sQ = 0;
    this.lp = 0; this.cur = 0; this.phase = 0; this.lastSample = 0; this.step = 1200 / fs;
    this.hd = 0; this.ones = 0; this.bytes = []; this.byte = 0; this.nb = 0; this.inFrame = false;
  }
  feed(audio) {
    const N = this.N;
    for (let i = 0; i < audio.length; i++) {
      const x = audio[i];
      this.pm += this.wm; if (this.pm > TAU) this.pm -= TAU;
      this.ps += this.ws; if (this.ps > TAU) this.ps -= TAU;
      const a = x * Math.cos(this.pm), b = x * Math.sin(this.pm), c = x * Math.cos(this.ps), d = x * Math.sin(this.ps);
      const j = this.ri * 4, k = ((this.ri + N) % N);
      this.mI += a - this.ring[j]; this.mQ += b - this.ring[j + 1]; this.sI += c - this.ring[j + 2]; this.sQ += d - this.ring[j + 3];
      this.ring[j] = a; this.ring[j + 1] = b; this.ring[j + 2] = c; this.ring[j + 3] = d;
      this.ri = (this.ri + 1) % N;
      const m = this.mI * this.mI + this.mQ * this.mQ, s = this.sI * this.sI + this.sQ * this.sQ;
      this.lp += 0.5 * ((m - s) / (m + s + 1e-9) - this.lp);
      const bit = this.lp > 0 ? 1 : 0;
      if (bit !== this.cur) { this.cur = bit; this.phase += (0.5 - this.phase) * 0.6; } // transição: alinha o relógio
      this.phase += this.step;
      if (this.phase >= 1) { this.phase -= 1; this.onBit(this.cur === this.lastSample ? 1 : 0); this.lastSample = this.cur; }
    }
  }
  onBit(bit) {
    this.hd = ((this.hd >> 1) | (bit << 7)) & 0xff;
    if (this.hd === 0x7e) { // flag
      if (this.inFrame && this.nb === 7 && this.bytes.length >= 17) this.frame(this.bytes);
      this.inFrame = true; this.bytes = []; this.byte = 0; this.nb = 0; this.ones = 0; return;
    }
    if (!this.inFrame) return;
    if (bit) { if (++this.ones >= 7) { this.inFrame = false; return; } }
    else { if (this.ones === 5) { this.ones = 0; return; } this.ones = 0; } // bit de enchimento
    this.byte |= bit << this.nb;
    if (++this.nb === 8) { this.bytes.push(this.byte); this.byte = 0; this.nb = 0; if (this.bytes.length > 400) this.inFrame = false; }
  }
  frame(bytes) {
    const body = bytes.slice(0, -2), fcs = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
    if (crc16x25(body) !== fcs) return;
    const addrs = []; let i = 0;
    while (i + 7 <= body.length) {
      const call = String.fromCharCode(...body.slice(i, i + 6).map(c => c >> 1)).trim(), ssid = (body[i + 6] >> 1) & 15;
      addrs.push(ssid ? `${call}-${ssid}` : call); const last = body[i + 6] & 1; i += 7; if (last) break;
    }
    if (addrs.length < 2) return;
    const info = Buffer.from(body.slice(i + 2)).toString("latin1");
    const [dst, src, ...path] = addrs;
    this.emit({ type: "aprs", text: `${src}>${dst}${path.length ? "," + path.join(",") : ""}:${info}`, src, dst, path, info });
  }
}

// =============== OOK (controles remotos, sensores 433 MHz) ===============
export class Ook {
  constructor(fs, emit) { this.fs = fs; this.emit = emit; this.D = Math.max(1, Math.round(fs / 100000)); this.acc = 0; this.k = 0; this.noise = 0.02; this.high = false; this.run = 0; this.pulses = []; this.lastKey = ""; this.lastAt = 0; }
  feed(re, im) {
    const D = this.D, us = 1e6 / (this.fs / D);
    for (let i = 0; i < re.length; i++) {
      this.acc += Math.hypot(re[i], im[i]);
      if (++this.k < D) continue;
      const m = this.acc / D; this.acc = 0; this.k = 0;
      const thr = Math.max(this.noise * 4, 0.05);
      const on = m > thr;
      if (!on) this.noise += 0.001 * (m - this.noise);
      if (on === this.high) { this.run += us; if (!on && this.run > 15000 && this.pulses.length) this.flush(); continue; }
      if (this.high) this.pulses.push([this.run, 0]); else if (this.pulses.length) this.pulses[this.pulses.length - 1][1] = this.run;
      this.high = on; this.run = us;
    }
  }
  flush() {
    const p = this.pulses; this.pulses = [];
    if (p.length < 8) return;
    const highs = p.map(x => x[0]).sort((a, b) => a - b);
    const mid = (highs[0] + highs[highs.length - 1]) / 2;
    const short = avg(highs.filter(h => h < mid)), long = avg(highs.filter(h => h >= mid));
    const pwm = long > short * 1.8;
    // separa as repetições do mesmo botão pelas pausas longas (sincronismo) e fica com a mais comum
    const rows = []; let row = "";
    const gap = Math.max(3 * long, 2500);
    for (const [h, l] of p) {
      // pulso seguido de pausa longa = sincronismo (marca o início da próxima repetição, não é dado)
      if (l > gap) { if (row.length >= 4) rows.push(row); row = ""; continue; }
      if (pwm) row += h >= mid ? "1" : "0";
      if (l === 0) { if (row.length >= 4) rows.push(row); row = ""; }
    }
    if (row.length >= 4) rows.push(row);
    const count = {}; for (const r of rows) count[r] = (count[r] || 0) + 1;
    const bits = Object.keys(count).sort((a, b) => count[b] - count[a] || b.length - a.length)[0] || "";
    const reps = count[bits] || 0;
    const hex = bits.length >= 4 ? BigInt("0b" + bits).toString(16).toUpperCase() : "";
    const key = bits || p.length;
    const now = Date.now();
    if (key === this.lastKey && now - this.lastAt < 1500) { this.lastAt = now; return; } // repetição do mesmo botão
    this.lastKey = key; this.lastAt = now;
    this.emit({ type: "ook", text: `OOK: ${p.length} pulsos · curto ${Math.round(short)} µs · longo ${Math.round(long)} µs${bits ? ` · ${bits.length} bits · 0x${hex}${reps > 1 ? ` (×${reps})` : ""}` : ""}`,
      pulses: p.slice(0, 300).map(x => [Math.round(x[0]), Math.round(x[1])]), bits, hex });
  }
}
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// =============== ADS-B (Mode S, 1090 MHz, 2 MS/s) ===============
const CHARS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ##### ###############0123456789######";
function crcRemainder(bits) { let r = 0; for (const b of bits) { r = (r << 1) | b; if (r & 0x1000000) r ^= 0x1fff409; } return r & 0xffffff; }
const num = (bits, a, b) => { let v = 0; for (let i = a; i < b; i++) v = v * 2 + bits[i]; return v; };
function NL(lat) {
  if (lat === 0) return 59; const a = Math.abs(lat); if (a === 87) return 2; if (a > 87) return 1;
  return Math.floor(TAU / Math.acos(1 - (1 - Math.cos(Math.PI / 30)) / Math.cos(Math.PI / 180 * a) ** 2));
}
const mod = (a, b) => ((a % b) + b) % b;
export class Adsb {
  constructor(emit) { this.emit = emit; this.tail = new Float32Array(0); this.planes = new Map(); }
  feed(re, im) {
    const n = re.length, m = new Float32Array(this.tail.length + n);
    m.set(this.tail);
    for (let i = 0; i < n; i++) m[this.tail.length + i] = Math.hypot(re[i], im[i]);
    const end = m.length - 240;
    for (let i = 0; i < end; i++) {
      if (!(m[i] > m[i + 1] && m[i + 1] < m[i + 2] && m[i + 2] > m[i + 3] && m[i + 3] < m[i] && m[i + 4] < m[i] && m[i + 5] < m[i] && m[i + 6] < m[i] &&
        m[i + 7] > m[i + 8] && m[i + 8] < m[i + 9] && m[i + 9] > m[i + 6])) continue;
      const high = (m[i] + m[i + 2] + m[i + 7] + m[i + 9]) / 6;
      if (m[i + 4] >= high || m[i + 5] >= high || m[i + 11] >= high || m[i + 12] >= high || m[i + 13] >= high || m[i + 14] >= high) continue;
      const bits = new Array(112);
      for (let k = 0; k < 112; k++) bits[k] = m[i + 16 + 2 * k] > m[i + 17 + 2 * k] ? 1 : 0;
      const df = num(bits, 0, 5);
      if ((df === 17 || df === 18) && crcRemainder(bits) === 0) { this.decode(bits); i += 16 + 224; }
    }
    this.tail = m.slice(Math.max(0, m.length - 240));
  }
  plane(icao) {
    if (!this.planes.has(icao)) this.planes.set(icao, { icao, msgs: 0 });
    const p = this.planes.get(icao); p.seen = Date.now(); p.msgs++; return p;
  }
  decode(bits) {
    const icao = num(bits, 8, 32).toString(16).toUpperCase().padStart(6, "0"), tc = num(bits, 32, 37), p = this.plane(icao);
    let text = null;
    if (tc >= 1 && tc <= 4) {
      let cs = ""; for (let k = 0; k < 8; k++) cs += CHARS[num(bits, 40 + 6 * k, 46 + 6 * k)];
      p.callsign = cs.replace(/[# ]+$/, "").trim(); text = `${icao} indicativo ${p.callsign}`;
    } else if (tc >= 9 && tc <= 18) {
      const a = num(bits, 40, 52), q = (a >> 4) & 1;
      if (q) p.altitude = (((a & 0xfe0) >> 1) | (a & 0xf)) * 25 - 1000;
      const odd = bits[53], lat = num(bits, 54, 71) / 131072, lon = num(bits, 71, 88) / 131072, now = Date.now();
      p[odd ? "odd" : "even"] = { lat, lon, t: now };
      if (p.odd && p.even && Math.abs(p.odd.t - p.even.t) < 10000) {
        const j = Math.floor(59 * p.even.lat - 60 * p.odd.lat + 0.5);
        let latE = 6 * (mod(j, 60) + p.even.lat), latO = (360 / 59) * (mod(j, 59) + p.odd.lat);
        if (latE >= 270) latE -= 360; if (latO >= 270) latO -= 360;
        if (NL(latE) === NL(latO)) {
          const useOdd = p.odd.t > p.even.t, la = useOdd ? latO : latE;
          const nl = NL(la), ni = Math.max(useOdd ? nl - 1 : nl, 1);
          const mm = Math.floor(p.even.lon * (nl - 1) - p.odd.lon * nl + 0.5);
          let lo = (360 / ni) * (mod(mm, ni) + (useOdd ? p.odd.lon : p.even.lon));
          if (lo > 180) lo -= 360;
          p.lat = +la.toFixed(5); p.lon = +lo.toFixed(5);
          text = `${icao}${p.callsign ? " " + p.callsign : ""} posição ${p.lat}, ${p.lon} · ${p.altitude ?? "?"} pés`;
        }
      }
    } else if (tc === 19) {
      const st = num(bits, 37, 40);
      if (st === 1 || st === 2) {
        const ewS = bits[45], ew = num(bits, 46, 56) - 1, nsS = bits[56], ns = num(bits, 57, 67) - 1;
        const vx = ewS ? -ew : ew, vy = nsS ? -ns : ns;
        p.speed = Math.round(Math.hypot(vx, vy)); p.heading = Math.round(mod(Math.atan2(vx, vy) * 180 / Math.PI, 360));
        const vr = (num(bits, 69, 78) - 1) * 64; p.vrate = bits[68] ? -vr : vr;
        text = `${icao} velocidade ${p.speed} nós · rumo ${p.heading}° · ${p.vrate} pés/min`;
      }
    }
    for (const [k, v] of this.planes) if (Date.now() - v.seen > 120000) this.planes.delete(k);
    if (text) this.emit({ type: "adsb", text, plane: p });
  }
  list() { return [...this.planes.values()].map(({ odd, even, ...p }) => p); }
}

// =============== TV analógica (525/625 linhas, P&B) ===============
export class Tv {
  constructor(fs, emit, { lines = 525, W = 240 } = {}) {
    this.fs = fs; this.emit = emit; this.W = W;
    this.lineHz = lines === 625 ? 15625 : 15734.26; this.fieldLines = lines === 625 ? 312 : 262;
    this.L = fs / this.lineHz; this.H = this.fieldLines - 20;
    this.pos = 0; this.line = 0; this.peak = 0.1; this.prev = 0; this.syncCount = 0; this.sinceV = 0; this.miss = 0;
    this.lineBuf = new Float32Array(Math.ceil(this.L) + 4); this.frame = new Uint8Array(W * this.H); this.fields = 0;
  }
  feed(env) { // envelope (|z|) já com a portadora no centro
    const L = this.L;
    for (let i = 0; i < env.length; i++) {
      const v0 = env[i];
      this.peak = v0 > this.peak ? v0 : this.peak * 0.99999;
      const v = v0 / (this.peak + 1e-9);
      const p = this.pos | 0;
      if (p < this.lineBuf.length) this.lineBuf[p] = v;
      if (v > 0.88) this.syncCount++;
      // borda de subida do sincronismo horizontal: corrige a fase da linha
      if (v > 0.88 && this.prev <= 0.88) {
        const err = this.pos < L / 2 ? this.pos : this.pos - L;
        if (Math.abs(err) < L * 0.08) { this.pos -= err * 0.25; this.miss = 0; }  // travado: correção fina
        else if (++this.miss > 8) { this.pos = 0; this.miss = 0; }               // aquisição: realinha na borda do sincronismo
      }
      this.prev = v;
      if (++this.pos >= L) { this.pos -= L; this.endLine(); }
    }
  }
  endLine() {
    const L = this.L;
    this.sinceV++;
    if (this.syncCount > L * 0.5 && this.sinceV > this.fieldLines - 20) { this.sinceV = 0; this.line = 0; this.endField(); } // sincronismo vertical
    this.syncCount = 0;
    const row = this.line - 20;
    if (row >= 0 && row < this.H) {
      const a = 10.9e-6 * this.fs, b = L - 1.5e-6 * this.fs, W = this.W;
      for (let x = 0; x < W; x++) {
        const s = a + (b - a) * x / W, k = s | 0, f = s - k;
        const v = this.lineBuf[k] * (1 - f) + this.lineBuf[k + 1] * f;
        this.frame[row * W + x] = Math.max(0, Math.min(255, ((0.70 - v) / 0.575) * 255));
      }
    }
    if (++this.line > this.fieldLines + 40) { this.line = 0; this.endField(); }
  }
  endField() { if (++this.fields % 2 === 0) this.emit({ type: "tvframe", w: this.W, h: this.H, pixels: Uint8Array.from(this.frame) }); }
}

// =============== Pulsos de hora (WWV, WWVH, CHU, BPM…) ===============
export class Ticks {
  constructor(fs, emit, tone = 1000) { this.fs = fs; this.emit = emit; this.tone = tone; this.N = Math.round(fs / 1000); this.buf = []; this.hist = new Float32Array(1000); this.blocks = 0; }
  feed(audio, tEnd) { // tEnd = horário (ms) da última amostra
    const k = 2 * Math.cos(TAU * this.tone / this.fs);
    for (let i = 0; i < audio.length; i++) {
      this.buf.push(audio[i]);
      if (this.buf.length < this.N) continue;
      let s1 = 0, s2 = 0; for (const x of this.buf) { const s = x + k * s1 - s2; s2 = s1; s1 = s; }
      const pw = s1 * s1 + s2 * s2 - k * s1 * s2; this.buf = [];
      const t = tEnd - ((audio.length - i) / this.fs) * 1000, ms = Math.floor(((t % 1000) + 1000) % 1000);
      for (let j = 0; j < 1000; j++) this.hist[j] *= 0.99995;
      this.hist[ms] += pw;
      if (++this.blocks % 1000 === 0) {
        let best = 0; for (let j = 1; j < 1000; j++) if (this.hist[j] > this.hist[best]) best = j;
        const mean = this.hist.reduce((a, b) => a + b, 0) / 1000;
        const offset = best > 500 ? best - 1000 : best;
        this.emit({ type: "ticks", text: `Pulso de segundo a ${offset >= 0 ? "+" : ""}${offset} ms do relógio do servidor (confiança ${Math.min(99, Math.round(this.hist[best] / (mean + 1e-12)))}×)`,
          offset, confidence: this.hist[best] / (mean + 1e-12), profile: Array.from(this.hist.filter((_, j) => j % 10 === 0)) });
      }
    }
  }
}
