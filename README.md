# 🧰 Toolbox

Central pessoal de ferramentas que roda **só no seu computador** (http://localhost:3098), com visual inspirado no Windows 98.

## O que tem

| Ferramenta | O que faz | Usa |
|---|---|---|
| 🎨 Editor de imagens | Recorte (com proporções), pincel com 6 pontas (redonda, suave, quadrada, caligrafia, marca-texto, spray) e opacidade, borracha, conta-gotas, borrar/pixelar (pincel ou área), retângulos e círculos (vazados ou cheios), imagem por cima (mover/redimensionar/opacidade), girar, espelhar, redimensionar, desfazer | navegador |
| 🎬 Editor de vídeo | Linha do tempo com trechos (manter ou remover), recorte de área (16:9, 9:16, 1:1…), girar, reduzir, tirar áudio, salvar quadro como imagem; exporta MP4, WEBM, GIF ou MP3 | ffmpeg |
| 📼 YouTube Downloader | Vários links (um por linha) em fila; playlists abrem uma janela para escolher os vídeos → MP3, M4A, WAV, MP4, WEBM | yt-dlp + ffmpeg |
| 🔁 Conversor de arquivos | Word ↔ PDF, vídeo ↔ áudio, GIF ↔ vídeo, PNG/JPG/WEBP/BMP/TIFF/ICO, planilhas, apresentações | ffmpeg + Office ou LibreOffice portátil |
| 📏 Conversor de unidades | Peso, comprimento, temperatura, volume, área, velocidade, pressão, energia, potência, tempo, dados, ângulo, torque | — |
| 💱 Conversor de moedas | 160+ moedas, guarda a última cotação para uso offline | open.er-api.com / Frankfurter |
| 🔌 Bitolas de fio | AWG ↔ mm² ↔ diâmetro, corrente (NBR 5410), queda de tensão | — |
| 📘 Guia visual de eletrônica e elétrica | 46 páginas interativas, 72 projetos, 37 calculadoras — abre em nova aba | — |
| 🔌 Pinagem de conectores | 42 conectores com desenho clicável e cores de fio: USB (A/C/micro/mini), HDMI, DP, VGA, DVI, RJ45/RJ11, áudio, ATX/EPS/PCIe/SATA/Molex, GPIO, ISP, SWD, OBD-II e antigos (serial, paralela, PS/2, AT, MIDI, SCART, IDE, disquete, game port, fonte AT…) | — |
| 🔬 Simulador de circuitos | CircuitJS (Falstad, online) + calculadoras offline **com o esquema do circuito desenhado ao vivo**: Ohm, divisor, LED, código de cores, série/paralelo, RC/RL, LC, 555, bobinas | — |
| 📊 Gerenciador de tarefas | CPU (por núcleo), memória, rede, discos, **temperaturas**, processos (finalizar), informações do PC | PowerShell / netstat; LibreHardwareMonitor portátil (opcional) |
| 📡 Dispositivos na rede | IP, nome, fabricante e MAC dos aparelhos — faixa pela máscara (até /16 = 255.255.0.0) | sondagem TCP + tabela ARP do Windows |
| 🔢 Contador de texto | Caracteres, palavras, linhas, tempo de leitura | — |

Em todas as tabelas: **clique numa linha para destacá-la** (Ctrl+clique marca várias, Esc limpa).

Seus arquivos ficam em **`Output\`**, dentro da própria pasta: `YouTube\`, `Convertidos\`, `Imagens\`, `Vídeos\`, `Áudios\`. As ferramentas portáteis e dados internos ficam na raiz do programa: `runtime\` (Node, LibreOffice…), `bin\` (yt-dlp, ffmpeg), `data\` (configurações) e `tmp\`.

## Instalação (Windows) — sem instalar nada

1. No GitHub: **Code → Download ZIP** e extraia onde quiser (ex.: `Documentos\Toolbox`).
2. Dê dois cliques em **`Toolbox.bat`**. Na primeira vez ele baixa, **para dentro da própria pasta**:
   - **Node.js portátil** → `runtime\node` (~30 MB)
   - **yt-dlp** e **ffmpeg** → `bin\` (~150 MB)

Nada vai para o Windows: sem instalador, sem winget, sem admin, sem registro. Para desinstalar, apague a pasta.

**Documentos (Word/PDF/planilhas):**
- Se o PC já tem **Microsoft Office**, ele é usado automaticamente.
- Senão, o Conversor oferece **“Baixar LibreOffice portátil”**: o `.msi` oficial é só *extraído* (com o lessmsi, também portátil) para `runtime\libreoffice`, sem executar instalador.

Para abrir sem a janela preta na frente, use **`Toolbox (minimizado).vbs`**.
Para iniciar junto com o Windows: `Win + R` → `shell:startup` → cole ali um atalho do `.vbs`.

## Atualizações automáticas (sem git)

- Ao iniciar e a cada 30 min, a Toolbox consulta o GitHub. Se houver commit novo e nenhuma tarefa rodando, baixa o zip, substitui os arquivos e reinicia (a página recarrega sozinha).
- Nunca toca em `Output\`, `runtime\`, `bin\` e `data\`.
- Manual: botão **🔍 Procurar atualizações** no topo (ou clique na versão na barra de status).
- O yt-dlp se atualiza 1x por dia.
- Repositório configurado em `package.json` → `"toolbox": { "repo", "branch" }`.

## Adicionar coisas

- **Ferramenta:** `tools/<nome>/index.html` + `meta.json`
- **Site:** `sites/<nome>/index.html` + `meta.json`
- **Atalho externo:** uma entrada em `links.json`

```json
{ "title": "Nome", "description": "O que faz", "icon": "⚡", "category": "Eletrônica", "order": 10 }
```

Aparecem sozinhos no menu, agrupados pela `category` (Eletrônica, Mídia e arquivos, Conversores, Sistema e rede, Utilitários… ou uma nova) — sem build. Use `"hidden": true` para ocultar e `"window": true` para abrir em uma nova aba.

## Estrutura

```
Toolbox.bat            launcher (baixa Node portátil, inicia, reinicia após atualizar)
server.mjs             servidor local (Express, só 127.0.0.1)
lib/                   yt-dlp, conversões, Office, instalador portátil, atualizador
scripts/               get-node.ps1 (Node portátil), setup.mjs (yt-dlp, ffmpeg)
public/                interface principal
tools/  sites/         conteúdo (cada pasta = um item)
node_modules/          dependências já incluídas (dispensa npm)
Output/                seus arquivos (fora do git)
runtime/ bin/ data/    ferramentas portáteis e dados internos (fora do git)
```
