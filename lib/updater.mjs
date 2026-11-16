// Atualização automática a partir do GitHub (git fetch / pull).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ROOT, findTool } from "./paths.mjs";

const exec = promisify(execFile);
const git = (...args) => exec(findTool("git") || "git", ["-C", ROOT, ...args], { windowsHide: true }).then(r => r.stdout.trim());

export const state = { version: null, behind: 0, pending: [], lastCheck: null, error: null, available: true };

export async function currentVersion() {
  try {
    state.version = await git("log", "-1", "--format=%h · %cd", "--date=format:%d/%m/%Y %H:%M");
  } catch {
    state.version = "desconhecida";
    state.available = false;
  }
  return state.version;
}

export async function checkUpdates() {
  state.lastCheck = new Date().toISOString();
  try {
    await git("fetch", "--quiet", "origin");
    const behind = parseInt(await git("rev-list", "--count", "HEAD..@{u}"), 10) || 0;
    state.behind = behind;
    state.pending = behind ? (await git("log", "--format=%s", "HEAD..@{u}")).split("\n").slice(0, 20) : [];
    state.error = null;
  } catch (e) {
    state.error = "Não foi possível verificar (sem internet ou não é um clone git).";
  }
  return state;
}

/** Aplica a atualização (fast-forward). Retorna true se algo mudou. */
export async function applyUpdate() {
  const before = await git("rev-parse", "HEAD");
  await git("pull", "--ff-only", "--quiet");
  const after = await git("rev-parse", "HEAD");
  await currentVersion();
  state.behind = 0;
  state.pending = [];
  return before !== after;
}
