// Download de vídeos/áudios com yt-dlp (+ ffmpeg para converter para MP3).
import path from "node:path";
import { findTool, BIN, OUTPUT } from "./paths.mjs";
import { runProcess } from "./jobs.mjs";

export const FORMATS = {
  mp3: { label: "MP3 (áudio)", audio: true },
  m4a: { label: "M4A (áudio, sem reconversão)", audio: true },
  wav: { label: "WAV (áudio sem perda)", audio: true },
  mp4: { label: "MP4 (vídeo)", audio: false },
  webm: { label: "WEBM (vídeo)", audio: false },
};

export async function download(job, { url, format = "mp3", quality = "best", playlist = false, bitrate = 320 }) {
  const ytdlp = findTool("yt-dlp");
  if (!ytdlp) throw new Error("yt-dlp não encontrado. Rode o Toolbox.bat (ou npm run setup).");
  if (!/^https?:\/\//i.test(url)) throw new Error("URL inválida.");
  if (!FORMATS[format]) throw new Error("Formato inválido.");

  const args = [
    "--newline", "--progress", "--no-colors", "--encoding", "utf-8",
    "--print", "after_move:FILE:%(filepath)s",
    playlist ? "--yes-playlist" : "--no-playlist",
    "-o", path.join(OUTPUT, playlist ? "%(playlist_title|Playlist)s/%(playlist_index)02d - %(title)s.%(ext)s" : "%(title)s.%(ext)s"),
    "--embed-metadata",
  ];
  const ffmpeg = findTool("ffmpeg");
  if (ffmpeg) args.push("--ffmpeg-location", path.dirname(ffmpeg));

  if (FORMATS[format].audio) {
    const q = Math.min(320, Math.max(96, parseInt(bitrate, 10) || 320));
    args.push("-f", "bestaudio/best", "-x", "--audio-format", format);
    if (format === "mp3") args.push("--audio-quality", `${q}K`, "--embed-thumbnail");
  } else {
    const h = /^\d+$/.test(quality) ? `[height<=${quality}]` : "";
    if (format === "mp4") {
      args.push("-f", `bv*${h}[ext=mp4]+ba[ext=m4a]/bv*${h}+ba/b${h}/b`, "--merge-output-format", "mp4");
    } else {
      args.push("-f", `bv*${h}[ext=webm]+ba[ext=webm]/bv*${h}+ba/b${h}/b`, "--merge-output-format", "webm");
    }
    args.push("--embed-thumbnail");
  }
  args.push("--", url);

  job.stage = "Obtendo informações…";
  let item = "";
  const code = await runProcess(job, ytdlp, args, {
    cwd: BIN,
    onLine(line) {
      const pl = line.match(/Downloading item (\d+) of (\d+)/);
      if (pl) item = ` (${pl[1]}/${pl[2]})`;
      const p = line.match(/^\[download\]\s+([\d.]+)%/);
      if (p) { job.progress = Math.min(99, Math.round(+p[1])); job.stage = `Baixando${item}… ${line.replace(/^\[download\]\s+/, "")}`; }
      if (/^\[(ExtractAudio|Merger|VideoConvertor)\]/.test(line)) { job.stage = `Convertendo${item}…`; job.progress = null; }
      if (/^\[(EmbedThumbnail|Metadata)\]/.test(line)) job.stage = `Finalizando${item}…`;
      if (line.startsWith("FILE:")) job.files.push(path.relative(OUTPUT, line.slice(5).trim()));
    },
  });
  if (code !== 0 && !job.files.length) {
    const err = job.log.filter(l => l.startsWith("ERROR")).at(-1);
    throw new Error(err ? err.replace(/^ERROR:\s*/, "") : `yt-dlp terminou com código ${code}`);
  }
}
