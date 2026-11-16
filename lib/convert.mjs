// Matriz de conversões e montagem dos comandos (ffmpeg / LibreOffice).
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { findTool, uniquePath, safeName, outDir, TMP } from "./paths.mjs";
import { runProcess } from "./jobs.mjs";
import { officeCan, officeConvert } from "./office.mjs";

const AUDIO = ["mp3", "wav", "m4a", "ogg", "flac", "opus", "aac"];
const VIDEO = ["mp4", "webm", "mkv", "avi", "mov"];
const IMAGE = ["png", "jpg", "webp", "bmp", "tiff", "ico", "gif"];

/** Para cada tipo de entrada: extensões aceitas e saídas possíveis. */
export const GROUPS = {
  video: {
    label: "Vídeo",
    inputs: ["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "m4v", "3gp", "ts", "mpg", "mpeg"],
    targets: [...AUDIO, ...VIDEO, "gif"],
    engine: "ffmpeg",
  },
  audio: {
    label: "Áudio",
    inputs: ["mp3", "wav", "m4a", "ogg", "flac", "opus", "aac", "wma", "aiff", "amr"],
    targets: [...AUDIO, "mp4", "webm"],
    engine: "ffmpeg",
  },
  gif: {
    label: "GIF animado",
    inputs: ["gif"],
    targets: ["mp4", "webm", "mkv", "png", "webp"],
    engine: "ffmpeg",
  },
  image: {
    label: "Imagem",
    inputs: ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "ico", "tga", "jfif"],
    targets: IMAGE,
    engine: "ffmpeg",
  },
  document: {
    label: "Documento",
    inputs: ["docx", "doc", "odt", "rtf", "txt", "html", "htm"],
    targets: ["pdf", "docx", "doc", "odt", "rtf", "txt", "html"],
    engine: "soffice",
  },
  pdf: {
    label: "PDF",
    inputs: ["pdf"],
    targets: ["docx", "odt", "png"],
    engine: "soffice",
  },
  sheet: {
    label: "Planilha",
    inputs: ["xlsx", "xls", "ods", "csv"],
    targets: ["pdf", "xlsx", "ods", "csv", "html"],
    engine: "soffice",
  },
  slides: {
    label: "Apresentação",
    inputs: ["pptx", "ppt", "odp"],
    targets: ["pdf", "pptx", "odp", "png"],
    engine: "soffice",
  },
};

export function groupFor(ext) {
  ext = ext.toLowerCase();
  for (const [id, g] of Object.entries(GROUPS)) if (g.inputs.includes(ext)) return { id, ...g };
  return null;
}

const AUDIO_CODEC = {
  mp3: q => ["-c:a", "libmp3lame", "-b:a", `${q}k`],
  m4a: q => ["-c:a", "aac", "-b:a", `${q}k`],
  aac: q => ["-c:a", "aac", "-b:a", `${q}k`],
  ogg: q => ["-c:a", "libvorbis", "-b:a", `${q}k`],
  opus: q => ["-c:a", "libopus", "-b:a", `${Math.min(q, 256)}k`],
  wav: () => ["-c:a", "pcm_s16le"],
  flac: () => ["-c:a", "flac"],
};

const VIDEO_CODEC = {
  mp4: crf => ["-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
  mov: crf => ["-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"],
  mkv: crf => ["-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"],
  webm: crf => ["-c:v", "libvpx-vp9", "-crf", String(crf + 10), "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k"],
  avi: () => ["-c:v", "mpeg4", "-q:v", "3", "-c:a", "libmp3lame", "-b:a", "192k"],
};

const EVEN = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Monta os argumentos do ffmpeg para (grupo de entrada -> extensão de saída). */
function ffmpegArgs(group, input, target, output, opts) {
  const a = ["-hide_banner", "-y"];
  const bitrate = clampInt(opts.bitrate, 64, 320, 320);
  const crf = clampInt(opts.crf, 16, 35, 23);
  const fps = clampInt(opts.fps, 1, 50, 12);
  const width = clampInt(opts.width, 0, 3840, 0);
  const scale = width ? `scale=${width}:-2:flags=lanczos` : null;

  // Áudio -> vídeo: fundo preto estático
  if (group === "audio" && VIDEO.includes(target)) {
    a.push("-f", "lavfi", "-i", "color=c=black:s=1280x720:r=2", "-i", input, "-shortest");
    if (target === "webm") a.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-c:a", "libopus", "-b:a", "160k");
    else a.push("-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart");
    return [...a, output];
  }

  a.push("-i", input);

  // Qualquer coisa -> áudio
  if (AUDIO.includes(target)) return [...a, "-vn", ...AUDIO_CODEC[target](bitrate), output];

  // Vídeo -> GIF (paleta otimizada)
  if (target === "gif" && group !== "image") {
    const chain = [`fps=${fps}`, scale || "scale=480:-2:flags=lanczos"].join(",");
    return [...a, "-filter_complex", `[0:v]${chain},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer`, "-loop", "0", output];
  }

  // Vídeo/GIF -> vídeo
  if (VIDEO.includes(target)) {
    const vf = [scale, EVEN].filter(Boolean).join(",");
    return [...a, "-vf", vf, ...VIDEO_CODEC[target](crf), output];
  }

  // GIF -> imagem: primeiro quadro (png) ou animado (webp)
  if (group === "gif") {
    if (target === "webp") return [...a, "-loop", "0", "-quality", "85", output];
    return [...a, "-frames:v", "1", output];
  }

  // Imagem -> imagem
  const vf = [];
  if (scale) vf.push(scale);
  if (target === "ico") vf.push("scale=256:256:force_original_aspect_ratio=decrease");
  const extra = { jpg: ["-q:v", "2"], webp: ["-quality", "90"] }[target] || [];
  if (target === "jpg") vf.push("format=yuvj444p");
  return [...a, ...(vf.length ? ["-vf", vf.join(",")] : []), ...extra, "-frames:v", "1", output];
}

const SOFFICE_FILTER = {
  pdf: "pdf",
  docx: "docx:MS Word 2007 XML",
  doc: "doc:MS Word 97",
  odt: "odt",
  rtf: "rtf",
  txt: "txt:Text (encoded):UTF8",
  html: "html",
  xlsx: "xlsx:Calc MS Excel 2007 XML",
  ods: "ods",
  csv: "csv",
  pptx: "pptx:Impress MS PowerPoint 2007 XML",
  odp: "odp",
  png: "png",
};

const parseTime = s => {
  const m = s.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
};

/** Executa a conversão; retorna o caminho do arquivo final. */
export async function convert(job, inputPath, originalName, target, opts = {}) {
  const ext = path.extname(originalName).slice(1).toLowerCase();
  const group = groupFor(ext);
  if (!group) throw new Error(`Formato .${ext} não suportado.`);
  if (!group.targets.includes(target)) throw new Error(`${group.label} não converte para .${target}.`);

  const base = safeName(path.basename(originalName, path.extname(originalName)));
  const output = uniquePath(outDir("Convertidos"), base, target);

  if (group.engine === "ffmpeg") {
    const ffmpeg = findTool("ffmpeg");
    if (!ffmpeg) throw new Error("ffmpeg não encontrado. Rode o Toolbox.bat (ou npm run setup).");
    let duration = null;
    job.stage = "Convertendo…";
    const code = await runProcess(job, ffmpeg, ffmpegArgs(group.id, inputPath, target, output, opts), {
      onLine(line) {
        if (!duration && line.includes("Duration:")) duration = parseTime(line);
        const t = line.match(/time=(\S+)/);
        if (t && duration) job.progress = Math.min(99, Math.round((parseTime(t[1]) / duration) * 100));
      },
    });
    if (code !== 0 || !fs.existsSync(output)) throw new Error(lastError(job) || `ffmpeg terminou com código ${code}`);
    return output;
  }

  // Documentos: 1º Microsoft Office já instalado, 2º LibreOffice (portátil ou do sistema)
  if (await officeCan(group.id, target)) {
    await officeConvert(job, group.id, inputPath, output, target);
    return output;
  }
  const soffice = findTool("soffice");
  if (!soffice) throw new Error("Nenhum conversor de documentos disponível. Use o botão “Baixar LibreOffice portátil” nesta ferramenta (nada é instalado no Windows).");
  const loDir = fs.mkdtempSync(path.join(TMP, "lo-"));
  const profile = pathToFileURL(path.join(TMP, "lo-profile")).href; // perfil isolado: funciona mesmo com o LibreOffice aberto
  const args = [`-env:UserInstallation=${profile}`, "--headless", "--norestore"];
  if (group.id === "pdf" && target !== "png") args.push("--infilter=writer_pdf_import");
  args.push("--convert-to", SOFFICE_FILTER[target], "--outdir", loDir, inputPath);
  job.stage = "Convertendo com LibreOffice…";
  const code = await runProcess(job, soffice, args);
  const produced = fs.readdirSync(loDir)[0];
  if (code !== 0 || !produced) {
    fs.rmSync(loDir, { recursive: true, force: true });
    throw new Error(lastError(job) || `LibreOffice terminou com código ${code}`);
  }
  fs.copyFileSync(path.join(loDir, produced), output);
  fs.rmSync(loDir, { recursive: true, force: true });
  return output;
}

function lastError(job) {
  const errs = job.log.filter(l => /error|erro|invalid|not found|failed|unable/i.test(l));
  return (errs.at(-1) || job.log.at(-1) || "").slice(0, 300);
}
