// Open Graph images (1200×630, EN + CS) in the Arcly palette with the logo and a short claim.
// Rendered once with the installed Chrome (Playwright) from HTML using the self-hosted Inter, and stored
// as static files in public/ (committed) – the build and CI do not depend on fonts being installed.
// Re-run after changing the claim or the logo: npm run og
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p));
const inter = read("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2").toString("base64");
const interExt = read("node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2").toString("base64");
const logo = read("src/assets/brand/arcly-logo-on-dark.svg").toString("utf8");

const CLAIMS = {
  en: { lines: ["SMALL. FAST.", "<em>OPEN SOURCE.</em>"], sub: "Free apps for Windows · no account · no telemetry" },
  cs: { lines: ["MALÉ. RYCHLÉ.", "<em>OPEN SOURCE.</em>"], sub: "Aplikace pro Windows zdarma · bez účtu · bez telemetrie" },
};

const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url(data:font/woff2;base64,${interExt}) format("woff2"); unicode-range: U+0100-024F; }
@font-face { font-family: Inter; font-weight: 100 900; src: url(data:font/woff2;base64,${inter}) format("woff2"); unicode-range: U+0000-00FF, U+2000-206F; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; }
body {
  position: relative; overflow: hidden; color: #eef1f7; font-family: Inter, sans-serif;
  background:
    radial-gradient(520px 360px at 78% 18%, rgba(139, 92, 246, 0.42), transparent 70%),
    radial-gradient(520px 340px at 92% 92%, rgba(244, 63, 94, 0.34), transparent 70%),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px) 0 0 / 60px 60px,
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px) 0 0 / 60px 60px,
    #0a0d16;
}
.wrap { position: absolute; inset: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
.logo svg { height: 72px; width: auto; display: block; }
h1 { font-size: 112px; line-height: 0.95; font-weight: 900; letter-spacing: -0.045em; }
h1 span { display: block; }
em { font-style: normal; padding-right: 0.06em; background: linear-gradient(120deg, #fb7185 0%, #f43f5e 35%, #8b5cf6 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
p { font-size: 30px; color: #8ea0c4; font-weight: 500; }
</style></head><body><div class="wrap">
<div class="logo">${logo}</div>
<h1>${c.lines.map((l) => `<span>${l}</span>`).join("")}</h1>
<p>${c.sub}</p>
</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  for (const [lang, c] of Object.entries(CLAIMS)) {
    await tab.setContent(page(c), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const out = path.join(root, "public", `og-${lang}.png`);
    await tab.screenshot({ path: out, type: "png" });
    console.log(`og: ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} kB)`);
  }
} finally {
  await browser.close();
}
