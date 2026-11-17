// Cliente do protocolo rtl_tcp (o mesmo usado por SDR#, GQRX etc.).
// Cabeçalho de 12 bytes ("RTL0", tipo do sintonizador, nº de ganhos), depois amostras IQ uint8 sem fim.
import net from "node:net";
import { EventEmitter } from "node:events";

export const TUNERS = ["desconhecido", "E4000", "FC0012", "FC0013", "FC2580", "R820T/R820T2", "R828D"];

export class RtlTcp extends EventEmitter {
  constructor(host, port) { super(); this.host = host; this.port = port; this.sock = null; this.header = null; this.left = null; }

  connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host: this.host, port: this.port });
      const to = setTimeout(() => { s.destroy(); reject(new Error("rtl_tcp não respondeu.")); }, timeout);
      let pending = Buffer.alloc(0);
      s.setNoDelay(true);
      s.on("data", chunk => {
        if (!this.header) {
          pending = Buffer.concat([pending, chunk]);
          if (pending.length < 12) return;
          if (pending.toString("ascii", 0, 4) !== "RTL0") { s.destroy(); clearTimeout(to); return reject(new Error("Resposta inválida do rtl_tcp.")); }
          this.header = { tuner: TUNERS[pending.readUInt32BE(4)] || `tipo ${pending.readUInt32BE(4)}`, gains: pending.readUInt32BE(8) };
          clearTimeout(to); resolve(this.header);
          chunk = pending.subarray(12);
          if (!chunk.length) return;
        }
        // IQ vem em pares; guarda um byte solto para o próximo pacote
        if (this.left) { chunk = Buffer.concat([this.left, chunk]); this.left = null; }
        if (chunk.length & 1) { this.left = chunk.subarray(chunk.length - 1); chunk = chunk.subarray(0, chunk.length - 1); }
        if (chunk.length) this.emit("iq", chunk);
      });
      s.on("error", err => { clearTimeout(to); if (!this.header) reject(err); this.emit("close", err); });
      s.on("close", () => this.emit("close"));
      this.sock = s;
    });
  }

  cmd(code, value) {
    if (!this.sock || this.sock.destroyed) return;
    const b = Buffer.alloc(5); b[0] = code; b.writeUInt32BE(value >>> 0, 1); this.sock.write(b);
  }
  setFreq(hz) { this.cmd(0x01, Math.round(hz)); }
  setRate(sps) { this.cmd(0x02, Math.round(sps)); }
  setGainManual(manual) { this.cmd(0x03, manual ? 1 : 0); }
  setGain(db) { this.cmd(0x04, Math.round(db * 10)); }   // décimos de dB
  setPpm(ppm) { this.cmd(0x05, ppm | 0); }
  setAgc(on) { this.cmd(0x08, on ? 1 : 0); }
  setDirectSampling(mode) { this.cmd(0x09, mode | 0); } // 0 desligado, 1 I, 2 Q (RTL-SDR V3: HF no ramo Q)
  setBiasTee(on) { this.cmd(0x0e, on ? 1 : 0); }
  close() { this.sock?.destroy(); }
}
