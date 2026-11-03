// Link check of the whole simulated host (.sim/site from `npm run sim`): crawls every page reachable from
// /, /cs/ and the 404 page – including the Dirwise pages under /dirwise/ – and requires HTTP 200 (no
// redirect) for every internal link and asset (a, link, img/srcset, source, script, video, poster, meta
// images, CSS url()). Fragment links must point to an existing id. Production URLs
// (https://arcly-studio.github.io/…) count as internal. External links are only checked for a valid
// format (https, a host); mailto: for a valid address. Serves the files itself with serve-pages.mjs.
// Usage: npm run check:links
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "node-html-parser";
import { createPagesServer } from "./serve-pages.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(root, ".sim", "site");
const PROD = "https://arcly-studio.github.io";
if (!fs.existsSync(path.join(dir, "index.html"))) {
  console.error('check-links: .sim/site is missing – run "npm run sim -- --no-serve" first');
  process.exit(1);
}
const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));
const server = createPagesServer({ dir, projects: sites.map((s) => s.name) });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const errors = [];
const external = new Set();
const status = new Map(); // internal path → status
const pageIds = new Map(); // page path → Set of ids
// Start pages: the studio, its 404 and every project site present in the simulation (also those the
// studio does not link yet, e.g. /noirpad/ before its card points there).
const projectStarts = sites.map((s) => `/${s.name}/`);
for (const p of projectStarts) if (!fs.existsSync(path.join(dir, p, "index.html"))) console.log(`check-links: skipping ${p} (not in this simulation)`);
const queue = ["/", "/cs/", "/404.html", ...projectStarts.filter((p) => fs.existsSync(path.join(dir, p, "index.html")))];
const seen = new Set(queue);
const fragments = []; // [fromPage, targetPath, id]

const toInternal = (raw, from) => {
  const u = new URL(raw, BASE + from);
  if (u.origin === PROD) return { path: u.pathname + u.search, hash: u.hash };
  if (u.origin === BASE) return { path: u.pathname + u.search, hash: u.hash };
  return null;
};

const fetchStatus = async (p) => {
  if (status.has(p)) return status.get(p);
  const res = await fetch(BASE + p, { method: "GET", redirect: "manual" });
  const body = (res.headers.get("content-type") ?? "").startsWith("text/html") ? await res.text() : (await res.arrayBuffer(), null);
  const s = { code: res.status, html: body, location: res.headers.get("location") };
  status.set(p, s);
  return s;
};

const refsOf = (doc, html) => {
  const out = [];
  const add = (v, kind) => v && out.push([v.trim(), kind]);
  for (const a of doc.querySelectorAll("a[href]")) add(a.getAttribute("href"), "a");
  for (const l of doc.querySelectorAll("link[href]")) {
    const rel = l.getAttribute("rel") ?? "";
    // canonical/alternate/og URLs are production URLs of pages – still checked (mapped to the simulation).
    add(l.getAttribute("href"), `link:${rel}`);
  }
  for (const e of doc.querySelectorAll("img[src], script[src], video[src], audio[src], source[src], iframe[src]")) add(e.getAttribute("src"), e.tagName.toLowerCase());
  for (const e of doc.querySelectorAll("[srcset]")) for (const c of e.getAttribute("srcset").split(",")) add(c.trim().split(/\s+/)[0], "srcset");
  for (const e of doc.querySelectorAll("video[poster], [data-poster]")) add(e.getAttribute("poster") ?? e.getAttribute("data-poster"), "poster");
  for (const m of doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:url"]')) add(m.getAttribute("content"), "meta");
  // CSS url() in <style> and style attributes – inline data: URIs (e.g. SVG with url(#gradient)) are skipped.
  const css = html.replace(/"data:[^"]*"/g, '""');
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!m[1].startsWith("#")) add(m[1], "css");
  return out;
};

while (queue.length) {
  const page = queue.shift();
  const res = await fetchStatus(page);
  if (res.code !== 200) { errors.push(`${page}: HTTP ${res.code}`); continue; }
  if (!res.html) continue;
  const doc = parse(res.html);
  pageIds.set(page.split("#")[0], new Set(doc.querySelectorAll("[id]").map((e) => e.getAttribute("id"))));
  for (const [ref, kind] of refsOf(doc, res.html)) {
    if (ref.startsWith("mailto:")) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(ref)) errors.push(`${page}: bad mailto ${ref}`);
      continue;
    }
    if (/^(tel|javascript|data):/i.test(ref)) {
      if (/^javascript:/i.test(ref)) errors.push(`${page}: javascript: link`);
      continue;
    }
    if (ref.startsWith("#")) {
      if (ref.length > 1) fragments.push([page, page, decodeURIComponent(ref.slice(1))]);
      continue;
    }
    // Template placeholders in Dirwise's giscus / runtime-filled attributes are skipped.
    if (ref.includes("{") || ref === "") continue;
    const int = toInternal(ref, page);
    if (!int) {
      try {
        const u = new URL(ref);
        if (u.protocol !== "https:" && u.protocol !== "http:") errors.push(`${page}: unexpected scheme ${ref}`);
        else if (!u.hostname.includes(".")) errors.push(`${page}: bad host ${ref}`);
        else if (u.protocol === "http:") errors.push(`${page}: insecure external link ${ref}`);
        else external.add(u.href);
      } catch {
        errors.push(`${page}: malformed URL ${ref}`);
      }
      continue;
    }
    const r = await fetchStatus(int.path);
    if (r.code !== 200) {
      errors.push(`${page}: ${kind} ${ref} → HTTP ${r.code}${r.location ? ` → ${r.location}` : ""}`);
      continue;
    }
    if (int.hash && int.hash.length > 1) fragments.push([page, int.path, decodeURIComponent(int.hash.slice(1))]);
    if (r.html && kind === "a" && !seen.has(int.path)) {
      seen.add(int.path);
      queue.push(int.path);
    }
  }
}

for (const [from, target, id] of fragments) {
  let ids = pageIds.get(target);
  if (!ids) {
    const r = await fetchStatus(target);
    ids = new Set(r.html ? parse(r.html).querySelectorAll("[id]").map((e) => e.getAttribute("id")) : []);
    pageIds.set(target, ids);
  }
  if (!ids.has(id)) errors.push(`${from}: #${id} not found on ${target}`);
}

server.close();
const internalCount = [...status.keys()].length;
if (errors.length) {
  for (const e of [...new Set(errors)]) console.error(`check-links: ${e}`);
  console.error(`check-links: ${new Set(errors).size} problem(s)`);
  process.exit(1);
}
console.log(`check-links: OK – ${seen.size} pages crawled, ${internalCount} internal URLs → 200, ${fragments.length} fragment links, ${external.size} external links well-formed`);
if (process.argv.includes("--list-external")) for (const u of [...external].sort()) console.log(`  ${u}`);
