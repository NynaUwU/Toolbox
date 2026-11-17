// Toolbox — navegação, status e atualizações
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Ordem e ícones das categorias (categorias novas vindas do meta.json entram no fim)
const CATEGORY_ORDER = ["Eletrônica", "Edição de mídia", "Mídia e arquivos", "Conversores", "Sistema e rede", "Utilitários", "Outras ferramentas", "Meus sites", "Atalhos"];
const CATEGORY_ICON = { "Eletrônica": "⚡", "Edição de mídia": "🖌️", "Mídia e arquivos": "🎞️", "Conversores": "🔄", "Sistema e rede": "🖥️", "Utilitários": "🧩", "Outras ferramentas": "🛠️", "Meus sites": "🌐", "Atalhos": "🔗" };
function categories(list) {
  const names = [...new Set(list.map(i => i.category))];
  const rank = c => (CATEGORY_ORDER.indexOf(c) + 1) || 99;
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt-BR"))
    .map(c => [c, list.filter(i => i.category === c).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"))]);
}

let items = [];
let lastVersion = null;

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const post = url => getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

// ---------- Navegação ----------
// external = site de fora · window = abre numa nova aba · demais = painel principal
const href = i => esc(i.external || i.window ? i.url : "#" + i.url);
const attrs = i => i.external || i.window ? 'target="_blank" rel="noopener"' : "";
function renderNav() {
  const q = $("#search").value.trim().toLowerCase();
  const match = i => !q || `${i.title} ${i.description}`.toLowerCase().includes(q);
  const current = location.hash.slice(1);
  $("#nav").innerHTML = categories(items.filter(match)).map(([label, list]) => {
    return `<h3>${CATEGORY_ICON[label] || "📁"} ${esc(label)}</h3>` + list.map(i =>
      `<a href="${href(i)}" ${attrs(i)}
          class="${current === i.url ? "active" : ""}" title="${esc(i.description)}">
        <span class="ico">${esc(i.icon)}</span>${esc(i.title)}${i.external || i.window ? " ↗" : ""}</a>`).join("");
  }).join("") || '<p class="empty">Nada encontrado.</p>';
}

function renderHome() {
  $("#main-title").textContent = "Início";
  $("#main-body").innerHTML = `<div class="home">` + categories(items).map(([label, list]) => {
    return `<h2>${CATEGORY_ICON[label] || "📁"} ${esc(label)}</h2><div class="tiles">` + list.map(i =>
      `<a class="tile" href="${href(i)}" ${attrs(i)}>
        <span class="ico">${esc(i.icon)}</span><b>${esc(i.title)}${i.external || i.window ? " ↗" : ""}</b>
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

// Procurar atualizações agora (botão do topo ou clique na versão)
async function checkNow() {
  const b = $("#btn-check");
  b.disabled = true; b.textContent = "⏳ Procurando…";
  try {
    const u = await post("/api/update/check");
    if (u.error) alert(`Não foi possível verificar: ${u.error}`);
    else if (!u.behind) alert(`A Toolbox já está na versão mais recente (${u.version || "—"}).`);
    else {
      const list = (u.pending || []).slice(0, 10).map(m => `• ${m}`).join("\n");
      if (confirm(`${u.behind} atualização(ões) disponível(is):\n\n${list}\n\nInstalar agora? A Toolbox reinicia sozinha.`)) {
        b.textContent = "⏳ Atualizando…";
        await post("/api/update/apply");
        b.textContent = "⏳ Reiniciando…";
        return; // a página recarrega quando o servidor voltar
      }
    }
  } catch {
    alert("Falha ao consultar o servidor.");
  }
  b.disabled = false; b.textContent = "🔍 Procurar atualizações";
  pollStatus();
}
$("#btn-check").onclick = checkNow;
$("#st-version").style.cursor = "pointer";
$("#st-version").title = "Clique para procurar atualizações";
$("#st-version").onclick = checkNow;

// ---------- Acesso pela rede (só no PC da Toolbox) ----------
async function openLan() {
  const s = await getJSON("/api/settings/lan");
  const real = s.urls.filter(u => !u.virtual);
  $("#lanUrls").innerHTML = (real.length ? real : s.urls).map(u => `<li><a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.url)}</a> <span class="muted">(${esc(u.name)})</span></li>`).join("")
    || "<li>Nenhuma rede encontrada.</li>";
  $("#lanOn").checked = s.lanAccess;
  $("#lanPwState").textContent = s.hasPassword ? "🔒 Há uma senha definida. Digite outra para trocar." : "🔓 Sem senha: qualquer aparelho da rede pode usar.";
  $("#lanPw").value = ""; $("#lanMsg").textContent = "";
  $("#lanBack").hidden = false;
}
async function saveLan(extra = {}) {
  const body = { lanAccess: $("#lanOn").checked, ...extra };
  if (!extra.clearPassword && $("#lanPw").value) body.password = $("#lanPw").value;
  await getJSON("/api/settings/lan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  $("#lanMsg").textContent = "✔ Salvo"; setTimeout(openLan, 600);
}
$("#btn-lan").onclick = openLan;
$("#lanSave").onclick = () => saveLan();
$("#lanPwClear").onclick = () => { if (confirm("Remover a senha? Qualquer aparelho da rede poderá usar a Toolbox.")) saveLan({ clearPassword: true }); };
$("#lanClose").onclick = () => { $("#lanBack").hidden = true; };
