// Consulta SNTP (RFC 4330) a servidores de hora públicos: mede o desvio do relógio deste PC.
import dgram from "node:dgram";

export const NTP_SERVERS = ["a.st1.ntp.br", "b.st1.ntp.br", "pool.ntp.org", "time.google.com", "time.cloudflare.com", "time.windows.com"];
const NTP_EPOCH = 2208988800; // segundos entre 1900 e 1970

const readTs = (b, o) => (b.readUInt32BE(o) - NTP_EPOCH) * 1000 + (b.readUInt32BE(o + 4) / 2 ** 32) * 1000;

export function sntp(host, timeout = 3000) {
  return new Promise(resolve => {
    const sock = dgram.createSocket("udp4"), pkt = Buffer.alloc(48);
    pkt[0] = 0x1b; // LI 0, versão 3, modo cliente
    let t1 = 0;
    const done = r => { clearTimeout(to); try { sock.close(); } catch {} resolve({ server: host, ...r }); };
    const to = setTimeout(() => done({ error: "sem resposta" }), timeout);
    sock.on("error", e => done({ error: e.code || e.message }));
    sock.on("message", msg => {
      const t4 = Date.now();
      if (msg.length < 48) return done({ error: "resposta inválida" });
      const t2 = readTs(msg, 32), t3 = readTs(msg, 40);
      done({ offset: Math.round(((t2 - t1) + (t3 - t4)) / 2), delay: Math.round((t4 - t1) - (t3 - t2)), stratum: msg[1], time: t3 });
    });
    t1 = Date.now();
    sock.send(pkt, 123, host);
  });
}

export async function checkAll() {
  const results = await Promise.all(NTP_SERVERS.map(h => sntp(h)));
  const ok = results.filter(r => r.offset != null).sort((a, b) => a.delay - b.delay);
  // desvio = mediana dos 3 servidores com menor atraso de rede
  const best = ok.slice(0, 3).map(r => r.offset).sort((a, b) => a - b);
  return { checkedAt: Date.now(), offset: best.length ? best[Math.floor(best.length / 2)] : null, results };
}
