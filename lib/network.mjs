// Lista os aparelhos da rede local: "ping" em todos os IPs da sub-rede (/24) para
// preencher a tabela ARP, depois lê "arp -a". Só usa comandos que já vêm no Windows.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import { IS_WIN, DATA } from "./paths.mjs";
import { downloadTo } from "./installer.mjs";

const run = (cmd, args, timeout = 5000) => new Promise(resolve =>
  execFile(cmd, args, { windowsHide: true, timeout }, (err, out) => resolve(String(out || ""))));

/** Interfaces IPv4 locais (sem loopback/virtuais óbvias). */
export function localNetworks() {
  const nets = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|br-|veth|Loopback|Tailscale|ZeroTier/i.test(name);
      nets.push({ name, address: a.address, netmask: a.netmask, mac: a.mac, virtual, prefix: a.address.split(".").slice(0, 3).join(".") });
    }
  }
  return nets.sort((a, b) => a.virtual - b.virtual);
}

async function ping(ip) {
  const args = IS_WIN ? ["-n", "1", "-w", "600", ip] : ["-c", "1", "-W", "1", ip];
  const out = await run("ping", args, 3000);
  const ms = out.match(/(?:tempo|time)[=<]\s*([\d.,]+)\s*ms/i);
  return /TTL=/i.test(out) ? (ms ? parseFloat(ms[1].replace(",", ".")) : 0) : null;
}

const normMac = m => m.toLowerCase().replace(/-/g, ":");

async function arpTable() {
  const table = new Map();
  if (IS_WIN) {
    for (const l of (await run("arp", ["-a"])).split(/\r?\n/)) {
      const m = l.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/i);
      if (m && !m[2].startsWith("ff-ff") && !/^01-00-5e/i.test(m[2])) table.set(m[1], normMac(m[2]));
    }
  } else {
    try {
      for (const l of fs.readFileSync("/proc/net/arp", "utf8").split("\n").slice(1)) {
        const f = l.trim().split(/\s+/);
        if (f[3] && f[3] !== "00:00:00:00:00:00") table.set(f[0], f[3].toLowerCase());
      }
    } catch {}
  }
  return table;
}

async function gateway() {
  if (IS_WIN) {
    const out = await run("route", ["print", "-4", "0.0.0.0"]);
    return out.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/m)?.[1] || null;
  }
  try {
    for (const l of fs.readFileSync("/proc/net/route", "utf8").split("\n").slice(1)) {
      const f = l.trim().split(/\s+/);
      if (f[1] === "00000000" && f[2]) return f[2].match(/../g).reverse().map(h => parseInt(h, 16)).join(".");
    }
  } catch {}
  return null;
}

async function hostname(ip) {
  try {
    const names = await Promise.race([dns.reverse(ip), new Promise((_, j) => setTimeout(() => j(), 1500))]);
    if (names?.[0]) return names[0];
  } catch {}
  if (IS_WIN) {
    // NetBIOS (computadores Windows na rede)
    const out = await run("nbtstat", ["-A", ip], 3000);
    const m = out.match(/^\s*([^\s<]+)\s*<00>\s+(?:UNIQUE|ÚNICO|EXCLUSIVO)/im);
    if (m) return m[1];
  }
  return null;
}

// ---------- Fabricante pelo MAC (base do Wireshark, baixada uma vez) ----------
const OUI_FILE = path.join(DATA, "manuf.txt");
let oui = null;
function loadOui() {
  if (oui) return oui;
  oui = new Map();
  try {
    for (const l of fs.readFileSync(OUI_FILE, "utf8").split("\n")) {
      if (!l || l[0] === "#") continue;
      const [prefix, short, long] = l.split("\t");
      if (prefix && prefix.length === 8) oui.set(prefix.toLowerCase(), (long || short || "").trim());
    }
  } catch {}
  return oui;
}
export async function ensureOui() {
  if (fs.existsSync(OUI_FILE) && Date.now() - fs.statSync(OUI_FILE).mtimeMs < 90 * 864e5) return;
  try { await downloadTo("https://www.wireshark.org/download/automated/data/manuf", OUI_FILE); oui = null; } catch {}
}
function vendor(mac) {
  if (!mac) return null;
  // bit "localmente administrado": MAC aleatório (celulares com privacidade de Wi-Fi)
  if (parseInt(mac.slice(0, 2), 16) & 2) return "MAC aleatório (privacidade de Wi-Fi ou virtual)";
  return loadOui().get(mac.slice(0, 8)) || null;
}

/** Varre a sub-rede /24 da interface escolhida. onProgress(0..100). */
export async function scan({ prefix, onProgress } = {}) {
  const nets = localNetworks();
  const net = nets.find(n => n.prefix === prefix) || nets[0];
  if (!net) throw new Error("Nenhuma rede IPv4 encontrada.");
  await ensureOui();
  const gw = await gateway();
  const ips = Array.from({ length: 254 }, (_, i) => `${net.prefix}.${i + 1}`);
  const latency = new Map();
  let done = 0;
  const queue = [...ips];
  await Promise.all(Array.from({ length: 48 }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      const ms = await ping(ip);
      if (ms != null) latency.set(ip, ms);
      onProgress?.(Math.round((++done / ips.length) * 90));
    }
  }));
  const arp = await arpTable();
  // Responderam ao ping OU estão na tabela ARP (aparelhos que bloqueiam ping, ex.: alguns celulares/Windows)
  const found = new Set([...latency.keys(), ...[...arp.keys()].filter(ip => ip.startsWith(net.prefix + "."))]);
  found.add(net.address);
  const devices = await Promise.all([...found].map(async ip => {
    const self = ip === net.address;
    const mac = self ? net.mac : arp.get(ip) || null;
    return {
      ip, mac,
      vendor: vendor(mac),
      hostname: self ? os.hostname() : await hostname(ip),
      latency: self ? 0 : latency.get(ip) ?? null,
      self,
      gateway: ip === gw,
    };
  }));
  onProgress?.(100);
  const n = ip => ip.split(".").reduce((a, b) => a * 256 + +b, 0);
  return { network: net, gateway: gw, devices: devices.sort((a, b) => n(a.ip) - n(b.ip)), scannedAt: Date.now() };
}
