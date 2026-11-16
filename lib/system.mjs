// Informações e uso do PC que roda o servidor (usado pelo Gerenciador de tarefas).
// Só usa o que já vem no sistema: módulo os do Node, netstat/tasklist/PowerShell no Windows, /proc no Linux.
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { IS_WIN } from "./paths.mjs";

const run = (cmd, args, timeout = 8000) => new Promise(resolve =>
  execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 32 << 20 }, (err, out) => resolve(err ? "" : String(out))));
const ps = script => run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], 15000);

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

// ---------- Processos (CPU% por delta de tempo de CPU) ----------
let lastProc = { t: 0, cpu: new Map() };
async function rawProcesses() {
  if (IS_WIN) {
    const out = await ps("Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64,@{n='Title';e={$_.MainWindowTitle}} | ConvertTo-Json -Compress");
    try {
      return [].concat(JSON.parse(out)).map(p => ({ pid: p.Id, name: p.ProcessName, cpuSec: p.CPU || 0, mem: p.WorkingSet64 || 0, title: p.Title || "" }));
    } catch { return []; }
  }
  const out = await run("ps", ["-eo", "pid=,times=,rss=,comm="]);
  return out.trim().split("\n").map(l => {
    const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    return m && { pid: +m[1], cpuSec: +m[2], mem: +m[3] * 1024, name: m[4], title: "" };
  }).filter(Boolean);
}

export async function processes() {
  const t = Date.now(), list = await rawProcesses(), cores = os.cpus().length;
  const dt = (t - lastProc.t) / 1000;
  const cpu = new Map();
  const result = list.map(p => {
    cpu.set(p.pid, p.cpuSec);
    const prev = lastProc.cpu.get(p.pid);
    const pct = prev != null && dt > 0 && dt < 60 ? Math.max(0, ((p.cpuSec - prev) / dt / cores) * 100) : 0;
    return { pid: p.pid, name: p.name, title: p.title, cpu: Math.round(pct * 10) / 10, mem: p.mem };
  });
  lastProc = { t, cpu };
  return result;
}

export function killProcess(pid) {
  pid = Number(pid);
  if (!Number.isInteger(pid) || pid <= 4 || pid === process.pid) throw new Error("Processo protegido.");
  process.kill(pid);
}

// ---------- Informações fixas ----------
let staticCache = null;
export async function systemInfo() {
  if (staticCache) return staticCache;
  const cpus = os.cpus();
  const nets = Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    addrs.filter(a => !a.internal).map(a => ({ name, address: a.address, family: a.family, mac: a.mac })));
  const info = {
    hostname: os.hostname(),
    user: os.userInfo().username,
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpu: cpus[0]?.model?.trim(),
    cores: cpus.length,
    speedMHz: cpus[0]?.speed,
    memory: os.totalmem(),
    node: process.version,
    networks: nets,
    gpus: [],
    osName: null,
  };
  if (IS_WIN) {
    const out = await ps("$o=Get-CimInstance Win32_OperatingSystem; $g=Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion; $b=Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product; @{os=$o.Caption+' '+$o.Version; gpus=@($g); board=$b} | ConvertTo-Json -Compress -Depth 3");
    try {
      const j = JSON.parse(out);
      info.osName = j.os;
      info.gpus = [].concat(j.gpus || []).map(g => ({ name: g.Name, vram: g.AdapterRAM, driver: g.DriverVersion }));
      if (j.board) info.board = `${j.board.Manufacturer || ""} ${j.board.Product || ""}`.trim();
    } catch {}
  } else {
    try { info.osName = fs.readFileSync("/etc/os-release", "utf8").match(/PRETTY_NAME="([^"]+)"/)?.[1]; } catch {}
  }
  return (staticCache = info);
}
