// SEO checks of the built site (dist/): every indexable page has title, description, absolute canonical,
// reciprocal hreflang (en, cs, x-default), Open Graph + Twitter card, theme-color, valid JSON-LD; the 404
// page is noindex without canonical/hreflang; sitemap, robots.txt, OG images, icons and manifest are valid.
// Project sites listed in PROJECT_SEO are also checked in the simulation (.sim/site/<name>/) when present
// (npm run sim:local / check:all:local): canonical, hreflang, OG + Twitter, JSON-LD, sitemap.
// robots.txt lists only project sitemaps of sites marked "live" in project-sites.json.
// Usage: npm run check:seo   (after npm run build; project sitemaps are checked in .sim/site when present)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "node-html-parser";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const SITE = "https://arcly-studio.github.io";
const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));

let errors = 0;
const fail = (where, msg) => { console.error(`check-seo: ${where}: ${msg}`); errors++; };
const ok = (cond, where, msg) => { if (!cond) fail(where, msg); };

/** dist file for an absolute URL on this host (null for other hosts or project sites). */
const fileFor = (url) => {
  const u = new URL(url);
  if (u.origin !== SITE) return null;
  if (sites.some((s) => u.pathname.startsWith(`/${s.name}/`))) return null;
  const p = u.pathname.endsWith("/") ? `${u.pathname}index.html` : u.pathname;
  return path.join(dist, decodeURIComponent(p));
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : e.name.endsWith(".html") ? [p] : [];
});
const htmlFiles = walk(dist);
const urlOf = (file) => {
  const rel = path.relative(dist, file).replace(/\\/g, "/");
  return `${SITE}/${rel.replace(/index\.html$/, "")}`;
};

const pages = new Map(); // url → parsed info
const meta = (doc, attr, name) => doc.querySelector(`meta[${attr}="${name}"]`)?.getAttribute("content")?.trim() ?? "";

for (const file of htmlFiles) {
  const rel = path.relative(dist, file).replace(/\\/g, "/");
  const doc = parse(fs.readFileSync(file, "utf8"));
  const title = doc.querySelector("title")?.text.trim() ?? "";
  const description = meta(doc, "name", "description");
  const canonical = doc.querySelectorAll('link[rel="canonical"]').map((l) => l.getAttribute("href"));
  const alternates = Object.fromEntries(doc.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]));
  const robots = meta(doc, "name", "robots");
  ok(title, rel, "missing <title>");
  ok(doc.querySelector("html")?.getAttribute("lang"), rel, "missing <html lang>");
  ok(meta(doc, "name", "theme-color"), rel, "missing theme-color");
  ok(doc.querySelector('link[rel="icon"]'), rel, "missing favicon link");

  if (rel === "404.html") {
    ok(/noindex/.test(robots), rel, "404 must be noindex");
    ok(canonical.length === 0, rel, "404 must not have a canonical");
    ok(Object.keys(alternates).length === 0, rel, "404 must not have hreflang alternates");
    continue;
  }

  const url = urlOf(file);
  ok(!/noindex/.test(robots), rel, "indexable page is noindex");
  ok(title.length >= 20 && title.length <= 65, rel, `title length ${title.length} (20–65)`);
  ok(description.length >= 70 && description.length <= 160, rel, `description length ${description.length} (70–160)`);
  ok(canonical.length === 1, rel, `expected exactly one canonical, found ${canonical.length}`);
  ok(canonical[0] === url, rel, `canonical ${canonical[0]} ≠ ${url}`);
  for (const l of ["en", "cs", "x-default"]) ok(alternates[l]?.startsWith(`${SITE}/`), rel, `missing/relative hreflang ${l}`);
  ok(alternates["x-default"] === alternates.en, rel, "x-default should point to the English page");
  ok(Object.values(alternates).includes(url), rel, "hreflang set does not include the page itself");

  // Open Graph + Twitter
  const og = (p) => meta(doc, "property", `og:${p}`);
  for (const p of ["type", "site_name", "title", "description", "url", "locale", "locale:alternate", "image", "image:width", "image:height", "image:alt"]) ok(og(p), rel, `missing og:${p}`);
  ok(og("url") === url, rel, "og:url ≠ canonical");
  ok(og("title") === title && og("description") === description, rel, "og:title/description differ from title/description");
  ok(meta(doc, "name", "twitter:card") === "summary_large_image", rel, "twitter:card must be summary_large_image");
  ok(meta(doc, "name", "twitter:image") === og("image"), rel, "twitter:image ≠ og:image");
  const img = fileFor(og("image"));
  if (!img || !fs.existsSync(img)) fail(rel, `og:image not in dist: ${og("image")}`);
  else {
    const m = await sharp(img).metadata();
    ok(m.width === 1200 && m.height === 630, rel, `og:image is ${m.width}×${m.height}, expected 1200×630`);
    ok(String(m.width) === og("image:width") && String(m.height) === og("image:height"), rel, "og:image:width/height do not match the file");
  }
  const lang = doc.querySelector("html").getAttribute("lang");
  ok(og("locale") === (lang === "cs" ? "cs_CZ" : "en_US"), rel, `og:locale ${og("locale")} does not match lang ${lang}`);
  ok(og("locale:alternate") === (lang === "cs" ? "en_US" : "cs_CZ"), rel, `og:locale:alternate ${og("locale:alternate")} is not the other language`);

  // JSON-LD
  const ld = doc.querySelectorAll('script[type="application/ld+json"]');
  ok(ld.length > 0, rel, "missing JSON-LD");
  for (const s of ld) {
    try {
      const data = JSON.parse(s.text);
      const nodes = data["@graph"] ?? [data];
      const types = nodes.map((n) => n["@type"]);
      ok(types.includes("Organization") && types.includes("WebSite"), rel, `JSON-LD types ${types.join(", ")} – expected Organization + WebSite`);
      ok(!types.includes("SoftwareApplication"), rel, "SoftwareApplication belongs on the app sites");
      const org = nodes.find((n) => n["@type"] === "Organization") ?? {};
      const web = nodes.find((n) => n["@type"] === "WebSite") ?? {};
      const abs = (u) => typeof u === "string" && u.startsWith(`${SITE}/`);
      ok(org.name === "Arcly Studio", rel, "Organization.name");
      ok(abs(org.url) && abs(org["@id"]), rel, "Organization.url/@id must be absolute URLs on this host");
      ok(abs(org.logo?.url) && fs.existsSync(fileFor(org.logo.url)), rel, "Organization.logo.url missing or not in dist");
      ok(/^[^@\s:]+@[^@\s]+\.[a-z]{2,}$/i.test(org.email ?? ""), rel, "Organization.email must be a plain address");
      ok(org.sameAs?.includes("https://github.com/arcly-studio"), rel, "Organization.sameAs must contain the GitHub org");
      ok(abs(web.url) && web.publisher?.["@id"] === org["@id"], rel, "WebSite.url / publisher @id must point to the Organization");
      ok(!/<\/script/i.test(s.text), rel, "JSON-LD contains </script");
    } catch (e) {
      fail(rel, `JSON-LD does not parse: ${e.message}`);
    }
  }
  pages.set(url, { rel, alternates });
}

// hreflang must be reciprocal: every alternate exists and lists the same set.
for (const { rel, alternates } of pages.values()) {
  for (const [l, href] of Object.entries(alternates)) {
    const target = pages.get(href);
    if (!target) { fail(rel, `hreflang ${l} → ${href} is not an indexable page of this build`); continue; }
    ok(JSON.stringify(target.alternates) === JSON.stringify(alternates), rel, `hreflang set differs on ${target.rel}`);
  }
}

// Sitemap
const xml = (f) => fs.readFileSync(path.join(dist, f), "utf8");
const locs = (s) => [...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const index = xml("sitemap-index.xml");
const sitemapUrls = [];
for (const sm of locs(index)) {
  const f = fileFor(sm);
  if (!f || !fs.existsSync(f)) { fail("sitemap-index.xml", `${sm} missing`); continue; }
  const body = fs.readFileSync(f, "utf8");
  for (const block of body.split("<url>").slice(1)) {
    const loc = locs(block)[0];
    sitemapUrls.push(loc);
    const alt = Object.fromEntries([...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const own = pages.get(loc)?.alternates ?? {};
    ok(alt.en === own.en && alt.cs === own.cs && alt.en && alt.cs, "sitemap", `${loc}: en/cs alternates do not match the page's hreflang`);
  }
}
ok(sitemapUrls.length === pages.size && sitemapUrls.every((u) => pages.has(u)), "sitemap", `URLs ${sitemapUrls.join(", ")} ≠ indexable pages ${[...pages.keys()].join(", ")}`);
ok(!sitemapUrls.some((u) => /404/.test(u)), "sitemap", "contains the 404 page");

// robots.txt – exactly the agreed content: allow everything, own + project sitemaps of the live sites.
// Live = "live" in project-sites.json, plus the sites a simulation build marked live (dist/.sim-live.json,
// written by scripts/sim.mjs – see src/data/live.ts).
const simLive = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(dist, ".sim-live.json"), "utf8")); } catch { return []; }
})();
const isLive = (x) => x.live === true || simLive.includes(x.name);
const robots = xml("robots.txt");
const expected = ["User-agent: *", "Allow: /", "", `Sitemap: ${SITE}/sitemap-index.xml`,
  ...sites.filter((x) => x.sitemap && isLive(x)).map((x) => `Sitemap: ${SITE}/${x.name}/${x.sitemap}`), ""].join("\n");
ok(robots === expected, "robots.txt", `content differs from the agreed one:\n${robots}`);
ok(/^User-agent: \*$/m.test(robots), "robots.txt", "missing User-agent: *");
ok(!/^Disallow:\s*\S/m.test(robots), "robots.txt", "must not disallow anything");
const robotSitemaps = [...robots.matchAll(/^Sitemap: (\S+)$/gm)].map((m) => m[1]);
ok(robotSitemaps.includes(`${SITE}/sitemap-index.xml`), "robots.txt", "own sitemap missing");
const sim = path.join(root, ".sim", "site");
for (const s of sites.filter((x) => x.sitemap && isLive(x))) {
  const u = `${SITE}/${s.name}/${s.sitemap}`;
  ok(robotSitemaps.includes(u), "robots.txt", `missing ${u}`);
  if (fs.existsSync(sim)) ok(fs.existsSync(path.join(sim, s.name, s.sitemap)), "robots.txt", `${u} does not exist in the simulation`);
}

// Project sites in the simulation. Dirwise is checked in its own repo (it uses a different OG size); the
// NoirPad site lives in a worktree until phase 6, so it is checked here whenever the simulation contains it.
const PROJECT_SEO = ["noirpad"];
for (const name of PROJECT_SEO) {
  const pdir = path.join(sim, name);
  if (!fs.existsSync(path.join(pdir, "index.html"))) {
    // A live project site must be in the simulation (robots.txt and the app card point to it).
    if (isLive(sites.find((x) => x.name === name) ?? {}) && fs.existsSync(path.join(sim, "index.html"))) fail(name, "is live but missing in the simulation");
    else console.log(`check-seo: skipping /${name}/ (not in this simulation)`);
    continue;
  }
  const proot = `${SITE}/${name}/`;
  const pfile = (url) => {
    if (typeof url !== "string" || !url.startsWith(proot)) return null;
    const rel = decodeURIComponent(url.slice(proot.length).split(/[?#]/)[0]);
    return path.join(pdir, rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel);
  };
  const ppages = new Map();
  for (const file of walk(pdir)) {
    const local = path.relative(pdir, file).replace(/\\/g, "/");
    const rel = `${name}/${local}`;
    const url = `${proot}${local.replace(/index\.html$/, "")}`;
    const doc = parse(fs.readFileSync(file, "utf8"));
    const title = doc.querySelector("title")?.text.trim() ?? "";
    const description = meta(doc, "name", "description");
    const canonical = doc.querySelectorAll('link[rel="canonical"]').map((l) => l.getAttribute("href"));
    const alternates = Object.fromEntries(doc.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]));
    ok(title.length >= 20 && title.length <= 65, rel, `title length ${title.length} (20–65)`);
    ok(description.length >= 70 && description.length <= 160, rel, `description length ${description.length} (70–160)`);
    ok(meta(doc, "name", "theme-color"), rel, "missing theme-color");
    ok(doc.querySelector('link[rel="icon"]'), rel, "missing favicon link");
    ok(canonical.length === 1 && canonical[0] === url, rel, `canonical ${canonical.join(", ")} ≠ ${url}`);
    for (const l of ["en", "cs", "x-default"]) ok(alternates[l]?.startsWith(proot), rel, `missing hreflang ${l} under /${name}/`);
    ok(alternates["x-default"] === alternates.en, rel, "x-default should point to the English page");
    const og = (p) => meta(doc, "property", `og:${p}`);
    ok(og("url") === url, rel, "og:url ≠ canonical");
    ok(meta(doc, "name", "twitter:card") === "summary_large_image" && meta(doc, "name", "twitter:image") === og("image"), rel, "Twitter card");
    const img = pfile(og("image"));
    if (!img || !fs.existsSync(img)) fail(rel, `og:image not in the simulation: ${og("image")}`);
    else {
      const m = await sharp(img).metadata();
      ok(m.width === 1200 && m.height === 630, rel, `og:image is ${m.width}×${m.height}, expected 1200×630`);
    }
    const ld = doc.querySelectorAll('script[type="application/ld+json"]');
    ok(ld.length > 0, rel, "missing JSON-LD");
    for (const sc of ld) {
      try {
        const nodes = JSON.parse(sc.text)["@graph"] ?? [];
        if (local === "index.html" || local === "cs/index.html")
          ok(nodes.some((n) => n["@type"] === "SoftwareApplication" && n.publisher?.["@id"] === `${SITE}/#organization`), rel, "home page needs SoftwareApplication published by the studio organization");
        ok(!/aggregateRating|"review"/i.test(sc.text), rel, "JSON-LD must not contain ratings or reviews");
      } catch (e) {
        fail(rel, `JSON-LD does not parse: ${e.message}`);
      }
    }
    ppages.set(url, { rel, alternates });
  }
  for (const { rel, alternates } of ppages.values())
    for (const [l, href] of Object.entries(alternates))
      ok(JSON.stringify(ppages.get(href)?.alternates) === JSON.stringify(alternates), rel, `hreflang ${l} → ${href} is not reciprocal`);
  const entry = sites.find((x) => x.name === name);
  const smIndex = path.join(pdir, entry?.sitemap ?? "sitemap-index.xml");
  if (!fs.existsSync(smIndex)) fail(`${name}/sitemap`, "missing");
  else {
    const urls = locs(fs.readFileSync(smIndex, "utf8")).flatMap((sm) => {
      const f = pfile(sm);
      if (!f || !fs.existsSync(f)) { fail(`${name}/sitemap`, `${sm} missing`); return []; }
      return locs(fs.readFileSync(f, "utf8"));
    });
    ok(urls.length === ppages.size && urls.every((u) => ppages.has(u)), `${name}/sitemap`, `URLs ${urls.join(", ")} ≠ pages ${[...ppages.keys()].join(", ")}`);
  }
  console.log(`check-seo: /${name}/ in the simulation – ${ppages.size} pages, sitemap, OG, JSON-LD OK`);
}

// Icons and manifest
for (const f of ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "site.webmanifest"]) ok(fs.existsSync(path.join(dist, f)), f, "missing");
const sizeOf = async (f, w) => { const m = await sharp(path.join(dist, f)).metadata(); ok(m.width === w && m.height === w, f, `is ${m.width}×${m.height}, expected ${w}×${w}`); };
await sizeOf("apple-touch-icon.png", 180);
await sizeOf("icon-192.png", 192);
await sizeOf("icon-512.png", 512);
await sizeOf("icon-maskable-512.png", 512);
const ico = fs.readFileSync(path.join(dist, "favicon.ico"));
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
ok(ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 1 && ico[6] === 32 && ico[7] === 32,
  "favicon.ico", "header is not a single 32×32 icon");
ok(ico.readUInt32LE(18) === 22 && ico.readUInt32LE(14) + 22 === ico.length && ico.subarray(22, 30).equals(PNG_SIG),
  "favicon.ico", "image entry is not a complete PNG at offset 22");
try {
  const man = JSON.parse(xml("site.webmanifest"));
  ok(man.name && man.icons?.some((i) => i.purpose === "maskable"), "site.webmanifest", "needs name and a maskable icon");
  for (const i of man.icons ?? []) ok(fs.existsSync(path.join(dist, i.src)), "site.webmanifest", `icon ${i.src} missing`);
} catch (e) {
  fail("site.webmanifest", e.message);
}

if (errors) process.exit(1);
console.log(`check-seo: OK – ${pages.size} indexable pages + 404, sitemap (${sitemapUrls.length} URLs), robots.txt (${robotSitemaps.length} sitemaps), OG images, icons, manifest`);
