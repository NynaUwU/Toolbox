# 🧰 Toolbox

Central pessoal de ferramentas que roda **só no seu computador** (http://localhost:3098), com visual inspirado no Windows 98.

## O que tem

| Ferramenta | O que faz | Usa |
|---|---|---|
| 📼 YouTube Downloader | Vídeo/playlist → MP3, M4A, WAV, MP4, WEBM | yt-dlp + ffmpeg |
| 🔁 Conversor de arquivos | Word ↔ PDF, vídeo ↔ áudio, GIF ↔ vídeo, PNG/JPG/WEBP/BMP/TIFF/ICO, planilhas, apresentações | ffmpeg + LibreOffice |
| 📏 Conversor de unidades | Peso, comprimento, temperatura, volume, área, velocidade, pressão, energia, potência, tempo, dados, ângulo, torque | — |
| 💱 Conversor de moedas | 160+ moedas, guarda a última cotação para uso offline | open.er-api.com / Frankfurter |
| 🔌 Bitolas de fio | AWG ↔ mm² ↔ diâmetro, corrente (NBR 5410), queda de tensão | — |
| 🔐 🧾 🔢 | Gerador de senhas, formatador de JSON, contador de texto | — |

Arquivos baixados/convertidos vão para **`Downloads\Toolbox`** (mude com a variável `TOOLBOX_OUTPUT`).

## Instalação (Windows, uma vez)

1. Instale o Git (se ainda não tiver):
   ```
   winget install -e --id Git.Git
   ```
2. Clone o repositório onde preferir:
   ```
   git clone https://github.com/NynaUwU/Toolbox.git
   ```
3. Dê dois cliques em **`Toolbox.bat`**. Na primeira vez ele:
   - instala o Node.js (via winget) se faltar — depois é só abrir o `.bat` de novo;
   - baixa o **yt-dlp** e o **ffmpeg** para a pasta `bin\`;
   - pergunta se quer instalar o **LibreOffice** (necessário só para Word/PDF).

Para abrir sem a janela preta na frente, use **`Toolbox (minimizado).vbs`**.
Para iniciar junto com o Windows: `Win + R` → `shell:startup` → cole ali um atalho do `.vbs`.

## Atualizações automáticas

- **Ao abrir:** o `Toolbox.bat` faz `git pull` e instala dependências novas.
- **Com ela aberta:** a cada 30 min o servidor verifica o GitHub; se houver novidade e nenhuma tarefa rodando, baixa e reinicia sozinho (a página recarrega).
- **Manual:** clique na versão na barra de status, ou no botão 🔄 que aparece no topo.
- **yt-dlp:** é atualizado 1x por dia (o YouTube muda com frequência). Também há o botão *Atualizar yt-dlp* na ferramenta.

## Adicionar coisas

- **Ferramenta:** `tools/<nome>/index.html` + `meta.json`
- **Site:** `sites/<nome>/index.html` + `meta.json`
- **Atalho externo:** uma entrada em `links.json`

```json
{ "title": "Nome", "description": "O que faz", "icon": "⚡", "order": 10 }
```

Aparecem sozinhos no menu — sem build. Use `"hidden": true` para ocultar.

## Estrutura

```
Toolbox.bat            launcher (atualiza, instala, reinicia)
server.mjs             servidor local (Express, só 127.0.0.1)
lib/                   yt-dlp, conversões, tarefas, atualizador
scripts/setup.mjs      baixa/atualiza yt-dlp, ffmpeg, LibreOffice
public/                interface principal
tools/  sites/         conteúdo (cada pasta = um item)
bin/ data/ tmp/        gerados localmente (fora do git)
```
