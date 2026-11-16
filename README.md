# 🧰 Toolbox

Site estático que reúne minhas ferramentas, sites e links. Tudo que for adicionado nas pastas abaixo **aparece sozinho** na página inicial após o push.

## Estrutura

| Pasta / arquivo | Para que serve |
|---|---|
| `tools/<nome>/` | Ferramentas (cada uma com `index.html` + `meta.json`) |
| `sites/<nome>/` | Sites completos criados por mim / pelo Claude |
| `links.json` | Links externos (artifacts do claude.ai, outros sites) |
| `scripts/build-catalog.mjs` | Varre as pastas e gera `catalog.json` |
| `.github/workflows/deploy.yml` | Gera o catálogo e publica no GitHub Pages a cada push na `main` |

## Adicionar algo novo

1. Crie `tools/minha-ferramenta/` ou `sites/meu-site/` com um `index.html`.
2. Adicione um `meta.json`:
   ```json
   {
     "title": "Minha ferramenta",
     "description": "O que ela faz.",
     "icon": "⚡",
     "tags": ["dev"]
   }
   ```
   Campos opcionais: `"url"` (aponta para fora em vez da pasta), `"updated"` (data ISO manual), `"hidden": true` (oculta).
3. Faça push na `main` → o catálogo é regenerado e o site republicado.

**Atualizar** um site existente = editar os arquivos da pasta e dar push. A data e o selo "Atualizado" (últimos 14 dias) vêm do histórico do git.

## Rodar localmente

```bash
node scripts/build-catalog.mjs
```

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Ativar o GitHub Pages (uma vez)

Settings → Pages → **Source: GitHub Actions**.
