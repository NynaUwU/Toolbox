// Fila simples de tarefas em memória (downloads e conversões).
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const jobs = new Map();

export function createJob(type, label) {
  const job = {
    id: randomUUID().slice(0, 8),
    type, label,
    status: "running", // running | done | error
    progress: null,    // 0..100 ou null (indeterminado)
    stage: "Iniciando…",
    log: [],
    files: [],
    error: null,
    started: Date.now(),
    finished: null,
  };
  jobs.set(job.id, job);
  // Mantém só as 50 tarefas mais recentes
  if (jobs.size > 50) jobs.delete(jobs.keys().next().value);
  return job;
}

export const getJob = id => jobs.get(id);
export const listJobs = () => [...jobs.values()].reverse().map(({ log, ...j }) => j);
export const hasRunning = () => [...jobs.values()].some(j => j.status === "running");

export function finishJob(job, error) {
  job.finished = Date.now();
  if (error) {
    job.status = "error";
    job.error = String(error.message || error);
    job.stage = "Erro";
  } else {
    job.status = "done";
    job.progress = 100;
    job.stage = "Concluído";
  }
}

/**
 * Executa um processo (sem shell), repassando cada linha de saída para onLine.
 * Resolve com o código de saída; rejeita se o executável não existir.
 */
export function runProcess(job, cmd, args, { onLine, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", ...env },
      windowsHide: true,
    });
    const handle = chunk => {
      for (const line of chunk.toString("utf8").split(/[\r\n]+/)) {
        if (!line.trim()) continue;
        job.log.push(line);
        if (job.log.length > 300) job.log.shift();
        onLine?.(line);
      }
    };
    child.stdout.on("data", handle);
    child.stderr.on("data", handle);
    child.on("error", reject);
    child.on("close", resolve);
  });
}
