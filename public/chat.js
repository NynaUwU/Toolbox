// Chat entre os aparelhos conectados (painel da página principal).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const hm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

document.body.insertAdjacentHTML("beforeend", `
<div class="window" id="chatWin" hidden role="dialog" aria-label="Chat">
  <div class="title-bar"><div class="title-bar-text">💬 Chat — <span id="chatWith">Geral</span></div>
    <div class="title-bar-controls"><button aria-label="Minimize" id="chatMin" title="Minimizar"></button></div></div>
  <div class="window-body">
    <div class="chat-me"><label for="chatName">Seu nome:</label><input id="chatName" maxlength="24" placeholder="como os outros te veem"><span class="muted" id="chatState">conectando…</span></div>
    <div class="chat-main">
      <ul class="chat-users sunken-panel" id="chatUsers"></ul>
      <div class="chat-conv">
        <div class="chat-msgs sunken-panel" id="chatMsgs"></div>
        <form class="chat-form" id="chatForm"><input id="chatText" maxlength="2000" autocomplete="off" placeholder="Mensagem para todos…"><button class="default">Enviar</button></form>
      </div>
    </div>
  </div>
</div>`);

let ws = null, me = null, users = {}, current = "*", retry = 1000;
const convs = { "*": [] }, unread = {};

function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/chat`);
  ws.onopen = () => { retry = 1000; ws.send(JSON.stringify({ type: "hello", id: store.get("chat-id"), secret: store.get("chat-secret"), name: store.get("chat-name") })); };
  ws.onclose = () => { $("#chatState").textContent = "● desconectado — tentando de novo…"; setTimeout(connect, retry); retry = Math.min(15000, retry * 2); };
  ws.onmessage = e => onMsg(JSON.parse(e.data));
}

function onMsg(m) {
  if (m.type === "welcome") {
    me = m.id; if (m.secret) { store.set("chat-id", m.id); store.set("chat-secret", m.secret); }
    $("#chatName").value = m.name; store.set("chat-name", m.name);
    convs["*"] = m.general;
    for (const [other, list] of Object.entries(m.dms)) convs[other] = list;
    setUsers(m.users); renderMsgs(); $("#chatState").textContent = "";
  } else if (m.type === "users") setUsers(m.users);
  else if (m.type === "msg") {
    const k = m.msg.to === "*" ? "*" : m.msg.from === me ? m.msg.to : m.msg.from;
    (convs[k] ||= []).push(m.msg);
    const visible = !$("#chatWin").hidden && current === k;
    if (m.msg.from !== me && !visible) { unread[k] = (unread[k] || 0) + 1; beep(); notify(m.msg); }
    if (visible) renderMsgs();
    renderUsers(); badge();
  } else if (m.type === "error") { $("#chatState").textContent = m.text; setTimeout(() => ($("#chatState").textContent = ""), 4000); }
}

function setUsers(list) { users = Object.fromEntries(list.map(u => [u.id, u])); renderUsers(); renderMsgs(); }
const nameOf = id => (users[id]?.name || "?");

function renderUsers() {
  const others = Object.values(users).filter(u => u.id !== me && (u.online || convs[u.id]?.length))
    .sort((a, b) => b.online - a.online || a.name.localeCompare(b.name, "pt-BR"));
  const online = Object.values(users).filter(u => u.online).length;
  const item = (id, label, sub, on) => `<li data-c="${esc(id)}" class="${current === id ? "sel" : ""}" title="${esc(sub)}">
    <span class="dot ${on ? "on" : ""}">●</span> ${esc(label)}${unread[id] ? ` <b class="badge">${unread[id]}</b>` : ""}<small>${esc(sub)}</small></li>`;
  $("#chatUsers").innerHTML = item("*", "Geral", `${online} online`, true) +
    others.map(u => item(u.id, u.name, `${u.server ? "servidor (PC da Toolbox)" : u.ip || ""}${u.online ? "" : " · offline"}`, u.online)).join("");
}
$("#chatUsers").addEventListener("click", e => { const li = e.target.closest("[data-c]"); if (li) openConv(li.dataset.c); });

function openConv(k) {
  current = k; unread[k] = 0;
  $("#chatWith").textContent = k === "*" ? "Geral" : nameOf(k);
  $("#chatText").placeholder = k === "*" ? "Mensagem para todos…" : `Mensagem privada para ${nameOf(k)}…`;
  renderUsers(); renderMsgs(); badge(); $("#chatText").focus();
}

function renderMsgs() {
  const list = convs[current] || [], box = $("#chatMsgs");
  let lastDay = "";
  box.innerHTML = list.map(m => {
    const day = new Date(m.time).toLocaleDateString("pt-BR"), sep = day !== lastDay ? `<div class="day">${day}</div>` : ""; lastDay = day;
    return `${sep}<div class="msg ${m.from === me ? "mine" : ""}"><b>${esc(m.from === me ? "Você" : nameOf(m.from))}</b> <span class="t">${hm(m.time)}</span><div>${linkify(m.text)}</div></div>`;
  }).join("") || `<p class="muted" style="padding:6px">${current === "*" ? "Ninguém falou ainda. Diga oi para todos os aparelhos conectados!" : "Conversa privada: só vocês dois veem estas mensagens."}</p>`;
  box.scrollTop = box.scrollHeight;
}

$("#chatForm").onsubmit = e => {
  e.preventDefault();
  const text = $("#chatText").value.trim();
  if (!text || ws?.readyState !== 1) return;
  ws.send(JSON.stringify({ type: "msg", to: current, text })); $("#chatText").value = "";
};
const setName = () => {
  const n = $("#chatName").value.trim(); if (!n || n === users[me]?.name) return;
  store.set("chat-name", n); ws?.readyState === 1 && ws.send(JSON.stringify({ type: "name", name: n }));
};
$("#chatName").addEventListener("change", setName);
$("#chatName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setName(); $("#chatText").focus(); } });

// ---------- abrir/fechar, contador, aviso ----------
function badge() {
  const n = Object.values(unread).reduce((a, b) => a + b, 0);
  $("#btn-chat").innerHTML = `💬 Chat${n ? ` <b class="badge">${n}</b>` : ""}`;
}
function toggle(open = $("#chatWin").hidden) {
  $("#chatWin").hidden = !open;
  if (open) { openConv(current); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); }
}
$("#btn-chat").onclick = () => toggle();
$("#chatMin").onclick = () => toggle(false);
let actx = null;
function beep() {
  try {
    actx ||= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = 0.08;
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.09);
  } catch {}
}
function notify(m) {
  if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(`💬 ${nameOf(m.from)}${m.to === "*" ? " (Geral)" : ""}`, { body: m.text.slice(0, 120) }); } catch {}
}

connect(); badge();
