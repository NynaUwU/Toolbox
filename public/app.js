// Toolbox — navegação, status e atualizações
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const GROUPS = [["tool", "Ferramentas"], ["site", "Meus sites"], ["link", "Atalhos"]];

let items = [];
let lastVersion = null;

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const post = url => getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

// ---------- Navegação ----------
// external = site de fora (nova aba) · window = abre em janela separada · demais = painel principal
const href = i => esc(i.external || i.window ? i.url : "#" + i.url);
const attrs = i => i.external ? 'target="_blank" rel="noopener"' : i.window ? `data-win="${esc(i.slug)}"` : "";
function openWindow(i) {
  const w = Math.min(i.width || 1100, screen.availWidth - 40), h = Math.min(i.height || 800, screen.availHeight - 60);
  const left = Math.max(0, (screen.availWidth - w) / 2), top = Math.max(0, (screen.availHeight - h) / 2);
  const win = window.open(i.url, `toolbox-${i.slug}`, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (win) win.focus(); else location.href = i.url; // bloqueador de pop-up: abre na própria aba
}
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-win]");
  if (!a) return;
  e.preventDefault();
  const item = items.find(i => i.slug === a.dataset.win);
  if (item) openWindow(item);
});
function renderNav() {
  const q = $("#search").value.trim().toLowerCase();
  const match = i => !q || `${i.title} ${i.description}`.toLowerCase().includes(q);
  const current = location.hash.slice(1);
  $("#nav").innerHTML = GROUPS.map(([kind, label]) => {
    const list = items.filter(i => i.kind === kind && match(i));
    if (!list.length) return "";
    return `<h3>${label}</h3>` + list.map(i =>
      `<a href="${href(i)}" ${attrs(i)}
          class="${current === i.url ? "active" : ""}" title="${esc(i.description)}">
        <span class="ico">${esc(i.icon)}</span>${esc(i.title)}${i.external ? " ↗" : i.window ? " ⧉" : ""}</a>`).join("");
  }).join("") || '<p class="empty">Nada encontrado.</p>';
}

function renderHome() {
  $("#main-title").textContent = "Início";
  $("#main-body").innerHTML = `<div class="home">` + GROUPS.map(([kind, label]) => {
    const list = items.filter(i => i.kind === kind);
    if (!list.length) return "";
    return `<h2>${label}</h2><div class="tiles">` + list.map(i =>
      `<a class="tile" href="${href(i)}" ${attrs(i)}>
        <span class="ico">${esc(i.icon)}</span><b>${esc(i.title)}${i.external ? " ↗" : i.window ? " ⧉" : ""}</b>
        <span class="desc">${esc(i.description)}</span></a>`).join("") + `</div>`;
  }).join("") + `</div>`;
}

function route() {
  const path = location.hash.slice(1);
  const item = items.find(i => !i.external && i.url === path);
  if (!item) {
    document.body.classList.remove("full");
    renderHome();
  } else {
    $("#main-title").textContent = `${item.icon} ${item.title}`;
    const frame = $("#main-body iframe");
    if (!frame || frame.dataset.src !== item.url) {
      $("#main-body").innerHTML = `<iframe src="${esc(item.url)}" data-src="${esc(item.url)}" title="${esc(item.title)}"></iframe>`;
    }
  }
  document.title = item ? `${item.title} — Toolbox` : "Toolbox";
  renderNav();
}

$("#search").addEventListener("input", renderNav);
$("#btn-close").onclick = () => { location.hash = "/"; };
$("#btn-max").onclick = () => document.body.classList.toggle("full");
$("#btn-folder").onclick = () => post("/api/open-folder");
addEventListener("hashchange", route);
addEventListener("keydown", e => { if (e.key === "Escape") document.body.classList.remove("full"); });

// ---------- Status, atualizações ----------
$("#btn-update").onclick = async () => {
  const b = $("#btn-update");
  if (!confirm("Baixar a atualização do GitHub e reiniciar a Toolbox agora?")) return;
  b.textContent = "⏳ Atualizando…";
  try {
    await post("/api/update/apply");
    b.textContent = "⏳ Reiniciando…";
  } catch {
    alert("Não foi possível atualizar. Veja a janela do servidor.");
    b.textContent = "🔄 Atualização disponível";
  }
};

async function pollStatus() {
  try {
    const s = await getJSON("/api/status");
    const t = s.tools;
    const miss = Object.entries(t).filter(([, v]) => !v.ok).map(([k]) => k);
    $("#st-tools").textContent = miss.length ? `⚠ faltando: ${miss.join(", ")}` : `✔ yt-dlp · ffmpeg · ${t.documentos.version}`;
    $("#st-tools").title = Object.entries(t).map(([k, v]) => `${k}: ${v.version || "não instalado"}`).join("\n");
    $("#st-version").textContent = `versão ${s.update.version || "—"}`;
    $("#st-jobs").textContent = s.busy ? "⏳ tarefa em andamento" : "nenhuma tarefa";
    $("#btn-update").hidden = !(s.update.behind > 0);
    $("#btn-update").title = (s.update.pending || []).join("\n");
    // Servidor reiniciou com nova versão -> recarrega a página
    if (lastVersion && s.update.version !== lastVersion) return location.reload();
    lastVersion = s.update.version;
  } catch {
    $("#st-jobs").textContent = "⚠ servidor desconectado — reconectando…";
  }
}

// ---------- Início ----------
items = (await getJSON("/api/catalog")).items;
route();
pollStatus();
setInterval(pollStatus, 15000);

// Clique na versão = verificar atualizações agora
$("#st-version").style.cursor = "pointer";
$("#st-version").title = "Clique para procurar atualizações";
$("#st-version").onclick = async () => {
  $("#st-version").textContent = "procurando atualizações…";
  try {
    const u = await post("/api/update/check");
    if (u.error) alert(u.error);
    else if (!u.behind) alert("A Toolbox já está atualizada.");
  } catch {}
  pollStatus();
};
