// Utilitário compartilhado: acompanha uma tarefa do servidor e desenha o progresso.
export async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export const post = (path, body) =>
  api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Cria um bloco de tarefa dentro de `container` e acompanha até terminar. */
export function trackJob(container, id, title) {
  const el = document.createElement("fieldset");
  el.className = "job";
  el.innerHTML = `<legend>${esc(title)}</legend>
    <div class="progress-indicator segmented indeterminate"><span class="progress-indicator-bar" style="width:0%"></span></div>
    <div class="stage">Iniciando…</div><div class="files"></div>`;
  container.prepend(el);
  const bar = el.querySelector(".progress-indicator");
  const stage = el.querySelector(".stage");
  const files = el.querySelector(".files");

  return new Promise(resolve => {
    const tick = async () => {
      let job;
      try { job = await api(`/api/jobs/${id}`); } catch { return setTimeout(tick, 2000); }
      const known = job.progress != null;
      bar.classList.toggle("indeterminate", !known && job.status === "running");
      bar.firstElementChild.style.width = `${known ? job.progress : job.status === "running" ? 0 : 100}%`;
      stage.textContent = job.status === "error" ? `✖ ${job.error}` : job.stage;
      stage.className = `stage ${job.status === "error" ? "error" : job.status === "done" ? "ok" : ""}`;
      if (job.status !== "running") {
        files.innerHTML = job.files.map(f => {
          const q = encodeURIComponent(f);
          return `<div>💾 <a href="/api/files?f=${q}" download>${esc(f)}</a>
            <button class="link local-only" data-f="${esc(f)}">mostrar na pasta</button></div>`;
        }).join("");
        files.querySelectorAll("button[data-f]").forEach(b => (b.onclick = () => post("/api/open-folder", { f: b.dataset.f })));
        if (job.status === "error" && job.log?.length) {
          const pre = document.createElement("details");
          pre.innerHTML = `<summary>Detalhes</summary><div class="log mono">${esc(job.log.join("\n"))}</div>`;
          files.append(pre);
        }
        return resolve(job);
      }
      setTimeout(tick, 700);
    };
    tick();
  });
}

export const openOutput = () => post("/api/open-folder", {});
