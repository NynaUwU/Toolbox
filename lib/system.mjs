// Consumo de hardware do PC que roda a Toolbox (Monitor de desempenho): CPU, memória, rede e discos.
// Só leitura, com o que já vem no sistema: módulo os do Node, netstat no Windows, /proc no Linux.
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { IS_WIN } from "./paths.mjs";

const run = (cmd, args, timeout = 8000) => new Promise(resolve =>
  execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 32 << 20 }, (err, out) => resolve(err ? "" : String(out))));

// ---------- CPU (delta entre leituras) ----------
let lastCpu = os.cpus().map(c => c.times);
function cpuUsage() {
  const now = os.cpus().map(c => c.times);
  const per = now.map((t, i) => {
    const p = lastCpu[i] || t;
    const idle = t.idle - p.idle;
    const total = Object.keys(t).reduce((s, k) => s + (t[k] - p[k]), 0);
    return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : 0;
  });
  lastCpu = now;
  return { total: Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 10) / 10, perCore: per };
}

// ---------- Rede (bytes totais -> velocidade) ----------
async function netTotals() {
  if (IS_WIN) {
    // "netstat -e": linha "Bytes   <recebidos>   <enviados>"
    const out = await run("netstat", ["-e"]);
    const line = out.split(/\r?\n/).find(l => /^\s*Bytes\s+\d/i.test(l)) || "";
    const [rx, tx] = (line.match(/\d+/g) || []).map(Number);
    return { rx: rx || 0, tx: tx || 0 };
  }
  try {
    let rx = 0, tx = 0;
    for (const l of fs.readFileSync("/proc/net/dev", "utf8").split("\n").slice(2)) {
      const [name, data] = l.split(":");
      if (!data || name.trim() === "lo") continue;
      const f = data.trim().split(/\s+/).map(Number);
      rx += f[0]; tx += f[8];
    }
    return { rx, tx };
  } catch { return { rx: 0, tx: 0 }; }
}
let lastNet = null;
async function netSpeed() {
  const t = Date.now(), n = await netTotals();
  let speed = { rx: 0, tx: 0 };
  if (lastNet && t > lastNet.t) {
    const dt = (t - lastNet.t) / 1000;
    speed = { rx: Math.max(0, (n.rx - lastNet.rx) / dt), tx: Math.max(0, (n.tx - lastNet.tx) / dt) };
  }
  lastNet = { ...n, t };
  return { ...speed, totalRx: n.rx, totalTx: n.tx };
}

// ---------- Discos ----------
function disks() {
  const roots = IS_WIN
    ? "CDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => `${l}:\\`).filter(p => { try { fs.accessSync(p); return true; } catch { return false; } })
    : ["/", ...["/home", "/mnt", "/media"].filter(p => fs.existsSync(p))];
  const seen = new Set();
  return roots.map(p => {
    try {
      const s = fs.statfsSync(p);
      const total = s.blocks * s.bsize, free = s.bavail * s.bsize;
      const key = `${total}-${free}`;
      if (!total || seen.has(key)) return null;
      seen.add(key);
      return { mount: p, total, free, used: total - free };
    } catch { return null; }
  }).filter(Boolean);
}

/** Leitura rápida (a cada ~1,5 s). */
export async function performance() {
  const total = os.totalmem(), free = os.freemem();
  return {
    time: Date.now(),
    cpu: cpuUsage(),
    memory: { total, free, used: total - free },
    net: await netSpeed(),
    disks: disks(),
    uptime: os.uptime(),
    load: IS_WIN ? null : os.loadavg(),
  };
}
