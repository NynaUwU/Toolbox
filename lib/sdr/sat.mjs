// Satélites: TLE (CelesTrak), previsão de passagens (SGP4 via satellite.js), gravação automática
// das passagens e decodificação das imagens com o SatDump portátil.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { DATA, OUTPUT, readConfig, writeConfig, outDir, safeName } from "../paths.mjs";
import { hub } from "./hub.mjs";
import { sdrTool } from "./install.mjs";

const sat = createRequire(import.meta.url)("satellite.js");

/** Satélites acompanhados. Os NOAA de APT foram desligados em 2025 (ficam para referência). */
export const SATS = [
  { norad: 57166, name: "METEOR-M2 3", freq: 137.9e6, mode: "LRPT (QPSK 72 kbit/s)", pipeline: "meteor_m2-x_lrpt", status: "ativo", color: "#ff55ff" },
  { norad: 59051, name: "METEOR-M2 4", freq: 137.9e6, mode: "LRPT (QPSK 72 kbit/s)", pipeline: "meteor_m2-x_lrpt", status: "ativo", color: "#55ffff" },
  { norad: 25544, name: "ISS (ZARYA)", freq: 145.8e6, mode: "FM: voz / SSTV · APRS em 145,825", pipeline: null, status: "ativo", color: "#ffff55" },
  { norad: 33591, name: "NOAA 19", freq: 137.1e6, mode: "APT (FM analógico)", pipeline: "noaa_apt", status: "APT desligado em 2025", color: "#888888" },
  { norad: 28654, name: "NOAA 18", freq: 137.9125e6, mode: "APT (FM analógico)", pipeline: "noaa_apt", status: "desativado em 2025", color: "#888888" },
  { norad: 25338, name: "NOAA 15", freq: 137.62e6, mode: "APT (FM analógico)", pipeline: "noaa_apt", status: "desativado em 2025", color: "#888888" },
];

// ---------- TLE ----------
const TLE_FILE = path.join(DATA, "tle.json");
let tleCache = (() => { try { return JSON.parse(fs.readFileSync(TLE_FILE, "utf8")); } catch { return { fetched: 0, sats: {} }; } })();
export async function getTle(force = false) {
  if (!force && Date.now() - tleCache.fetched < 12 * 3600e3 && Object.keys(tleCache.sats).length) return tleCache;
  const next = { fetched: Date.now(), sats: { ...tleCache.sats } };
  await Promise.all(SATS.map(async s => {
    try {
      const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.norad}&FORMAT=tle`, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "toolbox-local" } });
      const lines = (await r.text()).trim().split(/\r?\n/).map(l => l.trim());
      if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) next.sats[s.norad] = [lines[1], lines[2]];
    } catch {}
  }));
  if (Object.keys(next.sats).length) { tleCache = next; fs.writeFileSync(TLE_FILE, JSON.stringify(tleCache)); }
  return tleCache;
}

export function observer() { return { lat: -23.55, lon: -46.63, alt: 760, ...(readConfig().observer || {}) }; }
export function setObserver(o) {
  const lat = +o.lat, lon = +o.lon, alt = +o.alt || 0;
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error("Coordenadas inválidas.");
  writeConfig({ observer: { lat, lon, alt } });
  return observer();
}

// ---------- Passagens ----------
function lookAt(rec, date, obs) {
  const pv = sat.propagate(rec, date);
  if (!pv.position) return null;
  const gmst = sat.gstime(date);
  const ecf = sat.eciToEcf(pv.position, gmst);
  const la = sat.ecfToLookAngles({ latitude: obs.lat * Math.PI / 180, longitude: obs.lon * Math.PI / 180, height: obs.alt / 1000 }, ecf);
  return { el: la.elevation * 180 / Math.PI, az: la.azimuth * 180 / Math.PI };
}
export function passes(tle, obs, hours = 24, minEl = 0, from = Date.now()) {
  const rec = sat.twoline2satrec(tle[0], tle[1]);
  const out = []; let cur = null, prevEl = null;
  for (let t = from; t < from + hours * 3600e3; t += 20000) {
    const la = lookAt(rec, new Date(t), obs); if (!la) break;
    if (la.el > 0 && prevEl !== null && prevEl <= 0) cur = { aos: t, maxEl: la.el, tca: t, azAos: la.az };
    if (cur) { if (la.el > cur.maxEl) { cur.maxEl = la.el; cur.tca = t; } if (la.el <= 0) { cur.los = t; cur.azLos = la.az; if (cur.maxEl >= minEl) out.push(cur); cur = null; } }
    prevEl = la.el;
  }
  return out.map(p => ({ ...p, maxEl: Math.round(p.maxEl), duration: Math.round((p.los - p.aos) / 60000) }));
}

export async function info() {
  const tle = await getTle(), obs = observer(), auto = readConfig().satAuto || {};
  return {
    observer: obs, tleAge: tle.fetched, recording: current,
    sats: SATS.map(s => ({ ...s, tle: tle.sats[s.norad] || null, auto: !!auto[s.norad],
      passes: tle.sats[s.norad] ? passes(tle.sats[s.norad], obs, 36, 10).slice(0, 6) : [] })),
  };
}

// ---------- Gravação de passagens (manual e automática) ----------
let current = null; // { norad, name, file, until }
export function setAuto(norad, on) { const a = { ...(readConfig().satAuto || {}) }; a[norad] = !!on; writeConfig({ satAuto: a }); return a; }

export function startPass(norad, until = null) {
  const s = SATS.find(x => x.norad === +norad);
  if (!s) throw new Error("Satélite desconhecido.");
  if (current) throw new Error(`Já gravando ${current.name}.`);
  hub.keepAlive = true; hub.ensureSource();
  // centro deslocado 250 kHz para fugir do pico DC do dongle; o canal volta para a frequência do satélite
  hub.tune({ tool: "satelites", freq: s.freq + 250e3, vfo: -250e3, rate: 1024000, mode: "iq", bw: 150000, decoders: [] });
  const file = hub.startRec("baseband", safeName(s.name));
  current = { norad: s.norad, name: s.name, file, started: Date.now(), until };
  hub.broadcast({ type: "event", ev: { type: "sat", text: `Gravando passagem de ${s.name} em ${(s.freq / 1e6).toFixed(4)} MHz`, time: new Date().toISOString() } });
  return current;
}
export async function stopPass() {
  if (!current) return null;
  const c = current; current = null; hub.keepAlive = false;
  const file = await hub.stopRec("baseband");
  const s = SATS.find(x => x.norad === c.norad);
  decode(s, file || c.file).catch(e => hub.onEvent({ type: "sat", text: `Falha ao decodificar ${s.name}: ${e.message}` }));
  hub.maybeIdle();
  return c;
}

/** Roda o SatDump na gravação; imagens vão para Output/Satélites/<satélite data>/ */
function decode(s, file) {
  return new Promise((resolve, reject) => {
    const exe = sdrTool("satdump");
    if (!s.pipeline) return resolve(null);
    if (!exe) { hub.onEvent({ type: "sat", text: `Gravação salva (${path.basename(file)}). Baixe o SatDump para gerar as imagens.` }); return resolve(null); }
    const rate = (file.match(/(\d+)sps/) || [])[1] || "256000";
    const out = path.join(outDir("Satélites"), `${safeName(s.name)} ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
    fs.mkdirSync(out, { recursive: true });
    hub.onEvent({ type: "sat", text: `Decodificando ${s.name} com o SatDump…` });
    const p = spawn(exe, [s.pipeline, "baseband", file, out, "--samplerate", rate, "--baseband_format", "cs16", "--dc_block"], { cwd: path.dirname(exe), windowsHide: true });
    let log = ""; p.stdout.on("data", d => (log += d)); p.stderr.on("data", d => (log += d));
    p.on("error", reject);
    p.on("exit", code => {
      fs.writeFileSync(path.join(out, "satdump.log"), log);
      const imgs = listImages(out);
      hub.onEvent({ type: "sat", text: imgs.length ? `${s.name}: ${imgs.length} imagem(ns) gerada(s).` : `${s.name}: nenhuma imagem (sinal fraco ou passagem baixa). Log em ${out}`, images: imgs });
      code === 0 ? resolve(out) : reject(new Error(`SatDump terminou com código ${code}`));
    });
  });
}

export function listImages(dir = path.join(OUTPUT, "Satélites"), out = [], depth = 4) {
  if (depth < 0 || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listImages(p, out, depth - 1);
    else if (/\.(png|jpe?g)$/i.test(e.name)) out.push({ file: path.relative(OUTPUT, p), mtime: fs.statSync(p).mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Agendador: confere a cada 30 s se começa ou termina uma passagem marcada como automática
setInterval(async () => {
  try {
    if (current?.until && Date.now() > current.until) return void stopPass();
    if (current) return;
    const auto = readConfig().satAuto || {}, tle = await getTle(), obs = observer();
    for (const s of SATS) {
      if (!auto[s.norad] || !tle.sats[s.norad]) continue;
      const p = passes(tle.sats[s.norad], obs, 1, 10, Date.now() - 20 * 60e3).find(p => p.aos - 30e3 <= Date.now() && p.los > Date.now());
      if (p) { startPass(s.norad, p.los + 30e3); break; }
    }
  } catch {}
}, 30000);
