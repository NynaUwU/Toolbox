// Baixa ferramentas portáteis para dentro da pasta da Toolbox.
// Nada é instalado no Windows: sem winget, sem registro, sem admin.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { BIN, TMP, DATA, RUNTIME, IS_WIN, findTool } from "./paths.mjs";

const UA = { "User-Agent": "toolbox-local" };

/** Download com progresso (onProgress recebe 0..100 ou null). */
export async function downloadTo(url, dest, onProgress) {
  const res = await fetch(url, { redirect: "follow", headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const out = fs.createWriteStream(dest);
  let done = 0;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await new Promise(r => out.once("drain", r));
    done += chunk.length;
    onProgress?.(total ? Math.floor((done / total) * 100) : null, done);
  }
  await new Promise((r, j) => out.end(err => (err ? j(err) : r())));
}

/** Extrai um .zip usando o que já vem no sistema (tar.exe no Windows 10+, unzip no Linux). */
export function extractZip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (IS_WIN) execFileSync("tar", ["-xf", zip, "-C", dest], { windowsHide: true });
  else execFileSync("unzip", ["-q", "-o", zip, "-d", dest]);
}

function findFile(dir, name, depth = 6) {
  if (depth < 0 || !fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return p;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { const r = findFile(path.join(dir, e.name), name, depth - 1); if (r) return r; }
  }
  return null;
}

const readState = () => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "tools.json"), "utf8")); } catch { return {}; } };
const saveState = patch => fs.writeFileSync(path.join(DATA, "tools.json"), JSON.stringify({ ...readState(), ...patch }, null, 2));

// ---------- yt-dlp ----------
export async function ensureYtDlp({ log = console.log, onProgress } = {}) {
  const exe = path.join(BIN, IS_WIN ? "yt-dlp.exe" : "yt-dlp");
  const st = readState();
  if (fs.existsSync(exe)) {
    if (Date.now() - (st.ytdlpChecked || 0) > 24 * 3600e3) {
      log("Verificando atualização do yt-dlp…");
      spawnSync(exe, ["-U"], { stdio: "ignore", timeout: 120000, windowsHide: true });
      saveState({ ytdlpChecked: Date.now() });
    }
    return log("✔ yt-dlp ok");
  }
  if (!IS_WIN && findTool("yt-dlp")) return log("✔ yt-dlp (sistema)");
  const asset = IS_WIN ? "yt-dlp.exe" : process.platform === "darwin" ? "yt-dlp_macos" : "yt-dlp";
  log("Baixando yt-dlp…");
  await downloadTo(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, exe, onProgress);
  if (!IS_WIN) fs.chmodSync(exe, 0o755);
  saveState({ ytdlpChecked: Date.now() });
  log("✔ yt-dlp baixado");
}

// ---------- ffmpeg ----------
export async function ensureFfmpeg({ log = console.log, onProgress } = {}) {
  if (findTool("ffmpeg") && findTool("ffprobe")) return log("✔ ffmpeg ok");
  if (!IS_WIN) return log("✖ ffmpeg não encontrado (no Linux/mac use o gerenciador de pacotes).");
  const zip = path.join(TMP, "ffmpeg.zip"), dir = path.join(TMP, "ffmpeg");
  log("Baixando ffmpeg (~150 MB, só na primeira vez)…");
  await downloadTo("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", zip, onProgress);
  log("Extraindo ffmpeg…");
  fs.rmSync(dir, { recursive: true, force: true });
  extractZip(zip, dir);
  for (const f of ["ffmpeg.exe", "ffprobe.exe"]) {
    const src = findFile(dir, f);
    if (!src) throw new Error(`${f} não encontrado no zip.`);
    fs.copyFileSync(src, path.join(BIN, f));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  log("✔ ffmpeg baixado");
}

// ---------- LibreOffice portátil (opcional, sob demanda) ----------
// Baixa o .msi oficial e EXTRAI o conteúdo com o lessmsi (portátil) — não executa instalador.
async function latestLibreOffice() {
  const html = await (await fetch("https://download.documentfoundation.org/libreoffice/stable/", { headers: UA })).text();
  const versions = [...html.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)].map(m => m[1]);
  if (!versions.length) throw new Error("Não foi possível descobrir a versão do LibreOffice.");
  const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  return versions.sort(cmp).at(-1);
}

async function ensureLessmsi(log, onProgress) {
  const exe = findFile(path.join(RUNTIME, "lessmsi"), "lessmsi.exe", 2);
  if (exe) return exe;
  const rel = await (await fetch("https://api.github.com/repos/activescott/lessmsi/releases/latest", { headers: UA })).json();
  const asset = rel.assets?.find(a => /^lessmsi-v[\d.]+\.zip$/i.test(a.name));
  if (!asset) throw new Error("Não encontrei o lessmsi para download.");
  log("Baixando extrator (lessmsi)…");
  const zip = path.join(TMP, "lessmsi.zip");
  await downloadTo(asset.browser_download_url, zip, onProgress);
  extractZip(zip, path.join(RUNTIME, "lessmsi"));
  fs.rmSync(zip, { force: true });
  return findFile(path.join(RUNTIME, "lessmsi"), "lessmsi.exe", 2);
}

export async function installLibreOfficePortable({ log = console.log, onProgress } = {}) {
  if (!IS_WIN) throw new Error("LibreOffice portátil automático é só para Windows.");
  const existing = findTool("soffice");
  if (existing) { log("✔ LibreOffice já disponível"); return existing; }
  const lessmsi = await ensureLessmsi(log, onProgress);
  const v = await latestLibreOffice();
  const msi = path.join(TMP, `LibreOffice_${v}.msi`);
  log(`Baixando LibreOffice ${v} (~350 MB)…`);
  await downloadTo(`https://download.documentfoundation.org/libreoffice/stable/${v}/win/x86_64/LibreOffice_${v}_Win_x86-64.msi`, msi, onProgress);
  const dest = path.join(RUNTIME, "libreoffice");
  fs.rmSync(dest, { recursive: true, force: true });
  log("Extraindo LibreOffice (pode levar alguns minutos)…");
  onProgress?.(null);
  // lessmsi exige a pasta de destino terminando com barra
  execFileSync(lessmsi, ["x", msi, dest + path.sep], { windowsHide: true, maxBuffer: 1 << 28 });
  fs.rmSync(msi, { force: true });
  const soffice = findFile(dest, "soffice.exe", 8);
  if (!soffice) throw new Error("soffice.exe não encontrado após a extração.");
  saveState({ soffice });
  log("✔ LibreOffice portátil pronto");
  return soffice;
}
