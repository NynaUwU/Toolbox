// Canal de recepção: isola uma estação dentro da faixa capturada e demodula.
//   faixa (até 2,4 MS/s) --NCO(offset)--> estágio 1 (≈256 kS/s) --> estágio 2 (≈48 kS/s) --> demodulador --> áudio
import { lowpass, FirDecim, Nco, FmDemod, Deemph, DcBlock, Agc, powerDb } from "./dsp.mjs";

export const MODES = {
  wfm: { label: "FM largo (rádio comercial)", bw: 180000 },
  nfm: { label: "FM estreito (rádio comunicação)", bw: 12500 },
  am: { label: "AM (aviação, ondas médias)", bw: 9000 },
  usb: { label: "USB (banda lateral superior)", bw: 2800 },
  lsb: { label: "LSB (banda lateral inferior)", bw: 2800 },
  iq: { label: "IQ bruto (sem áudio)", bw: 150000 },
};

export class Channel {
  constructor(rate) { this.rate = rate; this.configure({}); }

  configure({ offset = 0, mode = "nfm", bw, squelch = null } = {}) {
    const R = this.rate;
    this.mode = MODES[mode] ? mode : "nfm";
    this.bw = Math.max(500, Math.min(220000, bw || MODES[this.mode].bw));
    this.squelch = squelch;
    this.offset = offset;
    this.nco = new Nco(offset, R);
    const D1 = Math.max(1, Math.round(R / 256000));
    this.if1 = R / D1;
    const cut1 = this.mode === "wfm" || this.mode === "iq" ? Math.min(0.45 * this.if1, Math.max(60000, this.bw / 2)) : Math.min(0.4 * this.if1, 60000);
    this.st1 = new FirDecim(lowpass(96, cut1, R), D1, true);
    const D2 = 5;
    this.audioRate = this.if1 / D2;
    if (this.mode === "wfm") {
      this.fm = new FmDemod(this.if1, 75000);
      this.st2 = new FirDecim(lowpass(64, 15000, this.if1), D2, false);
      this.de = new Deemph(this.audioRate, 75e-6);
    } else if (this.mode !== "iq") {
      const ssb = this.mode === "usb" || this.mode === "lsb";
      this.st2 = new FirDecim(lowpass(64, ssb ? this.bw / 2 : this.bw / 2, this.if1), D2, true);
      // SSB: desloca meia banda antes do filtro e volta depois (método de Weaver)
      this.ssbPre = ssb ? new Nco(this.mode === "usb" ? this.bw / 2 : -this.bw / 2, this.if1) : null;
      this.ssbPost = ssb ? new Nco(this.mode === "usb" ? -this.bw / 2 : this.bw / 2, this.audioRate) : null;
      this.fm = this.mode === "nfm" ? new FmDemod(this.audioRate, Math.max(1500, this.bw / 2.5)) : null;
      this.dc = new DcBlock(0.998);
      this.agc = this.mode === "nfm" ? null : new Agc(0.35);
    }
    this.level = -120;
  }

  /** Recebe IQ da faixa inteira; devolve { audio, iq1 } (iq1 = sinal do canal a ~256 kS/s). */
  process(re, im) {
    // re/im podem ser reaproveitados pelo chamador: trabalha em cópias
    const r = Float32Array.from(re), q = Float32Array.from(im);
    this.nco.mix(r, q);
    const iq1 = this.st1.process(r, q);
    if (this.mode === "iq") { this.level = powerDb(iq1.re, iq1.im); return { audio: null, iq1 }; }
    let audio;
    if (this.mode === "wfm") {
      this.level = powerDb(iq1.re, iq1.im);
      audio = this.de.process(this.st2.process(this.fm.process(iq1.re, iq1.im)).re);
      for (let i = 0; i < audio.length; i++) audio[i] *= 0.7;
    } else {
      if (this.ssbPre) this.ssbPre.mix(iq1.re, iq1.im);
      const c = this.st2.process(iq1.re, iq1.im);
      this.level = powerDb(c.re, c.im);
      if (this.mode === "nfm") audio = this.dc.process(this.fm.process(c.re, c.im)).map(v => v * 0.5);
      else if (this.mode === "am") {
        audio = new Float32Array(c.re.length);
        for (let i = 0; i < audio.length; i++) audio[i] = Math.hypot(c.re[i], c.im[i]);
        this.agc.process(this.dc.process(audio));
      } else {
        this.ssbPost.mix(c.re, c.im);
        audio = this.agc.process(this.dc.process(Float32Array.from(c.re)));
      }
    }
    if (this.squelch != null && this.level < this.squelch) audio.fill(0);
    return { audio, iq1 };
  }
}
