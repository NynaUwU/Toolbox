// Temperaturas e ventoinhas.
//  - Sem nada extra: nvidia-smi (GPU NVIDIA), zonas térmicas ACPI e discos (quando o Windows permite)
//  - Completo (opcional): LibreHardwareMonitor PORTÁTIL em runtime/ — lê CPU, placa-mãe, GPU, SSD, fans.
//    Precisa rodar como administrador (o Windows pede confirmação); nada é instalado.
import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { IS_WIN, RUNTIME, TMP, findTool } from "./paths.mjs";
import { downloadTo, extractZip } from "./installer.mjs";

const LHM_DIR = path.join(RUNTIME, "librehardwaremonitor");
const LHM_PORT = 8085;
const run = (cmd, args, timeout = 10000) => new Promise(resolve =>
  execFile(cmd, args, { windowsHide: true, timeout }, (err, out) => resolve(err ? "" : String(out))));

const maxSeen = new Map(); // máximo desde que a Toolbox abriu
function track(list) {
  for (const t of list) {
    const k = `${t.hw}|${t.name}`;
    maxSeen.set(k, Math.max(maxSeen.get(k) ?? -Infinity, t.value));
    t.max = Math.max(t.max ?? -Infinity, maxSeen.get(k));
  }
  return list;
}

// ---------- LibreHardwareMonitor ----------
function lhmExe() {
  const p = path.join(LHM_DIR, "LibreHardwareMonitor.exe");
  return fs.existsSync(p) ? p : null;
}

/** Garante a configuração: servidor web ligado em 8085, inicia minimizado na bandeja. */
function writeLhmConfig() {
  const cfg = path.join(LHM_DIR, "LibreHardwareMonitor.config");
  const want = { runWebServerMenuItem: "true", listenerPort: String(LHM_PORT), startMinMenuItem: "true", minTrayMenuItem: "true", minCloseMenuItem: "true" };
  let xml = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8")
    : '<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <appSettings>\n  </appSettings>\n</configuration>\n';
  for (const [k, v] of Object.entries(want)) {
    const re = new RegExp(`<add key="${k}" value="[^"]*"\\s*/>`);
    xml = re.test(xml) ? xml.replace(re, `<add key="${k}" value="${v}" />`) : xml.replace("</appSettings>", `    <add key="${k}" value="${v}" />\n  </appSettings>`);
  }
  fs.writeFileSync(cfg, xml);
}

export async function downloadLhm(log = () => {}) {
  if (!IS_WIN) throw new Error("Disponível só no Windows.");
  if (lhmExe()) return lhmExe();
  const rel = await (await fetch("https://api.github.com/repos/LibreHardwareMonitor/LibreHardwareMonitor/releases/latest",
    { headers: { "User-Agent": "toolbox-local" } })).json();
  const zips = (rel.assets || []).filter(a => /\.zip$/i.test(a.name));
  // net472 roda no .NET Framework que já vem no Windows 10/11 (sem instalar runtime)
  const asset = zips.find(a => /net4/i.test(a.name)) || zips.find(a => /^LibreHardwareMonitor/i.test(a.name)) || zips[0];
  if (!asset) throw new Error("Não encontrei o LibreHardwareMonitor para download.");
  log(`Baixando ${asset.name}…`);
  const zip = path.join(TMP, "lhm.zip");
  await downloadTo(asset.browser_download_url, zip);
  fs.rmSync(LHM_DIR, { recursive: true, force: true });
  extractZip(zip, LHM_DIR);
  fs.rmSync(zip, { force: true });
  // Se o zip trouxe uma subpasta, sobe o conteúdo
  if (!lhmExe()) {
    const sub = fs.readdirSync(LHM_DIR).map(d => path.join(LHM_DIR, d)).find(d => fs.existsSync(path.join(d, "LibreHardwareMonitor.exe")));
    if (sub) for (const f of fs.readdirSync(sub)) fs.renameSync(path.join(sub, f), path.join(LHM_DIR, f));
  }
  if (!lhmExe()) throw new Error("LibreHardwareMonitor.exe não encontrado no zip.");
  log("✔ LibreHardwareMonitor pronto");
  return lhmExe();
}

/** Abre o LHM como administrador (o Windows mostra a confirmação UAC). */
export function startLhm() {
  const exe = lhmExe();
  if (!exe) throw new Error("Baixe o LibreHardwareMonitor primeiro.");
  writeLhmConfig();
  const ps = `Start-Process -FilePath '${exe.replace(/'/g, "''")}' -WorkingDirectory '${LHM_DIR.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Minimized`;
  spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

async function readLhm() {
  try {
    const r = await fetch(`http://127.0.0.1:${LHM_PORT}/data.json`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return null;
    const root = await r.json();
    const temps = [], fans = [], loads = [];
    const num = v => parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
    // Árvore: Sensor > PC > Hardware (> sub-hardware) > Grupo (Temperatures/Load/Fans…) > Sensor
    const walk = (node, trail) => {
      const kids = node.Children || [];
      if (!kids.length && trail.length >= 2) {
        const group = trail.at(-1), hw = trail.slice(2, -1).join(" › ") || trail.at(-2);
        const value = String(node.Value || "");
        if (/°C/.test(value) || /temperatur/i.test(group)) {
          const v = num(value);
          if (isFinite(v) && v > -50 && v < 200) temps.push({ hw, name: node.Text, value: v, max: num(node.Max) });
        } else if (/RPM/i.test(value)) {
          fans.push({ hw, name: node.Text, rpm: num(value) });
        } else if (/^load$/i.test(group) && /%/.test(value)) {
          loads.push({ hw, name: node.Text, value: num(value) });
        }
      }
      for (const c of kids) walk(c, [...trail, node.Text]);
    };
    walk(root, []);
    return { temps, fans, loads };
  } catch { return null; }
}

// ---------- Sem programas extras ----------
async function nvidia() {
  const smi = findTool("nvidia-smi") || (IS_WIN && fs.existsSync("C:\\Windows\\System32\\nvidia-smi.exe") ? "C:\\Windows\\System32\\nvidia-smi.exe" : null);
  if (!smi) return [];
  const out = await run(smi, ["--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,fan.speed,power.draw", "--format=csv,noheader,nounits"], 5000);
  return out.trim().split(/\r?\n/).filter(Boolean).map(l => {
    const [name, temp, load, memUsed, memTotal, fan, power] = l.split(",").map(x => x.trim());
    const n = x => (isFinite(parseFloat(x)) ? parseFloat(x) : null);
    return { name, temp: n(temp), load: n(load), memUsed: n(memUsed), memTotal: n(memTotal), fan: n(fan), power: n(power) };
  });
}

let basicCache = { t: 0, data: [] };
async function windowsBasic() {
  if (Date.now() - basicCache.t < 10000) return basicCache.data;
  const ps = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; $r=@();
try { Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | % { $r += @{hw='Placa-mãe (ACPI)'; name=($_.InstanceName -replace '.*\\\\',''); value=[math]::Round($_.CurrentTemperature/10-273.15,1)} } } catch {}
try { Get-PhysicalDisk -ErrorAction Stop | % { $d=$_; $c=$d | Get-StorageReliabilityCounter -ErrorAction Stop; if ($c.Temperature -gt 0) { $r += @{hw=$d.FriendlyName; name='Disco'; value=[double]$c.Temperature; max=[double]$c.TemperatureMax} } } } catch {}
ConvertTo-Json -Compress -InputObject @($r)`;
  const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], 15000);
  let data = [];
  try { data = [].concat(JSON.parse(out) || []).filter(t => t && isFinite(t.value) && t.value > -20 && t.value < 150); } catch {}
  basicCache = { t: Date.now(), data };
  return data;
}

function linuxTemps() {
  const out = [];
  try {
    for (const h of fs.readdirSync("/sys/class/hwmon")) {
      const dir = path.join("/sys/class/hwmon", h);
      const hw = fs.readFileSync(path.join(dir, "name"), "utf8").trim();
      for (const f of fs.readdirSync(dir).filter(f => /^temp\d+_input$/.test(f))) {
        const label = fs.existsSync(path.join(dir, f.replace("_input", "_label"))) ? fs.readFileSync(path.join(dir, f.replace("_input", "_label")), "utf8").trim() : f.replace("_input", "");
        out.push({ hw, name: label, value: parseInt(fs.readFileSync(path.join(dir, f), "utf8"), 10) / 1000 });
      }
    }
  } catch {}
  if (!out.length) {
    try {
      for (const z of fs.readdirSync("/sys/class/thermal").filter(z => z.startsWith("thermal_zone"))) {
        const dir = path.join("/sys/class/thermal", z);
        out.push({ hw: fs.readFileSync(path.join(dir, "type"), "utf8").trim(), name: z, value: parseInt(fs.readFileSync(path.join(dir, "temp"), "utf8"), 10) / 1000 });
      }
    } catch {}
  }
  return out;
}

/** Leitura combinada para o Gerenciador de tarefas. */
export async function sensors() {
  const [lhm, gpus] = await Promise.all([IS_WIN ? readLhm() : null, nvidia()]);
  let temps, fans = [], source;
  if (lhm) { temps = lhm.temps; fans = lhm.fans; source = "LibreHardwareMonitor"; }
  else if (IS_WIN) { temps = await windowsBasic(); source = "Windows (básico)"; }
  else { temps = linuxTemps(); source = "Linux (hwmon)"; }
  // GPU NVIDIA pelo nvidia-smi, se o LHM não estiver trazendo
  if (!lhm) for (const g of gpus) if (g.temp != null) temps.push({ hw: g.name, name: "GPU", value: g.temp });
  return {
    source, temps: track(temps), fans, gpus,
    lhm: { available: IS_WIN, downloaded: Boolean(lhmExe()), running: Boolean(lhm) },
  };
}
