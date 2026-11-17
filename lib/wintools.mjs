// Ferramentas do Windows: a Toolbox NÃO executa nada — só entrega comandos para copiar e arquivos para baixar,
// porque o comando precisa rodar no PC de quem vai usar (e não no PC onde o servidor está).
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const REPO = pkg.toolbox?.repo || "NynaUwU/Toolbox";
const BRANCH = pkg.toolbox?.branch || "main";

/** Endereço público (GitHub) da pasta de scripts — funciona em qualquer PC com internet. */
export const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}/tools/windows/scripts`;

/**
 * Script curto que baixa o Update-Windows.ps1 e o roda como ARQUIVO, como administrador.
 * (Precisa ser arquivo: o script usa o próprio caminho para se elevar e para continuar após reiniciar.)
 */
export function bootstrap(scriptsUrl) {
  return [
    "# Atualizacao forcada do Windows - baixa o script e executa como administrador",
    "$d = 'C:\\ProgramData\\WinUpdateHelper'",
    "New-Item -ItemType Directory -Force -Path $d | Out-Null",
    "$f = Join-Path $d 'Update-Windows.ps1'",
    `Invoke-WebRequest '${scriptsUrl}/Update-Windows.ps1' -OutFile $f -UseBasicParsing`,
    "Start-Process powershell.exe -Verb RunAs -ArgumentList \"-NoProfile -ExecutionPolicy Bypass -File `\"$f`\"\"",
    "",
  ].join("\r\n");
}
