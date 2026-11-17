// Marca a página quando ela é aberta por OUTRO PC da rede: botões que agiriam no PC do servidor
// (abrir pasta, finalizar processo, atualizar…) recebem a classe "local-only" e somem.
(function () {
  try {
    const x = new XMLHttpRequest();
    x.open("GET", "/api/whoami", false); // síncrono de propósito: evita os botões “piscarem”
    x.send();
    const me = JSON.parse(x.responseText);
    window.TOOLBOX_LOCAL = me.local;
    if (!me.local) document.documentElement.classList.add("remote");
  } catch { window.TOOLBOX_LOCAL = true; }
})();
