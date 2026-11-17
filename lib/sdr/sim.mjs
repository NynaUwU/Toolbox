// Simulador de RTL-SDR: servidor no protocolo rtl_tcp com sinais sintéticos realistas.
// Usado no "modo demonstração" (sem dongle) e nos testes. Sinais:
//   98,5 e 100,1 MHz FM comercial · 118,1 MHz AM aviação · 145,825 MHz APRS (AFSK 1200)
//   146,52 MHz DTMF · 433,92 MHz controle remoto (EV1527) · 1090 MHz ADS-B · 137,9 MHz satélite (LRPT)
//   55,25 MHz TV analógica (PAL-M, P&B) · 10 MHz WWV (pulsos de 1 s)
import net from "node:net";

const TAU = Math.PI * 2;
const SIN = new Float32Array(4096).map((_, i) => Math.sin(TAU * i / 4096));
const sinp = p => SIN[((p / TAU * 4096) | 0) & 4095];           // seno por tabela (p em radianos, ≥0)
const cosp = p => SIN[((p / TAU * 4096 + 1024) | 0) & 4095];
const GAUSS = new Float32Array(1 << 16).map(() => { let s = 0; for (let i = 0; i < 6; i++) s += Math.random(); return (s - 3) / Math.SQRT2; });

// ---------- Geradores de modulação (também usados nos testes) ----------
export function crc16x25(bytes) {
  let crc = 0xffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1; }
  return ~crc & 0xffff;
}
function ax25Addr(call, ssid, last) {
  const c = call.toUpperCase().padEnd(6, " ").slice(0, 6);
  return [...[...c].map(ch => ch.charCodeAt(0) << 1), 0x60 | ((ssid & 15) << 1) | (last ? 1 : 0)];
}
/** Pacote APRS como áudio AFSK 1200 (Bell 202) a `fs` Hz. */
export function afskPacket(src, dst, path, info, fs = 48000) {
  const addrs = [ax25Addr(dst[0], dst[1], false), ax25Addr(src[0], src[1], !path.length), ...path.map((p, i) => ax25Addr(p[0], p[1], i === path.length - 1))].flat();
  const frame = [...addrs, 0x03, 0xf0, ...Buffer.from(info, "latin1")];
  const fcs = crc16x25(frame);
  const bytes = [...frame, fcs & 0xff, fcs >> 8];
  const bits = [];
  const flag = () => { for (let i = 0; i < 8; i++) bits.push((0x7e >> i) & 1); };
  for (let i = 0; i < 40; i++) flag();
  let ones = 0;
  for (const b of bytes) for (let i = 0; i < 8; i++) {
    const bit = (b >> i) & 1; bits.push(bit);
    if (bit) { if (++ones === 5) { bits.push(0); ones = 0; } } else ones = 0;
  }
  for (let i = 0; i < 4; i++) flag();
  const spb = fs / 1200, out = new Float32Array(Math.ceil(bits.length * spb));
  let tone = 1200, ph = 0, idx = 0;
  bits.forEach((bit, k) => {
    if (!bit) tone = tone === 1200 ? 2200 : 1200; // NRZI: 0 = troca de tom
    const end = Math.round((k + 1) * spb);
    for (; idx < end; idx++) { ph += TAU * tone / fs; out[idx] = Math.sin(ph) * 0.8; }
  });
  return out;
}
const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], A: [697, 1633], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], B: [770, 1633],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477], C: [852, 1633], "*": [941, 1209], 0: [941, 1336], "#": [941, 1477], D: [941, 1633] };
export function dtmfAudio(digits, fs = 48000, on = 0.1, off = 0.1) {
  const per = Math.round((on + off) * fs), out = new Float32Array(per * digits.length);
  [...digits].forEach((d, k) => {
    const [a, b] = DTMF[d];
    for (let i = 0; i < on * fs; i++) out[k * per + i] = 0.4 * (Math.sin(TAU * a * i / fs) + Math.sin(TAU * b * i / fs));
  });
  return out;
}
/** Mensagem Mode S (hex) como pulsos a 2 MS/s (preâmbulo + PPM). */
export function adsbPulses(hex) {
  const pre = [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0];
  const bits = [...hex].flatMap(h => parseInt(h, 16).toString(2).padStart(4, "0").split("").map(Number));
  return Uint8Array.from([...pre, ...bits.flatMap(b => (b ? [1, 0] : [0, 1]))]);
}
/** Controle EV1527 (24 bits): pulsos com resolução de 10 µs. */
export function ev1527(code, T = 350, repeats = 5) {
  const seq = [];
  const add = (hi, lo) => { seq.push(...Array(Math.round(hi / 10)).fill(1), ...Array(Math.round(lo / 10)).fill(0)); };
  for (let r = 0; r < repeats; r++) {
    add(T, 31 * T);
    for (let i = 23; i >= 0; i--) (code >> i) & 1 ? add(3 * T, T) : add(T, 3 * T);
  }
  return Uint8Array.from(seq);
}
export const ADSB_SAMPLES = ["8D4840D6202CC371C32CE0576098", "8D40621D58C382D690C8AC2863A7", "8D40621D58C386435CC412692AD6", "8D485020994409940838175B284F"];

// ---------- Sinais do simulador ----------
function station(freq, kind, extra = {}) { return { freq, kind, ph: 0, ...extra }; }
function makeSignals() {
  const aprs = afskPacket(["PY2TBX", 9], ["APRS", 0], [["WIDE1", 1]], "!2330.00S/04630.00W>Toolbox - modo demonstracao");
  return [
    station(100.1e6, "wfm", { amp: 0.45, notes: [262, 330, 392, 523, 392, 330] }),
    station(98.5e6, "wfm", { amp: 0.3, notes: [220, 277, 330, 440, 330, 277] }),
    station(118.1e6, "am", { amp: 0.35 }),
    station(145.825e6, "nfmbuf", { amp: 0.4, buf: aprs, period: 8, dev: 3000 }),
    station(146.52e6, "nfmbuf", { amp: 0.4, buf: dtmfAudio("2024#"), period: 6, dev: 3000 }),
    station(433.92e6, "ook", { amp: 0.5, buf: ev1527(0xa5c3f0), period: 3 }),
    station(1090e6, "adsb", { amp: 0.6, frames: ADSB_SAMPLES.map(adsbPulses), period: 0.25 }),
    station(137.9e6, "lrpt", { amp: 0.06, sym: 0, phase: 0 }),
    station(55.25e6, "tv", { amp: 0.5 }),
    station(10e6, "wwv", { amp: 0.4 }),
  ];
}

/** Áudio "música": notas que mudam a cada 0,4 s. */
const melody = (s, t) => { const n = s.notes[Math.floor(t / 0.4) % s.notes.length]; return 0.5 * Math.sin(TAU * n * t) + 0.2 * Math.sin(TAU * n * 2 * t); };

// Vídeo PAL-M/NTSC (525 linhas, 15734 Hz) — modulação negativa: sincronismo = portadora máxima
const LINE = 1 / 15734.26;
function tvLevel(t) {
  const lineIdx = Math.floor(t / LINE), tl = t - lineIdx * LINE, line = lineIdx % 262; // campo de 262 linhas
  if (line < 9) return line >= 3 && line < 6 ? (tl < LINE - 4.7e-6 ? 1 : 0.75) : (tl < 2.3e-6 ? 1 : 0.75);
  if (tl < 4.7e-6) return 1;                           // sincronismo horizontal
  if (tl < 10.9e-6 || tl > LINE - 1.5e-6) return 0.75;  // apagamento
  const x = (tl - 10.9e-6) / (LINE - 12.4e-6), y = (line - 20) / 242;
  if (y < 0) return 0.75;
  let lum;
  if (y < 0.62) lum = [1, 0.89, 0.7, 0.59, 0.41, 0.3, 0.11, 0][Math.min(7, Math.floor(x * 8))]; // barras
  else {
    const bx = 0.5 + 0.35 * Math.sin(t * 1.3), by = 0.8 + 0.1 * Math.cos(t * 2.1);
    lum = (x - bx) ** 2 * 4 + ((y - by) * 2) ** 2 * 4 < 0.02 ? 1 : 0.15 + 0.1 * Math.floor(x * 10) % 2;
  }
  return 0.7 - lum * 0.575; // branco = 12,5% da portadora
}

export function startSimulator(port = 1235) {
  const signals = makeSignals();
  const server = net.createServer(sock => {
    let freq = 100.1e6, rate = 2048000, gain = 1, n0 = 0, timer = null;
    const hdr = Buffer.alloc(12); hdr.write("RTL0"); hdr.writeUInt32BE(5, 4); hdr.writeUInt32BE(29, 8); sock.write(hdr);
    let cmdBuf = Buffer.alloc(0);
    sock.on("data", d => {
      cmdBuf = Buffer.concat([cmdBuf, d]);
      while (cmdBuf.length >= 5) {
        const c = cmdBuf[0], v = cmdBuf.readUInt32BE(1); cmdBuf = cmdBuf.subarray(5);
        if (c === 1) freq = v; else if (c === 2) rate = v; else if (c === 4) gain = Math.pow(10, (v / 10 - 30) / 40);
      }
    });
    // o relógio das amostras acompanha o relógio real (como o cristal de um dongle de verdade)
    let tStart = Date.now() / 1000, lastRate = rate;
    const tick = () => {
      if (rate !== lastRate) { tStart = Date.now() / 1000 - n0 / rate; lastRate = rate; }
      const due = Math.round((Date.now() / 1000 - tStart) * rate) - n0;
      const n = Math.max(0, Math.min(due, Math.round(rate * 0.2)));
      if (due > rate) n0 += due - n; // muito atrasado (PC ocupado): pula em vez de acumular
      if (!n) return;
      const re = new Float32Array(n), im = new Float32Array(n);
      let gi = (Math.random() * 65536) | 0;
      for (let i = 0; i < n; i++) { re[i] = GAUSS[gi++ & 65535] * 0.02; im[i] = GAUSS[gi++ & 65535] * 0.02; }
      for (const s of signals) {
        const f0 = s.freq - freq;
        if (Math.abs(f0) > rate / 2 + 100e3) continue;
        const w0 = TAU * f0 / rate;
        for (let i = 0; i < n; i++) {
          const t = (n0 + i) / rate, abs = tStart + t;
          let a = s.amp, dph = w0;
          switch (s.kind) {
            case "wfm": dph += TAU * 75000 * melody(s, t) / rate; break;
            case "am": { const env = (Math.floor(t / 1.5) % 2) ? 0.1 : 1; a *= 1 + 0.8 * env * Math.sin(TAU * (500 + 200 * Math.sin(TAU * 3 * t)) * t); break; }
            case "nfmbuf": { const k = Math.floor((t % s.period) * 48000); dph += TAU * s.dev * (k < s.buf.length ? s.buf[k] : 0) / rate; break; }
            case "ook": { const k = Math.floor((t % s.period) * 1e5); a *= k < s.buf.length ? s.buf[k] : 0; break; }
            case "adsb": { // contagem inteira de amostras: cada pulso dura exatamente 0,5 µs
              const g = n0 + i, ps = Math.round(s.period * rate), fi = Math.floor(g / ps), k = Math.floor(((g % ps) * 2e6) / rate);
              const fr = s.frames[fi % s.frames.length]; a *= k < fr.length ? fr[k] : 0; break; }
            case "lrpt": { const sym = Math.floor(t * 72000); if (sym !== s.sym) { s.sym = sym; s.phase = (Math.random() * 4 | 0) * Math.PI / 2 + Math.PI / 4; } s.ph += 0; dph = w0; s.ph2 = s.phase; break; }
            case "tv": a *= tvLevel(t); break;
            case "wwv": { const ms = (abs % 1) * 1000; a *= ms < 5 ? 1 + 0.9 * Math.sin(TAU * 1000 * abs) : 0.6; break; }
          }
          s.ph += dph; if (s.ph > 1e6) s.ph %= TAU; if (s.ph < 0) s.ph = (s.ph % TAU) + TAU;
          const p = s.kind === "lrpt" ? s.ph + s.ph2 : s.ph;
          re[i] += a * cosp(p); im[i] += a * sinp(p);
        }
      }
      n0 += n;
      const out = Buffer.allocUnsafe(n * 2);
      for (let i = 0; i < n; i++) {
        out[2 * i] = Math.max(0, Math.min(255, Math.round(127.5 + 127 * re[i] * gain)));
        out[2 * i + 1] = Math.max(0, Math.min(255, Math.round(127.5 + 127 * im[i] * gain)));
      }
      if (!sock.destroyed && sock.writableLength < 8e6) sock.write(out);
    };
    timer = setInterval(tick, 25);
    sock.on("close", () => clearInterval(timer));
    sock.on("error", () => clearInterval(timer));
  });
  return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve(server)); });
}
