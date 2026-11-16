import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const IS_WIN = process.platform === "win32";
export const BIN = path.join(ROOT, "bin");
export const TMP = path.join(ROOT, "tmp");
export const DATA = path.join(ROOT, "data");

// Pasta onde os arquivos baixados/convertidos são salvos.
// Padrão: Downloads/Toolbox. Pode ser trocada com a variável TOOLBOX_OUTPUT.
export const OUTPUT = process.env.TOOLBOX_OUTPUT || path.join(os.homedir(), "Downloads", "Toolbox");

for (const d of [BIN, TMP, DATA, OUTPUT]) fs.mkdirSync(d, { recursive: true });

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
