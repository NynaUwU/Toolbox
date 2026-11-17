// Ferramentas do Windows. O servidor só executa itens desta lista fixa — nunca comandos vindos da página.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, IS_WIN } from "./paths.mjs";

export const UPDATE_SCRIPT = path.join(ROOT, "tools", "windows", "scripts", "Update-Windows.ps1");
export const UPDATE_LOG = "C:\\ProgramData\\WinUpdateHelper\\update-log.txt";
const WINUTIL_URL = "https://christitus.com/win";

const ps = s => s.replace(/'/g, "''"); // escapa aspas simples para PowerShell

/** Abre um PowerShell como administrador (o Windows mostra a confirmação UAC). */
function elevated(args) {
  const cmd = `Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList '${ps(args)}'`;
  spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { detached: true, stdio: "ignore", windowsHide: true })
    .on("error", () => {}).unref();
}

export const ACTIONS = {
  winutil: { label: "WinUtil (Chris Titus Tech)", run: () => elevated(`-NoProfile -ExecutionPolicy Bypass -Command "irm '${WINUTIL_URL}' | iex"`) },
  update: { label: "Atualização forçada do Windows", run: () => elevated(`-NoProfile -ExecutionPolicy Bypass -File "${UPDATE_SCRIPT}"`) },
};

export function runAction(id) {
  const a = Object.hasOwn(ACTIONS, id) ? ACTIONS[id] : null;
  if (!a) throw new Error("Ação desconhecida.");
  if (!IS_WIN) throw new Error("Disponível apenas no Windows.");
  a.run();
  return a.label;
}

/** Script curto servido em /win/update.ps1: baixa o script completo do servidor da Toolbox e roda como arquivo
 *  (precisa ser arquivo para o próprio script conseguir se elevar e retomar após reiniciar). */
export function bootstrap(baseUrl) {
  return [
    "# Atualizacao forcada do Windows - servido pela Toolbox",
    "$d = 'C:\\ProgramData\\WinUpdateHelper'",
    "New-Item -ItemType Directory -Force -Path $d | Out-Null",
    "$f = Join-Path $d 'Update-Windows.ps1'",
    `Invoke-WebRequest '${baseUrl}/tools/windows/scripts/Update-Windows.ps1' -OutFile $f -UseBasicParsing`,
    "Start-Process powershell.exe -Verb RunAs -ArgumentList \"-NoProfile -ExecutionPolicy Bypass -File `\"$f`\"\"",
    "",
  ].join("\r\n");
}

export function readLog(lines = 200) {
  if (!IS_WIN || !fs.existsSync(UPDATE_LOG)) return null;
  try {
    // o Start-Transcript grava em UTF-16 ou UTF-8 conforme a versão do PowerShell
    const buf = fs.readFileSync(UPDATE_LOG);
    const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");
    return text.split(/\r?\n/).slice(-lines).join("\n");
  } catch { return null; }
}
