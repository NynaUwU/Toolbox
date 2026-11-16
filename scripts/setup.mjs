// Baixa/atualiza as ferramentas externas usadas pela Toolbox:
//   - yt-dlp   (download do YouTube)       -> bin/
//   - ffmpeg   (conversão de áudio/vídeo)  -> bin/
//   - LibreOffice (Word <-> PDF etc.)     -> instalado via winget (opcional)
//
// Uso:  node scripts/setup.mjs            (interativo)
//       node scripts/setup.mjs --auto     (usado pelo Toolbox.bat: silencioso, só o necessário)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { BIN, TMP, DATA, IS_WIN, findTool } from "../lib/paths.mjs";

const AUTO = process.argv.includes("--auto");
const STATE = path.join(DATA, "setup-state.json");
const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } })();
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
const DAY = 24 * 60 * 60 * 1000;

const log = (...a) => console.log("  ", ...a);

async function downloadTo(url, dest) {
  log(`Baixando ${path.basename(dest)}…`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const out = fs.createWriteStream(dest);
  let done = 0, lastPct = -1;
  for await (const chunk of res.body) {
    out.write(chunk);
    done += chunk.length;
    const pct = total ? Math.floor((done / total) * 100) : -1;
    if (pct !== lastPct && pct % 10 === 0) { process.stdout.write(`\r     ${pct}%   `); lastPct = pct; }
  }
  await new Promise((r, j) => out.end(err => (err ? j(err) : r())));
  process.stdout.write("\r            \r");
}

async function setupYtDlp() {
  const exe = path.join(BIN, IS_WIN ? "yt-dlp.exe" : "yt-dlp");
  if (fs.existsSync(exe)) {
    // Atualiza no máximo 1x por dia (o YouTube muda com frequência)
    if (Date.now() - (state.ytdlpChecked || 0) > DAY) {
      log("Verificando atualização do yt-dlp…");
      spawnSync(exe, ["-U"], { stdio: AUTO ? "ignore" : "inherit", timeout: 120000 });
      state.ytdlpChecked = Date.now(); save();
    }
    return log("✔ yt-dlp ok");
  }
  if (!IS_WIN && findTool("yt-dlp")) return log("✔ yt-dlp encontrado no sistema");
  const asset = IS_WIN ? "yt-dlp.exe" : process.platform === "darwin" ? "yt-dlp_macos" : "yt-dlp";
  await downloadTo(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, exe);
  if (!IS_WIN) fs.chmodSync(exe, 0o755);
  state.ytdlpChecked = Date.now(); save();
  log("✔ yt-dlp instalado");
}

async function setupFfmpeg() {
  if (findTool("ffmpeg") && findTool("ffprobe")) return log("✔ ffmpeg ok");
  if (!IS_WIN) return log("✖ ffmpeg não encontrado. Instale pelo gerenciador do sistema (ex.: sudo apt install ffmpeg).");
  const zip = path.join(TMP, "ffmpeg.zip");
  const dir = path.join(TMP, "ffmpeg");
  await downloadTo("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", zip);
  log("Extraindo ffmpeg…");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("tar", ["-xf", zip, "-C", dir]); // tar do Windows 10+ extrai .zip
  const binDir = fs.readdirSync(dir).map(d => path.join(dir, d, "bin")).find(fs.existsSync);
  if (!binDir) throw new Error("Estrutura inesperada no zip do ffmpeg.");
  for (const f of ["ffmpeg.exe", "ffprobe.exe"]) fs.copyFileSync(path.join(binDir, f), path.join(BIN, f));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  log("✔ ffmpeg instalado");
}

async function setupLibreOffice() {
  if (findTool("soffice")) return log("✔ LibreOffice ok");
  if (!IS_WIN) return log("✖ LibreOffice não encontrado (necessário só para Word/PDF/planilhas).");
  // No modo automático, pergunta só uma vez
  if (AUTO && state.libreofficeAsked) return log("– LibreOffice não instalado (conversão de documentos desativada). Rode: npm run setup");
  state.libreofficeAsked = true; save();
  if (!process.stdin.isTTY) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("\n   O LibreOffice (~350 MB) é necessário para converter Word <-> PDF.\n   Instalar agora via winget? [S/n] ")).trim().toLowerCase();
  rl.close();
  if (ans && !["s", "sim", "y", "yes"].includes(ans)) return log("– LibreOffice pulado. Rode `npm run setup` para instalar depois.");
  const r = spawnSync("winget", ["install", "-e", "--id", "TheDocumentFoundation.LibreOffice",
    "--accept-source-agreements", "--accept-package-agreements"], { stdio: "inherit" });
  log(r.status === 0 ? "✔ LibreOffice instalado" : "✖ Falha no winget. Baixe em https://pt-br.libreoffice.org/baixe-ja/");
}

console.log("\n  Toolbox — verificando ferramentas\n");
let failed = false;
for (const step of [setupYtDlp, setupFfmpeg, setupLibreOffice]) {
  try { await step(); } catch (e) { failed = true; log(`✖ ${step.name.replace("setup", "")}: ${e.message}`); }
}
console.log("");
if (failed && !AUTO) process.exitCode = 1;
