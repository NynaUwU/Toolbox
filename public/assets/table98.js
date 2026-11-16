// Clique em uma linha de tabela para destacá-la (facilita a leitura).
// Ctrl/Shift + clique seleciona várias; clicar de novo desmarca. Esc limpa.
document.addEventListener("click", e => {
  const tr = e.target.closest("tbody tr");
  if (!tr || e.target.closest("a, button, input, select, textarea")) return;
  const multi = e.ctrlKey || e.metaKey || e.shiftKey;
  const was = tr.classList.contains("highlighted");
  if (!multi) tr.parentElement.querySelectorAll("tr.highlighted").forEach(r => r.classList.remove("highlighted"));
  tr.classList.toggle("highlighted", !was);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll("tr.highlighted").forEach(r => r.classList.remove("highlighted"));
});
