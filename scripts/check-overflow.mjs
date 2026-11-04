// No horizontal scrolling on phones: every page of the simulation (.sim/site) is opened at 320 and 390 px in mobile
// emulation and the document must not be wider than the window (a wider element – e.g. a decorative glow –
// makes the mobile layout viewport widen and the page zoom out). Uses the installed Chrome (Playwright).
// Default: the studio pages only (project sites in a plain simulation come from their main branches).
// --projects dirwise,noirpad   also check these project sites (check:all:local – built from the worktrees)
// Usage: npm run check:overflow [-- --projects dirwise,noirpad]   (after npm run sim -- --no-serve)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { createPagesServer } from "./serve-pages.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(root, ".sim", "site");
const WIDTHS = [320, 390];
const args = process.argv.slice(2);
const projects = args.includes("--projects") ? args[args.indexOf("--projects") + 1].split(",").filter(Boolean) : [];
if (!fs.existsSync(path.join(dir, "index.html"))) {
  console.error('check-overflow: .sim/site is missing – run "npm run sim -- --no-serve" first');
  process.exit(1);
}
const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));
const names = sites.map((s) => s.name);
for (const p of projects) {
  if (!names.includes(p)) { console.error(`check-overflow: unknown project "${p}"`); process.exit(1); }
  if (!fs.existsSync(path.join(dir, p, "index.html"))) { console.error(`check-overflow: /${p}/ is not in the simulation`); process.exit(1); }
}

// Pages: every .html of the studio (outside project folders) and of the requested project sites.
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return d === dir && names.includes(e.name) && !projects.includes(e.name) ? [] : walk(p);
  return e.name.endsWith(".html") ? [p] : [];
});
const urls = walk(dir).map((f) => "/" + path.relative(dir, f).replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "$1"));

const server = createPagesServer({ dir, projects: names });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome" });
let errors = 0;
try {
  for (const url of urls.sort()) for (const WIDTH of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: "load" });
    const r = await page.evaluate((w) => ({
      width: document.documentElement.scrollWidth,
      culprits: [...document.querySelectorAll("body *")]
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
        .filter(({ b }) => b.right > w + 1 || b.left < -1)
        .slice(0, 3)
        .map(({ e, b }) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/)[0] : ""} [${Math.round(b.left)}, ${Math.round(b.right)}]`),
    }), WIDTH);
    if (r.width > WIDTH) {
      console.error(`check-overflow: ${url} is ${r.width} px wide at ${WIDTH} px – e.g. ${r.culprits.join(", ")}`);
      errors++;
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (errors) process.exit(1);
console.log(`check-overflow: ${urls.length} pages at ${WIDTHS.join(" and ")} px without horizontal scrolling${projects.length ? ` (with /${projects.join("/, /")}/)` : " (studio)"}`);
