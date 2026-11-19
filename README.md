# 🧰 Toolbox

Central pessoal de ferramentas que roda **só no seu computador** (http://localhost:3098), com visual inspirado no Windows 98.

## O que tem

| Ferramenta | O que faz | Usa |
|---|---|---|
| 📻 Rádio SDR (genérico) | Espectro + cascata de 24 MHz–1,7 GHz, FM/AM/SSB, decodificadores APRS, DTMF, OOK e pulsos de hora; grava áudio (WAV) e IQ | RTL-SDR (rtl_tcp portátil) |
| 🛰️ Satélites do tempo | Globo em tempo real com trajetórias, passagens, gravação automática e imagens (Meteor-M LRPT; NOAA APT desligados em 2025) | satellite.js + SatDump portátil |
| 🎛️ Controles remotos 433 MHz | Pulsos, códigos (EV1527/PT2262…) e sensores reconhecidos pelo rtl_433 (315/433/868/915 MHz) | rtl_433 portátil (opcional) |
| ✈️ Rádio (FM, aviação…) | FM, aviação AM, marítimo, radioamador, PMR, favoritos; ADS-B 1090 MHz com mapa | — |
| 📺 TV analógica | Imagem P&B de 525/625 linhas, canais VHF/UHF, foto e vídeo (WebM) | — |
| 🕰️ Relógios globais | Hora exata via NTP (NTP.br, pool…), cidades, desvio dos relógios; WWV/CHU/BPM por rádio | — |
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
| 📊 Monitor de desempenho | Consumo de hardware em tempo real: CPU (por núcleo), memória, rede e discos | — |
| 🪛 Ferramentas do Windows | Comandos para copiar e arquivos para baixar: WinUtil (Chris Titus) e atualização forçada do Windows (script próprio, baixado pela rede em `/win/update.ps1`). A Toolbox não executa nada | — |
| 📡 Dispositivos na rede | IP, nome, fabricante e MAC dos aparelhos — marca **você** (quem está acessando) e o **servidor** da Toolbox; faixa pela máscara (até /16) | sondagem TCP + tabela ARP do Windows |
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

## Rádio (RTL-SDR)

- **Driver (uma vez):** o RTL-SDR precisa do driver WinUSB no Windows — a página de qualquer ferramenta de rádio tem o botão para baixar e abrir o **Zadig** (*Options › List All Devices* → *Bulk-In, Interface (Interface 0)* → *WinUSB* → *Replace Driver*). É a única coisa instalada no sistema.
- **Programas portáteis** (baixados para `runtime\` quando você clica): rtl-sdr (`rtl_tcp`), rtl_433 e SatDump.
- **Um dongle, uma faixa por vez** (~2,4 MHz): as ferramentas compartilham o rádio — abrir uma re-sintoniza; todos que estão vendo acompanham.
- **Modo demonstração:** sem dongle, um simulador gera sinais de teste (FM, aviação, APRS, DTMF, controle 433, ADS-B, satélite, TV, WWV).
- Gravações: `Output\Rádio` (áudio), `Output\SDR\IQ`, `Output\SDR\Capturas`, `Output\SDR\Logs`, `Output\Satélites`.

## Modo jogo, NetCyties, BlockVerse e Rogue Bastion

- Botão **🎮 Modo jogo** no topo: tema escuro hi-tech e a barra lateral passa a mostrar só os jogos (🧰 volta às ferramentas).
- **NetCyties**: city builder isométrico — cada aparelho da rede (cada IP) é dono de uma cidade e só ele pode construir nela; as outras podem ser visitadas.
  Ruas, zonas residencial/comercial/industrial, parques, usina, demolir, expandir terreno, impostos e demanda RCI; a simulação roda no servidor (1 mês a cada 3 s).
  No **mapa da rede**, o roteador fica no centro e cada cidade se liga a ele por uma avenida (outras sub-redes passam por um nó próprio); ligar as ruas à entrada **AV** dá comércio com a rede.
- **BlockVerse**: mundo 3D de blocos compartilhado por todos da rede (three.js no navegador, simulação no servidor), numa janela no estilo Windows 98 (menus Jogo/Opções/Ajuda, barra de status, diálogos clássicos).
  - **Mundo de todos:** qualquer um constrói em qualquer lugar; todos nascem no mesmo ponto, ou na própria cama (tecla H volta para lá).
  - **Biomas e cavernas:** planícies, florestas (carvalho e bétula), neve (pinheiros, gelo) e deserto (arenito, cactos); cavernas com lava no fundo; minérios de carvão, ferro, ouro, Voltite e Azurite.
  - **Sobrevivência:** vida, fome, dano de queda, lava, cacto e afogamento (bolhas de ar); **modo criativo** opcional (voo, itens infinitos). Para sair da água, ande ou nade contra a beirada.
  - **Criaturas:** Capybara, Chicken (penas) e Sheep (lã) pacíficas; **Shade** (noite, queima de dia) e **Crawler** (noite e cavernas, solta linha). Hostis não nascem perto de tochas e lâmpadas.
  - **Novidades:** baú (27 espaços, compartilhado), cama (renascer e pular a noite quando todos dormem), escada, balde (encher e colocar água), arco e flechas (segure para carregar), maçã e maçã dourada, torta de abóbora, abóbora/lanterna, tijolos de pedra, blocos de ouro e Azurite, ferramentas de Azurite.
  - **Crafting em grade:** 2×2 no inventário (E) e 3×3 na bancada; a receita depende do formato (vale espelhada). Inventário com cursor: esquerdo pega/solta/junta pilhas, direito pega metade/solta 1, Shift+clique move rápido. O 📖 livro de receitas mostra o formato e coloca os ingredientes na grade.
  - Itens iguais empilham até 64 (ferramentas não empilham). Ferramentas de madeira/pedra/ferro, fornalha com espaço de entrada, combustível e saída.
  - **Plantação:** enxada → terra arada; trigo e cenoura em 8 estágios (mais rápido com água por perto); pão; mudas viram árvores.
  - **Energia:** Power Cable (sinal cai 1 por bloco), Power Core, Lever, Button, Lamp, Inverter (inverte o sinal de baixo) e Door automática.
  - Dia/noite de 10 min, luz de tochas/lâmpadas, chat no jogo. Mundo salvo em `data\blockverse`.

- **Rogue Bastion**: tower defense roguelite numa janela estilo Windows 98.
  - **Mapa aleatório** a cada run (estrada sinuosa, obstáculos e 4 temas: Meadow, Dunes, Tundra, Ashlands).
  - **8 armas** (Blaster, Cannon, Frost, Tesla, Sniper, Flamer, Missile, Laser), cada uma com 5 tiers; construir, melhorar e vender a qualquer momento, inclusive durante a wave.
  - **Moedas:** os inimigos soltam moedas que somem em poucos segundos — passe o mouse por cima para coletar.
  - **Loja entre as waves:** armas novas, novos tiers e melhorias da run (dano, cadência, alcance, juros, ímã…), com ofertas aleatórias e troca paga.
  - **9 inimigos** (voadores, blindados, escudos, curandeiros, divisores) e um chefe a cada 10 waves.
  - **Laboratório:** ao perder, a run recomeça e você ganha ◆ Data para upgrades permanentes — caros de propósito (o 1º nível custa mais ou menos uma run mediana). Salvo no servidor, por aparelho (`data\saves`).

## Chat

- Botão **💬 Chat** no topo (em qualquer ferramenta): conversa **Geral** com todos os aparelhos conectados e **privada** com cada um.
- Cada aparelho define o próprio nome; a identidade fica salva no navegador (e protegida por uma chave, ninguém se passa por outro).
- Histórico salvo no servidor (últimas 300 mensagens por conversa), contador de não lidas, aviso sonoro e notificação.

## Acesso pela rede

- Outros PCs/celulares da mesma rede abrem `http://<IP do PC>:3098` (o endereço aparece na janela do servidor e no botão **🌐 Rede**).
- No botão **🌐 Rede** (só no PC da Toolbox): ligar/desligar o acesso pela rede e definir uma senha.
- Pela rede, ficam ocultas/bloqueadas as ações que agiriam no PC da Toolbox (atualizar a Toolbox/yt-dlp, baixar o LibreOffice portátil).
- Todo arquivo gerado tem um botão **⬇ Baixar** — funciona no PC da Toolbox e em qualquer aparelho da rede.
- Na primeira vez, o Firewall do Windows pergunta sobre o `node.exe`: permita em **Redes privadas**.

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
