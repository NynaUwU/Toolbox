// Editor de vídeo: análise (ffprobe), prévia compatível com o navegador e exportação com ffmpeg
// (trechos, recorte de área, rotação, escala, formato).
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { findTool, OUTPUT, TMP, safeName, uniquePath } from "./paths.mjs";
import { runProcess } from "./jobs.mjs";

const videos = new Map(); // id -> info

const probe = file => new Promise((resolve, reject) => {
  const ffprobe = findTool("ffprobe");
  if (!ffprobe) return reject(new Error("ffprobe não encontrado (vem junto com o ffmpeg)."));
  execFile(ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { windowsHide: true, maxBuffer: 16 << 20 }, (err, out) => {
    if (err) return reject(new Error("Arquivo de vídeo inválido ou não suportado."));
    resolve(JSON.parse(out));
  });
});

const PLAYABLE = new Set(["h264", "vp8", "vp9", "av1"]);

export async function register(file, originalName) {
  const info = await probe(file);
  const v = info.streams.find(s => s.codec_type === "video");
  if (!v) throw new Error("O arquivo não tem faixa de vídeo.");
  const a = info.streams.find(s => s.codec_type === "audio");
  const rot = Math.abs(parseInt(v.tags?.rotate || v.side_data_list?.find(d => d.rotation != null)?.rotation || 0, 10)) % 180 === 90;
  const ext = path.extname(originalName).slice(1).toLowerCase();
  const id = randomUUID().slice(0, 8);
  const rec = {
    id, file, name: originalName,
    duration: parseFloat(info.format.duration || v.duration || 0),
    width: rot ? v.height : v.width, height: rot ? v.width : v.height,
    fps: (() => { const [n, d] = String(v.avg_frame_rate || "30/1").split("/").map(Number); return d ? n / d : 30; })(),
    hasAudio: Boolean(a), vcodec: v.codec_name,
    needsPreview: !(["mp4", "webm", "m4v", "mov"].includes(ext) && PLAYABLE.has(v.codec_name)),
    preview: null,
  };
  videos.set(id, rec);
  return rec;
}

export const get = id => videos.get(id);

const parseTime = s => { const m = s.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };

/** Gera uma cópia leve (H.264 720p) só para pré-visualizar formatos que o navegador não toca. */
export async function makePreview(job, rec) {
  const out = path.join(TMP, `preview-${rec.id}.mp4`);
  job.stage = "Preparando a prévia (formato não suportado pelo navegador)…";
  const code = await runProcess(job, findTool("ffmpeg"), ["-hide_banner", "-y", "-i", rec.file,
    "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], {
    onLine(l) { const t = l.match(/time=(\S+)/); if (t && rec.duration) job.progress = Math.min(99, Math.round(parseTime(t[1]) / rec.duration * 100)); },
  });
  if (code !== 0) throw new Error("Falha ao gerar a prévia.");
  rec.preview = out;
}

const even = n => Math.max(2, Math.floor(n / 2) * 2);

/**
 * opts: { segments:[[ini,fim]], crop:{x,y,w,h}|null, rotate:0|90|180|270, scale:altura|0, mute, format:mp4|webm|gif|mp3, gifFps, gifWidth }
 */
export async function exportVideo(job, rec, opts) {
  const ffmpeg = findTool("ffmpeg");
  const fmt = ["mp4", "webm", "gif", "mp3"].includes(opts.format) ? opts.format : "mp4";
  let segs = (opts.segments || []).map(([a, b]) => [Math.max(0, +a), Math.min(rec.duration, +b)]).filter(([a, b]) => b - a > 0.05);
  if (!segs.length) segs = [[0, rec.duration]];
  const audio = rec.hasAudio && !opts.mute && fmt !== "gif";
  if (fmt === "mp3" && !rec.hasAudio) throw new Error("Este vídeo não tem áudio.");
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0);

  const parts = [], labels = [];
  segs.forEach(([a, b], i) => {
    if (fmt !== "mp3") { parts.push(`[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`); labels.push(`[v${i}]`); }
    if (audio) { parts.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`); labels.push(`[a${i}]`); }
  });
  const nv = fmt === "mp3" ? 0 : 1, na = audio ? 1 : 0;
  parts.push(`${labels.join("")}concat=n=${segs.length}:v=${nv}:a=${na}${nv ? "[vc]" : ""}${na ? "[ac]" : ""}`);

  const maps = [];
  if (nv) {
    const vf = [];
    if (opts.crop) {
      const c = opts.crop;
      const w = even(Math.min(c.w, rec.width)), h = even(Math.min(c.h, rec.height));
      const x = Math.max(0, Math.min(Math.round(c.x), rec.width - w)), y = Math.max(0, Math.min(Math.round(c.y), rec.height - h));
      vf.push(`crop=${w}:${h}:${x}:${y}`);
    }
    const rot = { 90: "transpose=1", 180: "transpose=1,transpose=1", 270: "transpose=2" }[opts.rotate];
    if (rot) vf.push(rot);
    if (fmt === "gif") {
      const fps = Math.min(30, Math.max(1, parseInt(opts.gifFps, 10) || 12)), w = Math.min(1280, Math.max(64, parseInt(opts.gifWidth, 10) || 480));
      vf.push(`fps=${fps}`, `scale=${w}:-2:flags=lanczos`);
      parts.push(`[vc]${vf.join(",")},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer[vout]`);
    } else {
      if (+opts.scale > 0) vf.push(`scale=-2:${even(+opts.scale)}`);
      vf.push("scale=trunc(iw/2)*2:trunc(ih/2)*2", "format=yuv420p");
      parts.push(`[vc]${vf.join(",")}[vout]`);
    }
    maps.push("-map", "[vout]");
  }
  if (na) maps.push("-map", "[ac]");

  const codec = {
    mp4: ["-c:v", "libx264", "-crf", "20", "-preset", "medium", ...(na ? ["-c:a", "aac", "-b:a", "192k"] : []), "-movflags", "+faststart"],
    webm: ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", ...(na ? ["-c:a", "libopus", "-b:a", "128k"] : [])],
    gif: ["-loop", "0"],
    mp3: ["-c:a", "libmp3lame", "-b:a", "256k"],
  }[fmt];

  const base = safeName(path.basename(rec.name, path.extname(rec.name))) + " (editado)";
  const out = uniquePath(OUTPUT, base, fmt);
  job.stage = "Exportando…";
  const code = await runProcess(job, ffmpeg, ["-hide_banner", "-y", "-i", rec.file, "-filter_complex", parts.join(";"), ...maps, ...codec, out], {
    onLine(l) { const t = l.match(/time=(\S+)/); if (t && total) job.progress = Math.min(99, Math.round(parseTime(t[1]) / total * 100)); },
  });
  if (code !== 0 || !fs.existsSync(out)) throw new Error(job.log.filter(l => /error|invalid/i.test(l)).at(-1) || "Falha ao exportar.");
  return out;
}

/** Remove vídeos enviados há mais de 12 h. */
export function cleanup() {
  for (const [id, r] of videos) {
    try { if (Date.now() - fs.statSync(r.file).mtimeMs > 12 * 3600e3) { fs.rmSync(r.file, { force: true }); if (r.preview) fs.rmSync(r.preview, { force: true }); videos.delete(id); } }
    catch { videos.delete(id); }
  }
}
