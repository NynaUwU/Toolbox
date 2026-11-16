// Gera catalog.json varrendo tools/*/meta.json, sites/*/meta.json e links.json.
// Uso: node scripts/build-catalog.mjs
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SECTIONS = [
  { dir: "tools", kind: "tool" },
  { dir: "sites", kind: "site" },
];

function lastUpdated(relPath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
    if (out) return out;
  } catch {}
  return null;
}

async function scan({ dir, kind }) {
  const base = path.join(ROOT, dir);
  if (!existsSync(base)) return [];
  const items = [];
  for (const slug of (await readdir(base)).sort()) {
    const folder = path.join(base, slug);
    if (!(await stat(folder)).isDirectory()) continue;
    const metaPath = path.join(folder, "meta.json");
    if (!existsSync(metaPath)) {
      console.warn(`⚠  ${dir}/${slug} sem meta.json — ignorado`);
      continue;
    }
    let meta;
    try {
      meta = JSON.parse(await readFile(metaPath, "utf8"));
    } catch (e) {
      console.error(`✖  ${dir}/${slug}/meta.json inválido: ${e.message}`);
      process.exitCode = 1;
      continue;
    }
    if (meta.hidden) continue;
    const fsDate = (await stat(folder)).mtime.toISOString();
    items.push({
      slug,
      kind,
      title: meta.title || slug,
      description: meta.description || "",
      icon: meta.icon || (kind === "tool" ? "🛠️" : "🌐"),
      tags: meta.tags || [],
      url: meta.url || `${dir}/${slug}/`,
      external: Boolean(meta.url),
      updated: meta.updated || lastUpdated(`${dir}/${slug}`) || fsDate,
    });
  }
  return items;
}

async function readLinks() {
  const p = path.join(ROOT, "links.json");
  if (!existsSync(p)) return [];
  const links = JSON.parse(await readFile(p, "utf8"));
  return links.map((l, i) => ({
    slug: l.slug || `link-${i}`,
    kind: "link",
    title: l.title,
    description: l.description || "",
    icon: l.icon || "🔗",
    tags: l.tags || [],
    url: l.url,
    external: true,
    updated: l.updated || null,
  }));
}

const items = [
  ...(await Promise.all(SECTIONS.map(scan))).flat(),
  ...(await readLinks()),
];

await writeFile(
  path.join(ROOT, "catalog.json"),
  JSON.stringify({ generated: new Date().toISOString(), items }, null, 2) + "\n",
);
console.log(`✔  catalog.json gerado com ${items.length} itens`);
