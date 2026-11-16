import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const IS_WIN = process.platform === "win32";
export const BIN = path.join(ROOT, "bin");
export const TMP = path.join(ROOT, "tmp");
export const DATA = path.join(ROOT, "data");
export const RUNTIME = path.join(ROOT, "runtime"); // Node portátil, LibreOffice portátil etc.

// Pasta onde os arquivos baixados/convertidos são salvos.
// Padrão: Downloads/Toolbox. Pode ser trocada com a variável TOOLBOX_OUTPUT.
export const OUTPUT = process.env.TOOLBOX_OUTPUT || path.join(os.homedir(), "Downloads", "Toolbox");

for (const d of [BIN, TMP, DATA, RUNTIME, OUTPUT]) fs.mkdirSync(d, { recursive: true });

function onPath(cmd) {
  const exts = IS_WIN ? ["", ...(process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try { if (fs.statSync(p).isFile()) return p; } catch {}
    }
  }
  return null;
}

/** Localiza um executável: primeiro em ./bin, depois em locais conhecidos, depois no PATH. */
export function findTool(name) {
  const local = path.join(BIN, IS_WIN ? `${name}.exe` : name);
  if (fs.existsSync(local)) return local;
  if (name === "soffice") {
    // LibreOffice portátil baixado pela Toolbox (caminho salvo pelo instalador)
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(DATA, "tools.json"), "utf8")).soffice;
      if (saved && fs.existsSync(saved)) return saved;
    } catch {}
    const candidates = IS_WIN
      ? [
          path.join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
          path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
        ]
      : ["/Applications/LibreOffice.app/Contents/MacOS/soffice"];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return onPath("soffice") || onPath("libreoffice");
  }
  return onPath(name);
}

/** Remove caracteres proibidos em nomes de arquivo (Windows é o mais restritivo). */
export function safeName(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 150) || "arquivo";
}

/** Gera um caminho livre: "nome.ext", "nome (1).ext", ... */
export function uniquePath(dir, base, ext) {
  let p = path.join(dir, `${base}.${ext}`);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i}).${ext}`);
  return p;
}

/** Garante que `rel` fica dentro de `dir` (evita ../../ em downloads). */
export function insideDir(dir, rel) {
  const full = path.resolve(dir, rel);
  return full.startsWith(path.resolve(dir) + path.sep) ? full : null;
}

/** Lê/grava data/config.json (token do GitHub etc.). Fica só no seu PC. */
const CONFIG = path.join(DATA, "config.json");
export function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return {}; }
}
export function writeConfig(patch) {
  const cfg = { ...readConfig(), ...patch };
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  return cfg;
}
