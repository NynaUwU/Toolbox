// Chat entre os aparelhos conectados à Toolbox: conversa Geral + conversas privadas.
// Identidade: cada navegador guarda {id, secret}; o servidor guarda só o hash do segredo,
// então um aparelho não consegue se passar por outro escolhendo o mesmo id.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { DATA } from "./paths.mjs";
import { isLocal, clientIp } from "./access.mjs";

const FILE = path.join(DATA, "chat.json");
const MAX_HISTORY = 300, MAX_TEXT = 2000, MAX_NAME = 24;
const hash = s => createHash("sha256").update(String(s)).digest("hex");
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

const db = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { users: {}, general: [], dms: {} }; } })();
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(db), () => {}), 1500); };

const sockets = new Map(); // id -> Set<ws>
const dmKey = (a, b) => [a, b].sort().join("|");
const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const toUser = (id, obj) => { for (const ws of sockets.get(id) || []) send(ws, obj); };
const toAll = obj => { for (const set of sockets.values()) for (const ws of set) send(ws, obj); };

function userList() {
  return Object.entries(db.users).map(([id, u]) => ({ id, name: u.name, ip: u.ip, server: u.server, online: sockets.has(id), lastSeen: u.lastSeen }));
}
const broadcastUsers = () => toAll({ type: "users", users: userList() });

export function attachChat(ws, req) {
  let me = null;
  const ip = clientIp(req), local = isLocal(req);
  const rate = []; // limite: 10 mensagens a cada 5 s

  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === "hello") {
      // reconexão com identidade existente (se o segredo confere) ou identidade nova
      const known = m.id && db.users[m.id] && db.users[m.id].sh === hash(m.secret);
      let secret = null;
      if (known) me = m.id;
      else { me = randomUUID(); secret = randomBytes(24).toString("hex"); db.users[me] = { sh: hash(secret), name: "" }; }
      const u = db.users[me];
      u.ip = local ? "" : ip; u.server = local; u.lastSeen = Date.now();
      if (m.name && !u.name) u.name = clean(m.name, MAX_NAME);
      if (!u.name) u.name = local ? "Servidor" : `Visitante ${ip.split(".").pop() || ""}`.trim();
      if (!sockets.has(me)) sockets.set(me, new Set());
      sockets.get(me).add(ws);
      save();
      const dms = Object.fromEntries(Object.entries(db.dms).filter(([k]) => k.split("|").includes(me)).map(([k, v]) => [k.split("|").find(x => x !== me) || me, v]));
      send(ws, { type: "welcome", id: me, secret, name: u.name, general: db.general, dms, users: userList() });
      broadcastUsers();
      return;
    }
    if (!me) return;
    if (m.type === "name") {
      const name = clean(m.name, MAX_NAME);
      if (!name) return;
      db.users[me].name = name; save(); broadcastUsers();
      return;
    }
    if (m.type === "msg") {
      const text = clean(m.text, MAX_TEXT);
      if (!text) return;
      const now = Date.now();
      while (rate.length && now - rate[0] > 5000) rate.shift();
      if (rate.length >= 10) return send(ws, { type: "error", text: "Devagar: muitas mensagens em pouco tempo." });
      rate.push(now);
      const to = m.to === "*" || !m.to ? "*" : String(m.to);
      if (to !== "*" && !db.users[to]) return send(ws, { type: "error", text: "Destinatário desconhecido." });
      const msg = { id: randomUUID().slice(0, 12), from: me, to, text, time: now };
      if (to === "*") {
        db.general.push(msg); if (db.general.length > MAX_HISTORY) db.general.splice(0, db.general.length - MAX_HISTORY);
        toAll({ type: "msg", msg });
      } else {
        const k = dmKey(me, to);
        (db.dms[k] ||= []).push(msg); if (db.dms[k].length > MAX_HISTORY) db.dms[k].splice(0, db.dms[k].length - MAX_HISTORY);
        toUser(me, { type: "msg", msg }); if (to !== me) toUser(to, { type: "msg", msg });
      }
      save();
    }
  });

  ws.on("close", () => {
    if (!me) return;
    const set = sockets.get(me); set?.delete(ws);
    if (set && !set.size) { sockets.delete(me); db.users[me].lastSeen = Date.now(); save(); broadcastUsers(); }
  });
}
