import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const IS_WIN = process.platform === "win32";
// Arquivos do usuário: <pasta do programa>/Output/{YouTube,Convertidos,Imagens,Vídeos,Áudios}
// Ferramentas e dados internos: na raiz do programa (bin/, runtime/, data/, tmp/)
export const OUTPUT = process.env.TOOLBOX_OUTPUT || path.join(ROOT, "Output");
export const BIN = path.join(ROOT, "bin");
export const TMP = path.join(ROOT, "tmp");
export const DATA = path.join(ROOT, "data");
export const RUNTIME = path.join(ROOT, "runtime"); // Node portátil, LibreOffice portátil etc.
const OLD_SYS = path.join(OUTPUT, "_sistema"); // usado numa versão anterior

/** Subpasta de saída por ferramenta (criada sob demanda). */
export function outDir(name) {
  const d = path.join(OUTPUT, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Versão anterior guardava as pastas internas em Output/_sistema: traz de volta para a raiz
for (const [name, dest] of [["bin", BIN], ["data", DATA]]) {
  const old = path.join(OLD_SYS, name);
  try { if (fs.existsSync(old) && !fs.existsSync(dest)) fs.renameSync(old, dest); } catch {}
}
try { fs.rmSync(path.join(OLD_SYS, "tmp"), { recursive: true, force: true }); } catch {}
try { if (fs.existsSync(OLD_SYS) && !fs.readdirSync(OLD_SYS).length) fs.rmdirSync(OLD_SYS); } catch {}

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
