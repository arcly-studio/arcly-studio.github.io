// Lighthouse against the production build in the simulation (.sim/site, served like GitHub Pages):
// /, /cs/ and the 404 page, mobile and desktop, all four categories. Reports (HTML + JSON) go to
// .sim/lighthouse/. Fails when a category is below 95 – except SEO on the 404 page, which is low by
// design (HTTP 404 + noindex are exactly what the "is crawlable" and "status code" audits penalise).
// Uses the installed Chrome (chrome-launcher, bundled with lighthouse). Usage: npm run lighthouse
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { createPagesServer } from "./serve-pages.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(root, ".sim", "site");
// Options: --paths /dirwise/,/dirwise/cs/  measure other pages of the simulated host instead
//          --out <name>                     report subfolder (.sim/lighthouse/<name>), e.g. dirwise-before
const cli = process.argv.slice(2);
const cliOpt = (n) => (cli.includes(n) ? cli[cli.indexOf(n) + 1] : undefined);
const outName = cliOpt("--out");
if (outName !== undefined && !/^[\w.-]+$/.test(outName) || outName === "." || outName === "..") {
  console.error('lighthouse: --out takes a plain folder name like "dirwise-before"');
  process.exit(1);
}
const reportsDir = path.join(root, ".sim", "lighthouse");
const out = path.resolve(reportsDir, outName ?? "");
// Never delete outside .sim/lighthouse (belt and braces on top of the name check).
if (out !== reportsDir && !out.startsWith(reportsDir + path.sep)) throw new Error(`lighthouse: refusing to write to ${out}`);
const MIN = 95;
if (!fs.existsSync(path.join(dir, "index.html"))) {
  console.error('lighthouse: .sim/site is missing – run "npm run sim -- --no-serve" first');
  process.exit(1);
}
// Replace only this run's reports (named runs in subfolders are kept).
if (cliOpt("--out")) fs.rmSync(out, { recursive: true, force: true });
else if (fs.existsSync(out)) for (const e of fs.readdirSync(out, { withFileTypes: true })) if (e.isFile()) fs.rmSync(path.join(out, e.name));
fs.mkdirSync(out, { recursive: true });

const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));
const server = createPagesServer({ dir, projects: sites.map((s) => s.name) });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
// Same address the server listens on (localhost could resolve to ::1 first).
const base = `http://127.0.0.1:${server.address().port}`;

// Lighthouse cannot audit a document answered with HTTP 404 (runtime error, all scores 0), so the 404 page
// is measured at /404.html – the same file, served with 200 (as on GitHub Pages).
// Paths may be given with or without the leading "/" (Git Bash rewrites "/dirwise/" into a Windows path –
// use "dirwise/,dirwise/cs/" there, or MSYS_NO_PATHCONV=1).
const toPath = (p) => `/${p.trim().replace(/^.*?\/Git\//i, "").replace(/^\/+/, "")}`;
const PAGES = cliOpt("--paths")
  ? cliOpt("--paths").split(",").map(toPath).map((p) => [p.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home", p])
  : [["home-en", "/"], ["home-cs", "/cs/"], ["404", "/404.html"]];
const CATS = ["performance", "accessibility", "best-practices", "seo"];
const rows = [];
let failed = false;

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"] });
try {
  for (const [name, url] of PAGES) {
    for (const form of ["mobile", "desktop"]) {
      const config = form === "desktop" ? desktopConfig : undefined;
      const res = await lighthouse(base + url, { port: chrome.port, output: ["html", "json"], logLevel: "error", onlyCategories: CATS }, config);
      if (res.lhr.runtimeError) throw new Error(`${url} ${form}: ${res.lhr.runtimeError.code} – ${res.lhr.runtimeError.message}`);
      const [htmlReport, jsonReport] = res.report;
      fs.writeFileSync(path.join(out, `${name}-${form}.html`), htmlReport);
      fs.writeFileSync(path.join(out, `${name}-${form}.json`), jsonReport);
      const scores = Object.fromEntries(CATS.map((c) => [c, Math.round((res.lhr.categories[c]?.score ?? 0) * 100)]));
      const exempt = name === "404" ? ["seo"] : [];
      const low = CATS.filter((c) => scores[c] < MIN && !exempt.includes(c));
      if (low.length) {
        failed = true;
        // List the failing audits of the low categories to make fixing easy.
        for (const c of low) {
          for (const ref of res.lhr.categories[c].auditRefs) {
            const a = res.lhr.audits[ref.id];
            if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`  ${name}/${form} ${c}: ${a.id} (${a.score}) – ${a.title}${a.displayValue ? ` – ${a.displayValue}` : ""}`);
          }
        }
      }
      const m = res.lhr.audits;
      rows.push({ page: url, form, ...scores, LCP: m["largest-contentful-paint"]?.displayValue, CLS: m["cumulative-layout-shift"]?.displayValue, TBT: m["total-blocking-time"]?.displayValue, note: exempt.length ? "SEO exempt (404)" : "" });
    }
  }
} finally {
  try {
    chrome.kill(); // can throw EPERM while removing its temp profile on Windows – must not hide the result
  } catch { /* ignore */ }
  server.close();
}
console.table(rows);
console.log(`lighthouse: reports in ${path.relative(root, out)}`);
if (failed) {
  console.error(`lighthouse: some category is below ${MIN}`);
  process.exit(1);
}
