// Garante as ferramentas portáteis (chamado pelo Toolbox.bat a cada início).
//   node scripts/setup.mjs                 -> yt-dlp + ffmpeg
//   node scripts/setup.mjs --libreoffice   -> também baixa o LibreOffice portátil (~350 MB)
import { ensureYtDlp, ensureFfmpeg, installLibreOfficePortable } from "../lib/installer.mjs";

const log = msg => console.log("  ", msg);
let last = -1;
const onProgress = pct => {
  if (pct == null || !process.stdout.isTTY) return;
  if (pct !== last) { process.stdout.write(`\r     ${pct}%   `); last = pct; }
  if (pct === 100) process.stdout.write("\r            \r");
};

console.log("\n  Toolbox — verificando ferramentas portáteis\n");
const steps = [ensureYtDlp, ensureFfmpeg];
if (process.argv.includes("--libreoffice")) steps.push(installLibreOfficePortable);
for (const step of steps) {
  try { await step({ log, onProgress }); }
  catch (e) { log(`✖ ${e.message}`); }
}
console.log("");
