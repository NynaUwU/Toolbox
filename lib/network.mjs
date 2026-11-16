// Descobre os aparelhos da rede local: tentativa TCP curta em cada IP da faixa (isso faz o
// Windows resolver o MAC via ARP) e leitura de "arp -a". Nada é instalado.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import netSock from "node:net";
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
      nets.push({ name, address: a.address, netmask: a.netmask, mac: a.mac, virtual, cidr: maskBits(a.netmask) });
    }
  }
  return nets.sort((a, b) => a.virtual - b.virtual);
}


// ---------- Endereços ----------
const ipToInt = ip => ip.split(".").reduce((a, b) => a * 256 + +b, 0);
const intToIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join(".");
const maskBits = mask => mask.split(".").reduce((a, o) => a + (+o).toString(2).split("").filter(b => b === "1").length, 0);
export const MIN_BITS = 16; // maior faixa permitida: /16 (65.534 endereços)

/** Faixa de hosts para a interface: bits = "auto" (pela máscara) ou 16..30. */
export function rangeFor(net, bits = "auto") {
  let b = bits === "auto" ? net.cidr : parseInt(bits, 10);
  b = Math.min(30, Math.max(MIN_BITS, b || 24));
  const size = 2 ** (32 - b);
  const base = Math.floor(ipToInt(net.address) / size) * size;
  return { bits: b, first: base + 1, last: base + size - 2, count: size - 2, label: `${intToIp(base)}/${b}` };
}

/** Executa fn em paralelo com no máximo `limit` ao mesmo tempo. */
async function pool(items, limit, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}

/** Tentativa TCP curta: se o aparelho existe, o Windows resolve o MAC (ARP) — mesmo que a porta esteja fechada/filtrada. */
function probe(ip, timeout) {
  return new Promise(resolve => {
    const sock = netSock.connect({ host: ip, port: 80 });
    const done = alive => { sock.destroy(); resolve(alive); };
    sock.setTimeout(timeout, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", e => done(e.code === "ECONNREFUSED" || e.code === "ECONNRESET"));
  });
}


const normMac = m => m.toLowerCase().replace(/-/g, ":");

async function arpTable() {
  const table = new Map();
  if (IS_WIN) {
    for (const l of (await run("arp", ["-a"])).split(/\r?\n/)) {
      const m = l.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/i);
      if (m && !/^(ff-ff|00-00-00-00-00-00|01-00-5e)/i.test(m[2])) table.set(m[1], normMac(m[2]));
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

/** Varre a sub-rede da interface (pela máscara, até /16). onProgress(0..100, texto). */
export async function scan({ address, bits = "auto", onProgress } = {}) {
  const nets = localNetworks();
  const net = nets.find(n => n.address === address) || nets[0];
  if (!net) throw new Error("Nenhuma rede IPv4 encontrada.");
  const range = rangeFor(net, bits);
  await ensureOui();
  const gw = await gateway();
  const inRange = ip => { const n = ipToInt(ip); return n >= range.first && n <= range.last; };

  // 1) Sondagem TCP em todos os IPs da faixa (preenche a tabela ARP)
  const ips = Array.from({ length: range.count }, (_, k) => intToIp(range.first + k));
  const big = range.count > 1024;
  const alive = new Set();
  const arpSeen = new Map();
  const harvest = async () => { for (const [ip, mac] of await arpTable()) if (inRange(ip)) arpSeen.set(ip, mac); };
  const timer = setInterval(harvest, 4000); // lê o ARP durante a varredura (entradas expiram)
  let done = 0;
  try {
    await pool(ips, big ? 512 : 128, async ip => {
      if (await probe(ip, big ? 450 : 700)) alive.add(ip);
      if (++done % 64 === 0 || done === ips.length) onProgress?.(Math.round(done / ips.length * 85), `Sondando ${done.toLocaleString("pt-BR")} de ${ips.length.toLocaleString("pt-BR")} endereços…`);
    });
    await new Promise(r => setTimeout(r, 1500)); // respostas ARP atrasadas
    await harvest();
  } finally { clearInterval(timer); }

  // 2) Aparelhos encontrados = responderam à sondagem OU apareceram na tabela ARP
  // Resposta TCP só vale para IPs na sub-rede real da interface (fora dela quem responde é o roteador)
  const block = 2 ** (32 - net.cidr), myBlock = Math.floor(ipToInt(net.address) / block);
  const onLink = ip => Math.floor(ipToInt(ip) / block) === myBlock;
  const found = new Set([...arpSeen.keys(), ...[...alive].filter(onLink), net.address]);

  // 3) Nomes (DNS reverso / NetBIOS)
  onProgress?.(90, `Identificando ${found.size} aparelhos…`);
  const devices = [];
  await pool([...found], 24, async ip => {
    const self = ip === net.address;
    const mac = self ? net.mac : arpSeen.get(ip) || null;
    devices.push({
      ip, mac,
      vendor: vendor(mac),
      hostname: self ? os.hostname() : await hostname(ip),
      self,
      gateway: ip === gw,
    });
  });
  onProgress?.(100, "Concluído");
  return { network: net, range: range.label, scanned: range.count, gateway: gw,
    devices: devices.sort((a, b) => ipToInt(a.ip) - ipToInt(b.ip)), scannedAt: Date.now() };
}
