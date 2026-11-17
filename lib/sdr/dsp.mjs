// Processamento de sinais em JavaScript puro: FFT, filtros FIR com decimação, NCO (mistura de
// frequência) e demoduladores (FM, AM, SSB). Tudo em Float32 para caber em tempo real.

/** FFT complexa radix-2 in-place (n potência de 2). */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

export const hann = n => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));

/** Coeficientes passa-baixa (sinc janelado Blackman), ganho DC = 1. */
export function lowpass(numTaps, cutoff, fs) {
  const t = new Float32Array(numTaps), m = numTaps - 1, fc = cutoff / fs;
  let sum = 0;
  for (let i = 0; i < numTaps; i++) {
    const x = i - m / 2;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / m) + 0.08 * Math.cos(4 * Math.PI * i / m);
    t[i] = sinc * w; sum += t[i];
  }
  for (let i = 0; i < numTaps; i++) t[i] /= sum;
  return t;
}

/** FIR com decimação (calcula só as amostras de saída necessárias). Real ou complexo. */
export class FirDecim {
  constructor(taps, D, complex = true) {
    this.t = taps; this.D = D; this.complex = complex; this.phase = 0;
    this.hr = new Float32Array(taps.length - 1); this.hi = complex ? new Float32Array(taps.length - 1) : null;
  }
  process(re, im) {
    const t = this.t, L = t.length, H = L - 1, n = re.length, D = this.D;
    const xr = new Float32Array(H + n); xr.set(this.hr); xr.set(re, H);
    let xi = null;
    if (this.complex) { xi = new Float32Array(H + n); xi.set(this.hi); xi.set(im, H); }
    const count = this.phase < n ? Math.floor((n - 1 - this.phase) / D) + 1 : 0;
    const or = new Float32Array(count), oi = this.complex ? new Float32Array(count) : null;
    let k = this.phase;
    for (let m = 0; m < count; m++, k += D) {
      let sr = 0, si = 0;
      if (this.complex) for (let j = 0; j < L; j++) { const c = t[j]; sr += c * xr[k + j]; si += c * xi[k + j]; }
      else for (let j = 0; j < L; j++) sr += t[j] * xr[k + j];
      or[m] = sr; if (oi) oi[m] = si;
    }
    this.phase = k - n;
    this.hr = xr.slice(n); if (this.complex) this.hi = xi.slice(n);
    return { re: or, im: oi };
  }
}

/** Oscilador para deslocar a frequência (multiplica por e^{-j2πft}). */
export class Nco {
  constructor(freq, fs) { this.set(freq, fs); this.c = 1; this.s = 0; this.n = 0; }
  set(freq, fs) { const w = -2 * Math.PI * freq / fs; this.wc = Math.cos(w); this.ws = Math.sin(w); this.freq = freq; }
  mix(re, im) {
    if (this.freq === 0) return;
    let c = this.c, s = this.s;
    const wc = this.wc, ws = this.ws;
    for (let i = 0; i < re.length; i++) {
      const r = re[i], q = im[i];
      re[i] = r * c - q * s; im[i] = r * s + q * c;
      const nc = c * wc - s * ws; s = c * ws + s * wc; c = nc;
    }
    const mag = Math.hypot(c, s); this.c = c / mag; this.s = s / mag; // evita deriva numérica
  }
}

/** Demodulador FM (discriminador de fase). Saída normalizada: ±1 = ±desvio informado. */
export class FmDemod {
  constructor(fs, deviation) { this.k = fs / (2 * Math.PI * deviation); this.pr = 1; this.pi = 0; }
  process(re, im) {
    const out = new Float32Array(re.length);
    let pr = this.pr, pi = this.pi;
    for (let i = 0; i < re.length; i++) {
      const r = re[i], q = im[i];
      out[i] = Math.atan2(q * pr - r * pi, r * pr + q * pi) * this.k;
      pr = r; pi = q;
    }
    this.pr = pr; this.pi = pi;
    return out;
  }
}

/** Filtro de de-ênfase (rádio FM: 75 µs nas Américas, 50 µs na Europa). */
export class Deemph {
  constructor(fs, tau = 75e-6) { this.a = 1 - Math.exp(-1 / (fs * tau)); this.y = 0; }
  process(x) { let y = this.y; const a = this.a; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } this.y = y; return x; }
}

/** Remove o nível DC (passa-alta de 1 polo). */
export class DcBlock {
  constructor(r = 0.995) { this.r = r; this.x1 = 0; this.y1 = 0; }
  process(x) { let x1 = this.x1, y1 = this.y1; const r = this.r; for (let i = 0; i < x.length; i++) { const y = x[i] - x1 + r * y1; x1 = x[i]; y1 = y; x[i] = y; } this.x1 = x1; this.y1 = y1; return x; }
}

/** Controle automático de ganho simples (para AM/SSB). */
export class Agc {
  constructor(target = 0.3, attack = 0.01, release = 0.0005) { this.g = 1; this.t = target; this.a = attack; this.r = release; this.env = 1e-3; }
  process(x) {
    let env = this.env;
    for (let i = 0; i < x.length; i++) {
      const v = Math.abs(x[i]);
      env += (v > env ? this.a : this.r) * (v - env);
      x[i] = Math.max(-1, Math.min(1, x[i] * this.t / Math.max(env, 1e-4)));
    }
    this.env = env; return x;
  }
}

/** Potência média (dBFS) de um bloco complexo. */
export function powerDb(re, im) {
  let s = 0; for (let i = 0; i < re.length; i++) s += re[i] * re[i] + im[i] * im[i];
  return 10 * Math.log10(s / Math.max(1, re.length) + 1e-12);
}
