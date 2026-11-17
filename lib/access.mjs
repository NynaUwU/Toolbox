// Acesso pela rede local: quem é “local” (o próprio PC), senha opcional para os demais e
// lista de ações que só podem ser feitas no próprio PC (mexem na máquina do servidor).
import os from "node:os";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { readConfig, writeConfig } from "./paths.mjs";

const COOKIE = "tbx_auth";

/** IP de quem está acessando (sem o prefixo ::ffff: do IPv4 mapeado). */
export const clientIp = req => String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");

export function isLocal(req) {
  const a = req.socket.remoteAddress || "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

/** Configuração atual (padrão: acesso pela rede ligado, sem senha). */
export function settings() {
  const c = readConfig();
  return { lanAccess: c.lanAccess !== false, hasPassword: Boolean(c.lanPassword) };
}

export function save({ lanAccess, password, clearPassword }) {
  const patch = {};
  if (typeof lanAccess === "boolean") patch.lanAccess = lanAccess;
  if (clearPassword) { patch.lanPassword = null; patch.lanSecret = null; }
  else if (password) {
    const salt = randomBytes(16).toString("hex");
    patch.lanPassword = `${salt}:${scryptSync(String(password), salt, 32).toString("hex")}`;
    patch.lanSecret = randomBytes(32).toString("hex"); // troca a senha = derruba as sessões antigas
  }
  writeConfig(patch);
  return settings();
}

export function checkPassword(pw) {
  const stored = readConfig().lanPassword;
  if (!stored) return true;
  const [salt, hash] = stored.split(":");
  const got = scryptSync(String(pw || ""), salt, 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

const token = () => createHmac("sha256", readConfig().lanSecret || "x").update("toolbox-lan").digest("hex");
export const sessionCookie = () => `${COOKIE}=${token()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;

function hasSession(req) {
  const m = (req.get("cookie") || "").match(new RegExp(`${COOKIE}=([a-f0-9]+)`));
  if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

// Caminhos liberados sem senha (tela de login e o que ela precisa)
// + scripts do Windows (o comando “irm … | iex” roda no PowerShell, que não tem como digitar senha)
const PUBLIC = [/^\/login\.html$/, /^\/api\/login$/, /^\/vendor\/98\//, /^\/favicon/, /^\/win\/update\.ps1$/, /^\/tools\/windows\/scripts\//];

/** Middleware: o próprio PC passa direto; a rede precisa de acesso ligado e, se houver, da senha. */
export function guard(req, res, next) {
  if (isLocal(req)) return next();
  const s = settings();
  if (!s.lanAccess) return res.status(403).type("text/plain; charset=utf-8").send("Acesso pela rede desativado nesta Toolbox.");
  if (!s.hasPassword || hasSession(req) || PUBLIC.some(r => r.test(req.path))) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Senha necessária." });
  res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
}

/** Ações que mexem no PC do servidor: só no próprio PC. */
export function localOnly(req, res, next) {
  if (isLocal(req)) return next();
  res.status(403).json({ error: "Esta ação só pode ser feita no PC onde a Toolbox está rodando." });
}

/** Endereços IPv4 da máquina na rede (para mostrar o link de acesso). */
export function lanUrls(port) {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|br-|veth|Loopback/i.test(name);
      out.push({ name, url: `http://${a.address}:${port}`, virtual });
    }
  }
  return out.sort((a, b) => a.virtual - b.virtual);
}
