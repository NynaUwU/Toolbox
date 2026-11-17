// Toolbox — servidor local. Acessível apenas em http://localhost:3098
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { ROOT, OUTPUT, TMP, DATA, IS_WIN, findTool, insideDir, safeName, uniquePath, outDir } from "./lib/paths.mjs";
import { createJob, getJob, listJobs, finishJob, hasRunning } from "./lib/jobs.mjs";
import { GROUPS, groupFor, convert } from "./lib/convert.mjs";
import { download, FORMATS, listPlaylist } from "./lib/youtube.mjs";
import * as updater from "./lib/updater.mjs";
import { detectOffice } from "./lib/office.mjs";
import { installLibreOfficePortable } from "./lib/installer.mjs";
import * as sys from "./lib/system.mjs";
import * as net from "./lib/network.mjs";
import * as sensors from "./lib/sensors.mjs";
import * as video from "./lib/video.mjs";
import * as wintools from "./lib/wintools.mjs";
import * as access from "./lib/access.mjs";

const PORT = Number(process.env.TOOLBOX_PORT) || 3098;
const HOST = "0.0.0.0"; // aceita conexões da rede local (ver lib/access.mjs)
const RESTART_CODE = 42; // o Toolbox.bat reinicia o servidor quando recebe este código
const AUTO_UPDATE_MIN = 30;

const app = express();
app.use(express.json());

// Bloqueia requisições disparadas por OUTROS sites (CSRF): a origem precisa ser a própria Toolbox
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (req.method !== "GET" && origin) {
    let host = ""; try { host = new URL(origin).host; } catch {}
    if (host !== req.get("host")) return res.status(403).json({ error: "Origem não permitida" });
  }
  next();
});

// Acesso pela rede: o próprio PC entra direto; outros PCs precisam do acesso ligado (e da senha, se houver)
app.use(access.guard);
app.post("/api/login", (req, res) => {
  if (!access.checkPassword(req.body?.password)) return res.status(401).json({ error: "Senha incorreta." });
  res.setHeader("Set-Cookie", access.sessionCookie());
  res.json({ ok: true });
});
app.get("/api/whoami", (req, res) => res.json({ local: access.isLocal(req), urls: access.lanUrls(PORT), ...access.settings() }));
app.get("/api/settings/lan", access.localOnly, (req, res) => res.json({ ...access.settings(), urls: access.lanUrls(PORT) }));
app.post("/api/settings/lan", access.localOnly, (req, res) => res.json(access.save(req.body || {})));

// ---------- Arquivos estáticos ----------
app.use("/vendor/98", express.static(path.join(ROOT, "node_modules", "98.css", "dist")));
app.use("/tools", express.static(path.join(ROOT, "tools")));
app.use("/sites", express.static(path.join(ROOT, "sites")));
app.use("/", express.static(path.join(ROOT, "public")));

// ---------- Catálogo (desktop) ----------
function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

app.get("/api/catalog", (req, res) => {
  const items = [];
  for (const [dir, kind] of [["tools", "tool"], ["sites", "site"]]) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const slug of fs.readdirSync(base).sort()) {
      const meta = readJson(path.join(base, slug, "meta.json"), null);
      if (!meta || meta.hidden) continue;
      items.push({
        slug, kind,
        title: meta.title || slug,
        description: meta.description || "",
        icon: meta.icon || (kind === "tool" ? "🛠️" : "🌐"),
        width: meta.width, height: meta.height,
        window: Boolean(meta.window), // abre em janela separada do navegador
        category: meta.category || (kind === "site" ? "Meus sites" : "Outras ferramentas"),
        order: meta.order ?? 100,
        url: `/${dir}/${slug}/`,
      });
    }
  }
  for (const l of readJson(path.join(ROOT, "links.json"), [])) {
    items.push({ kind: "link", slug: l.slug || l.url, title: l.title, description: l.description || "",
      icon: l.icon || "🔗", url: l.url, order: l.order ?? 100, external: /^https?:/.test(l.url), category: l.category || "Atalhos" });
  }
  items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"));
  res.json({ items });
});

// ---------- Status / ferramentas externas ----------
const versionOf = (cmd, args) => new Promise(resolve => {
  if (!cmd) return resolve(null);
  execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, out) =>
    resolve(err ? null : String(out).split(/\r?\n/)[0].trim().slice(0, 80)));
});

let toolsCache = null;
async function toolStatus(force) {
  if (toolsCache && !force) return toolsCache;
  const [ytdlp, ffmpeg, soffice] = [findTool("yt-dlp"), findTool("ffmpeg"), findTool("soffice")];
  const [v1, v2, office] = await Promise.all([versionOf(ytdlp, ["--version"]), versionOf(ffmpeg, ["-version"]), detectOffice()]);
  const officeApps = Object.keys(office).filter(k => office[k]);
  toolsCache = {
    "yt-dlp": { ok: Boolean(v1), version: v1 },
    ffmpeg: { ok: Boolean(v2), version: v2?.replace(/^ffmpeg version /, "").split(" ")[0] },
    // documentos: Office já existente OU LibreOffice portátil
    documentos: {
      ok: Boolean(soffice || officeApps.length),
      version: [officeApps.length && `Office (${officeApps.join(", ")})`, soffice && "LibreOffice"].filter(Boolean).join(" + ") || null,
      office, libreoffice: Boolean(soffice),
    },
  };
  return toolsCache;
}

app.get("/api/status", async (req, res) => {
  res.json({
    tools: await toolStatus(req.query.refresh === "1"),
    update: updater.state,
    output: OUTPUT,
    busy: hasRunning(),
  });
});

// ---------- Tarefas ----------
app.get("/api/jobs", (req, res) => res.json(listJobs()));
app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json({ ...job, log: job.log.slice(-15) });
});

// ---------- YouTube ----------
app.get("/api/youtube/formats", (req, res) => res.json(FORMATS));
app.post("/api/youtube/playlist", async (req, res) => {
  try { res.json(await listPlaylist(String(req.body?.url || ""))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/youtube", (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Informe uma URL válida." });
  const job = createJob("youtube", url);
  download(job, req.body).then(() => finishJob(job), err => finishJob(job, err));
  res.json({ id: job.id });
});

// ---------- Conversor de arquivos ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP,
    // mantém a extensão: Office/LibreOffice identificam o formato por ela
    filename: (req, file, cb) => cb(null, `up-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "")}`),
  }),
  limits: { fileSize: 8 * 1024 ** 3 },
});

app.get("/api/convert/formats", (req, res) => res.json(GROUPS));
app.post("/api/convert", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
  // multer entrega o nome em latin1; converte para UTF-8 (acentos)
  const name = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  const target = String(req.body.target || "").toLowerCase();
  if (!groupFor(path.extname(name).slice(1))) {
    fs.rm(req.file.path, () => {});
    return res.status(400).json({ error: "Formato não suportado." });
  }
  const job = createJob("convert", `${name} → .${target}`);
  convert(job, req.file.path, name, target, req.body)
    .then(out => { job.files.push(path.relative(OUTPUT, out)); finishJob(job); }, err => finishJob(job, err))
    .finally(() => fs.rm(req.file.path, () => {}));
  res.json({ id: job.id });
});

// ---------- Ferramentas do Windows (só comandos para copiar e arquivos para baixar) ----------
// irm <url> | iex  — versão servida pela própria Toolbox (só funciona no PC onde ela roda)
app.get("/win/update.ps1", (req, res) => {
  // usa o endereço pelo qual o PC chegou aqui (ex.: http://192.168.0.10:3098) — tudo pela rede local
  res.type("text/plain; charset=utf-8").send(wintools.bootstrap(`http://${req.get("host")}/tools/windows/scripts`));
});

// ---------- Editor de vídeo ----------
app.post("/api/video/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
  const name = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  try {
    const rec = await video.register(req.file.path, name);
    let previewJob = null;
    if (rec.needsPreview) {
      const job = createJob("preview", `Prévia de ${name}`);
      video.makePreview(job, rec).then(() => finishJob(job), err => finishJob(job, err));
      previewJob = job.id;
    }
    const { file, preview, ...info } = rec;
    res.json({ ...info, previewJob });
  } catch (e) {
    fs.rm(req.file.path, () => {});
    res.status(400).json({ error: e.message });
  }
});
app.get("/api/video/:id/media", (req, res) => {
  const rec = video.get(req.params.id);
  if (!rec) return res.status(404).send("Vídeo não encontrado (o servidor reiniciou? abra de novo).");
  res.sendFile(rec.preview || rec.file);
});
app.post("/api/video/:id/export", (req, res) => {
  const rec = video.get(req.params.id);
  if (!rec) return res.status(404).json({ error: "Vídeo não encontrado — abra o arquivo de novo." });
  const job = createJob("video", `${rec.name} → .${req.body?.format || "mp4"}`);
  video.exportVideo(job, rec, req.body || {})
    .then(out => { job.files.push(path.relative(OUTPUT, out)); finishJob(job); }, err => finishJob(job, err));
  res.json({ id: job.id });
});
setInterval(video.cleanup, 3600e3);

// ---------- Salvar imagem (editor de imagens / quadro de vídeo) ----------
app.post("/api/save-image", express.raw({ type: "image/*", limit: "300mb" }), (req, res) => {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[req.get("content-type")];
  if (!ext || !req.body?.length) return res.status(400).json({ error: "Imagem inválida." });
  const base = safeName(String(req.query.name || "imagem").replace(/\.[a-z0-9]+$/i, ""));
  const out = uniquePath(outDir("Imagens"), base, ext);
  fs.writeFileSync(out, req.body);
  res.json({ file: path.relative(OUTPUT, out) });
});

// ---------- Arquivos de saída ----------
app.get("/api/files", (req, res) => {
  const full = insideDir(OUTPUT, String(req.query.f || ""));
  if (!full || !fs.existsSync(full)) return res.status(404).send("Arquivo não encontrado");
  if (req.query.view === "1") return res.sendFile(full);
  res.download(full);
});

/** Abre a pasta no gerenciador de arquivos; com select=true, abre a pasta do arquivo já com ele destacado. */
function explorerArgs(target, select) {
  // O Explorer só entende  /select,"C:\caminho\arquivo"  — se o Node puser aspas no argumento
  // inteiro ("/select,C:\…", o que acontece quando há espaços), ele ignora e abre “Documentos”.
  const win = path.win32.normalize(target);
  return select ? `/select,"${win}"` : `"${win}"`;
}
function openInExplorer(target, select) {
  if (IS_WIN) {
    spawn("explorer.exe", [explorerArgs(target, select)], { windowsVerbatimArguments: true, detached: true, stdio: "ignore" })
      .on("error", () => {}).unref();
    return;
  }
  const [cmd, args] = process.platform === "darwin"
    ? ["open", select ? ["-R", target] : [target]]
    : ["xdg-open", [select ? path.dirname(target) : target]];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

app.post("/api/open-folder", access.localOnly, (req, res) => {
  const f = req.body?.f;
  const full = f ? insideDir(OUTPUT, f) : null;
  if (full && fs.existsSync(full)) openInExplorer(full, true);          // destaca o arquivo
  else if (full && fs.existsSync(path.dirname(full))) openInExplorer(path.dirname(full), false); // arquivo sumiu: abre a pasta dele
  else openInExplorer(OUTPUT, false);
  res.json({ ok: true });
});

// ---------- Câmbio (com cache para funcionar offline) ----------
const FX_CACHE = path.join(DATA, "cambio.json");
app.get("/api/currency", async (req, res) => {
  const cache = readJson(FX_CACHE, null);
  const fresh = cache && Date.now() - cache.fetched < 60 * 60 * 1000;
  if (fresh && req.query.refresh !== "1") return res.json(cache);
  try {
    let data;
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      if (j.result !== "success") throw new Error("falha");
      data = { base: "USD", rates: j.rates, date: j.time_last_update_utc, source: "ExchangeRate-API (open.er-api.com)" };
    } catch {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD", { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      data = { base: "USD", rates: { USD: 1, ...j.rates }, date: j.date, source: "Frankfurter (BCE)" };
    }
    data.fetched = Date.now();
    fs.writeFileSync(FX_CACHE, JSON.stringify(data));
    res.json(data);
  } catch {
    if (cache) return res.json({ ...cache, stale: true });
    res.status(503).json({ error: "Sem conexão e sem cotações salvas." });
  }
});

// ---------- Atualizações ----------
app.post("/api/update/check", async (req, res) => res.json(await updater.checkUpdates()));
app.post("/api/update/apply", access.localOnly, async (req, res) => {
  try {
    const changed = await updater.applyUpdate();
    res.json({ ok: true, restarting: changed });
    if (changed) setTimeout(() => process.exit(RESTART_CODE), 500);
  } catch (e) {
    res.status(500).json({ error: String(e.stderr || e.message).slice(0, 400) });
  }
});
app.post("/api/tools/update", access.localOnly, (req, res) => {
  const ytdlp = findTool("yt-dlp");
  if (!ytdlp) return res.status(400).json({ error: "yt-dlp não instalado." });
  execFile(ytdlp, ["-U"], { timeout: 120000, windowsHide: true }, (err, out, errOut) => {
    toolsCache = null;
    res.json({ ok: !err, output: String(out || errOut).trim().slice(-600) });
  });
});

// ---------- Gerenciador de tarefas ----------
app.get("/api/system/info", async (req, res) => res.json(await sys.systemInfo()));
app.get("/api/system/perf", async (req, res) => res.json(await sys.performance()));
app.get("/api/system/processes", async (req, res) => res.json(await sys.processes()));
app.post("/api/system/kill", access.localOnly, (req, res) => {
  try { sys.killProcess(req.body?.pid); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.code === "EPERM" ? "Sem permissão para finalizar este processo." : e.message }); }
});

app.get("/api/system/sensors", async (req, res) => res.json(await sensors.sensors()));
app.post("/api/system/sensors/lhm", access.localOnly, (req, res) => {
  if (req.body?.action === "start") {
    try { sensors.startLhm(); return res.json({ ok: true }); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  const job = createJob("lhm", "LibreHardwareMonitor portátil");
  sensors.downloadLhm(msg => { job.stage = msg; })
    .then(() => { finishJob(job); try { sensors.startLhm(); } catch {} }, err => finishJob(job, err));
  res.json({ id: job.id });
});

// ---------- Dispositivos na rede ----------
let lastScan = null;
app.get("/api/network/interfaces", (req, res) => res.json(net.localNetworks()));
app.get("/api/network/last", (req, res) => res.json({ result: lastScan,
  running: listJobs().find(j => j.type === "netscan" && j.status === "running")?.id || null }));
app.post("/api/network/scan", (req, res) => {
  const running = listJobs().find(j => j.type === "netscan" && j.status === "running");
  if (running) return res.json({ id: running.id });
  const job = createJob("netscan", "Varredura da rede");
  job.stage = "Procurando aparelhos…";
  net.scan({ address: req.body?.address, bits: req.body?.bits || "auto", onProgress: (p, msg) => { job.progress = p; if (msg) job.stage = msg; } })
    .then(r => { job.result = r; lastScan = r; finishJob(job); }, err => finishJob(job, err));
  res.json({ id: job.id });
});

// LibreOffice portátil: baixado e extraído para runtime/ só quando o usuário pede
app.post("/api/tools/libreoffice", access.localOnly, (req, res) => {
  const running = listJobs().find(j => j.type === "libreoffice" && j.status === "running");
  if (running) return res.json({ id: running.id });
  const job = createJob("libreoffice", "LibreOffice portátil");
  installLibreOfficePortable({
    log: msg => { job.stage = msg; job.log.push(msg); },
    onProgress: pct => { job.progress = pct; },
  }).then(() => { toolsCache = null; finishJob(job); }, err => finishJob(job, err));
  res.json({ id: job.id });
});

// Verificação periódica: atualiza sozinho quando não há tarefas rodando
async function autoUpdate() {
  await updater.checkUpdates();
  if (updater.state.behind > 0 && !hasRunning()) {
    try {
      if (await updater.applyUpdate()) {
        console.log("Atualização aplicada — reiniciando…");
        process.exit(RESTART_CODE);
      }
    } catch (e) {
      updater.state.error = `Falha ao aplicar atualização: ${e.message}`;
    }
  }
}

// ---------- Início ----------
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
await updater.currentVersion();

app.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  const lan = access.lanUrls(PORT).filter(u => !u.virtual).map(u => `    ${u.url}`).join("\n");
  console.log(`\n  Toolbox rodando em ${url}`);
  if (lan) console.log(`  Na rede (outros PCs): \n${lan}${access.settings().hasPassword ? "\n  (protegido por senha)" : ""}`);
  console.log(`  Arquivos salvos em: ${OUTPUT}\n  (feche esta janela para encerrar)\n`);
  if (process.argv.includes("--open")) {
    const [cmd, args] = IS_WIN ? ["cmd", ["/c", "start", "", url]] : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  }
  if (updater.state.available) {
    setTimeout(autoUpdate, 5000);
    setInterval(autoUpdate, AUTO_UPDATE_MIN * 60 * 1000);
  }
});
