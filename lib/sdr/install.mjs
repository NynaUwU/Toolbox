// Ferramentas portáteis do RTL-SDR, baixadas sob demanda para runtime/ (nada é instalado no Windows,
// exceto o driver WinUSB que o próprio usuário instala pelo Zadig — exigência do RTL-SDR no Windows).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { RUNTIME, TMP, DATA, IS_WIN, findTool } from "../paths.mjs";
import { downloadTo, extractZip } from "../installer.mjs";

const STATE = path.join(DATA, "tools.json");
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } };
const saveState = patch => fs.writeFileSync(STATE, JSON.stringify({ ...readState(), ...patch }, null, 2));

const TOOLS = {
  rtl_tcp: { repo: "rtlsdrblog/rtl-sdr-blog", asset: /\.zip$/i, exe: /^rtl_tcp\.exe$/i, dir: "rtl-sdr", label: "RTL-SDR (rtl_tcp)", prefer: /x64/i },
  rtl_433: { repo: "merbanan/rtl_433", asset: /win.*(x64|64).*\.zip$|x64.*win.*\.zip$/i, exe: /^rtl_433.*\.exe$/i, dir: "rtl_433", label: "rtl_433", prefer: /64/ },
  satdump: { repo: "SatDump/SatDump", asset: /windows.*(x64|64).*\.zip$|win.*portable.*\.zip$/i, exe: /^satdump(_cli)?\.exe$/i, dir: "satdump", label: "SatDump", prefer: /./ },
  zadig: { repo: "pbatard/libwdi", asset: /^zadig-[\d.]+\.exe$/i, exe: null, dir: "zadig", label: "Zadig (driver WinUSB)" },
};

/** Caminho do executável, se já baixado (ou no PATH, em Linux/macOS). */
export function sdrTool(name) {
  const p = readState()[`sdr_${name}`];
  if (p && fs.existsSync(p)) return p;
  if (!IS_WIN && name !== "zadig") return findTool(name) || null;
  return null;
}

export function status() {
  return Object.fromEntries(Object.entries(TOOLS).map(([k, t]) => [k, { label: t.label, ok: Boolean(sdrTool(k)) }]));
}

function findFiles(dir, re, out = [], depth = 6) {
  if (depth < 0 || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findFiles(p, re, out, depth - 1); else if (re.test(e.name)) out.push(p);
  }
  return out;
}

export async function install(name, { log = () => {}, onProgress } = {}) {
  const t = TOOLS[name];
  if (!t) throw new Error("Ferramenta desconhecida.");
  if (!IS_WIN) throw new Error("Download automático só no Windows (no Linux use o gerenciador de pacotes).");
  log(`Procurando a versão mais recente de ${t.label}…`);
  const rel = await (await fetch(`https://api.github.com/repos/${t.repo}/releases/latest`, { headers: { "User-Agent": "toolbox-local" } })).json();
  const asset = (rel.assets || []).find(a => t.asset.test(a.name));
  if (!asset) throw new Error(`Não encontrei um pacote para Windows em ${t.repo} (${rel.tag_name || "sem versão"}).`);
  const dest = path.join(RUNTIME, t.dir);
  fs.mkdirSync(dest, { recursive: true });
  const file = path.join(name === "zadig" ? dest : TMP, asset.name);
  log(`Baixando ${asset.name}…`);
  await downloadTo(asset.browser_download_url, file, onProgress);
  if (name === "zadig") { saveState({ sdr_zadig: file }); return file; }
  log("Extraindo…");
  extractZip(file, dest); fs.rmSync(file, { force: true });
  const found = findFiles(dest, t.exe).sort((a, b) => (t.prefer.test(b) ? 1 : 0) - (t.prefer.test(a) ? 1 : 0));
  if (!found.length) throw new Error(`${t.label}: executável não encontrado no pacote.`);
  saveState({ [`sdr_${name}`]: found[0] });
  log(`✔ ${t.label} pronto`);
  return found[0];
}

/** Abre o Zadig (pede administrador). O usuário escolhe o dispositivo "Bulk-In, Interface (Interface 0)" e instala o WinUSB. */
export function openZadig() {
  const exe = sdrTool("zadig");
  if (!exe) throw new Error("Baixe o Zadig primeiro.");
  spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process -FilePath '${exe.replace(/'/g, "''")}' -Verb RunAs`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}
