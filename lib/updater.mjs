// Atualização automática SEM git: consulta o GitHub, baixa o zip do commit novo
// e substitui os arquivos da Toolbox (mantendo runtime/, bin/, data/, tmp/).
import fs from "node:fs";
import path from "node:path";
import { ROOT, TMP, DATA, readConfig } from "./paths.mjs";
import { downloadTo, extractZip } from "./installer.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const REPO = pkg.toolbox?.repo;
const BRANCH = pkg.toolbox?.branch || "main";
const VERSION_FILE = path.join(DATA, "version.json");
const MANIFEST_FILE = path.join(DATA, "manifest.json");
// Pastas locais que a atualização nunca toca
const KEEP = new Set(["runtime", "bin", "data", "tmp", "output", ".git"]);

export const state = { version: null, sha: null, behind: 0, pending: [], lastCheck: null, error: null, available: Boolean(REPO) };

function headers() {
  const h = { "User-Agent": "toolbox-local", Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN || readConfig().githubToken; // opcional (repositório privado)
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
async function gh(url) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${url}`, { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (r.status === 404) throw new Error("Repositório não encontrado (privado?).");
  if (r.status === 403) throw new Error("Limite da API do GitHub atingido; tento de novo mais tarde.");
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  return r.json();
}

/** Commit instalado: data/version.json ou, se a pasta veio de um clone, o HEAD do .git. */
function installedSha() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")).sha; } catch {}
  try {
    const head = fs.readFileSync(path.join(ROOT, ".git", "HEAD"), "utf8").trim();
    if (!head.startsWith("ref:")) return head;
    return fs.readFileSync(path.join(ROOT, ".git", head.slice(5).trim()), "utf8").trim();
  } catch {}
  return null;
}

export async function currentVersion() {
  state.sha = installedSha();
  let info = {};
  try { info = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")); } catch {}
  const date = info.date ? new Date(info.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  state.version = state.sha ? `${state.sha.slice(0, 7)}${date ? " · " + date : ""}` : "desconhecida";
  return state.version;
}

export async function checkUpdates() {
  state.lastCheck = new Date().toISOString();
  if (!REPO) return state;
  try {
    const latest = await gh(`/commits/${encodeURIComponent(BRANCH)}`);
    const current = installedSha();
    state.latest = { sha: latest.sha, date: latest.commit.committer.date };
    if (current === latest.sha) {
      state.behind = 0; state.pending = [];
    } else if (current) {
      try {
        const cmp = await gh(`/compare/${current}...${latest.sha}`);
        state.behind = cmp.ahead_by || 1;
        state.pending = cmp.commits.map(c => c.commit.message.split("\n")[0]).reverse().slice(0, 20);
      } catch {
        state.behind = 1; state.pending = [latest.commit.message.split("\n")[0]];
      }
    } else {
      state.behind = 1; state.pending = ["Versão instalada desconhecida — sincronizar com o GitHub"];
    }
    state.error = null;
  } catch (e) {
    state.error = e.name === "TimeoutError" || e.cause ? "Sem conexão com o GitHub." : e.message;
  }
  return state;
}

function listFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

/** Baixa e aplica a versão mais recente. Retorna true se algo mudou. */
export async function applyUpdate(log = () => {}) {
  if (!state.latest) await checkUpdates();
  if (!state.latest) throw new Error(state.error || "Não foi possível consultar o GitHub.");
  const { sha, date } = state.latest;
  if (sha === installedSha()) return false;

  const zip = path.join(TMP, "update.zip");
  const dir = path.join(TMP, "update");
  fs.rmSync(dir, { recursive: true, force: true });
  log("Baixando atualização…");
  // Repositório público: zip direto do codeload; privado: via API (com token)
  const url = headers().Authorization
    ? `https://api.github.com/repos/${REPO}/zipball/${sha}`
    : `https://codeload.github.com/${REPO}/zip/${sha}`;
  await downloadTo(url, zip);
  extractZip(zip, dir);
  const top = fs.readdirSync(dir).map(d => path.join(dir, d)).find(p => fs.statSync(p).isDirectory());
  if (!top || !fs.existsSync(path.join(top, "server.mjs"))) throw new Error("Zip da atualização inválido.");

  const files = listFiles(top).filter(f => !KEEP.has(f.split("/")[0]));
  log(`Aplicando ${files.length} arquivos…`);
  for (const rel of files) {
    const src = path.join(top, rel);
    // O .bat em execução não pode ser sobrescrito: grava ao lado e ele se troca no próximo início
    const destRel = rel === "Toolbox.bat" ? "Toolbox.bat.new" : rel;
    const dest = path.join(ROOT, destRel);
    if (rel === "Toolbox.bat" && fs.existsSync(path.join(ROOT, rel)) &&
        fs.readFileSync(src).equals(fs.readFileSync(path.join(ROOT, rel)))) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  // Remove arquivos que existiam na versão anterior e foram apagados no GitHub
  try {
    const old = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    const now = new Set(files);
    for (const rel of old) if (!now.has(rel)) fs.rmSync(path.join(ROOT, rel), { force: true });
  } catch {}
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(files));
  fs.writeFileSync(VERSION_FILE, JSON.stringify({ sha, date }));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  await currentVersion();
  state.behind = 0; state.pending = [];
  return true;
}
