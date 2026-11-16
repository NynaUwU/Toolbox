// Detecta o Microsoft Office já instalado e converte via office.ps1 (sem instalar nada).
import { execFile } from "node:child_process";
import path from "node:path";
import { ROOT, IS_WIN } from "./paths.mjs";
import { runProcess } from "./jobs.mjs";

export const OFFICE_APP = { document: "Word", pdf: "Word", sheet: "Excel", slides: "PowerPoint" };
export const OFFICE_TARGETS = {
  Word: ["pdf", "docx", "doc", "odt", "rtf", "txt", "html"],
  Excel: ["pdf", "xlsx", "ods", "csv", "html"],
  PowerPoint: ["pdf", "pptx", "odp", "png"],
};

let cache = null;
const hasProgId = progId => new Promise(resolve =>
  execFile("reg", ["query", `HKCR\\${progId}\\CLSID`], { windowsHide: true, timeout: 5000 }, err => resolve(!err)));

export async function detectOffice() {
  if (cache) return cache;
  if (!IS_WIN) return (cache = { Word: false, Excel: false, PowerPoint: false });
  const [Word, Excel, PowerPoint] = await Promise.all(
    ["Word.Application", "Excel.Application", "PowerPoint.Application"].map(hasProgId));
  return (cache = { Word, Excel, PowerPoint });
}

export async function officeCan(groupId, target) {
  const app = OFFICE_APP[groupId];
  return Boolean(app && (await detectOffice())[app] && OFFICE_TARGETS[app].includes(target));
}

export async function officeConvert(job, groupId, input, output, target) {
  const app = OFFICE_APP[groupId];
  job.stage = `Convertendo com o ${app}…`;
  const code = await runProcess(job, "powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", path.join(ROOT, "lib", "office.ps1"),
    "-App", app, "-In", input, "-Out", output, "-Target", target,
  ]);
  if (code !== 0) throw new Error(job.log.filter(l => !/^\s*(At |\+|CategoryInfo|FullyQualified)/.test(l)).at(-1) || `${app} falhou (código ${code})`);
}
