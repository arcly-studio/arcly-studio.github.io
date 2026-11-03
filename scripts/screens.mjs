// Screenshots and a short scroll video of the running simulation (npm run sim) for visual review.
// Uses the installed Chrome (channel "chrome") – no browser download. Output: .sim/screens/
// Usage: npm run screens [-- --base http://localhost:4400]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const base = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:4400").replace(/\/$/, "");
const out = path.join(root, ".sim", "screens");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scroll the whole page with the mouse wheel (Lenis + ScrollTrigger react to it), then back to the top. */
async function scrollThrough(page, { step = 300, pause = 120 } = {}) {
  // The pointer must be inside the viewport, otherwise wheel events do not scroll (390 px mobile).
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 80; i++) {
    const done = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    if (done) break;
    await page.mouse.wheel(0, step);
    await sleep(pause);
  }
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);
}

async function shot(browser, { name, url, width, height = 900, reduced = false, mobile = false }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const res = await page.goto(base + url, { waitUntil: "networkidle" });
  await sleep(1500); // hero intro (~1.3 s)
  if (mobile) await page.mouse.wheel(0, 10); // mobile loads the motion module on first interaction
  await scrollThrough(page);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const motion = await page.evaluate(() => document.documentElement.dataset.motion ?? "(none)");
  const hidden = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-reveal], .foot")).filter((el) => getComputedStyle(el).opacity === "0").length,
  );
  console.log(`${name}: HTTP ${res?.status()} · data-motion=${motion} · hidden reveal targets=${hidden}${errors.length ? ` · ERRORS: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, url] of [["home-en", "/"], ["home-cs", "/cs/"], ["404", "/neexistuje"]]) {
    await shot(browser, { name: `${name}-1440`, url, width: 1440 });
    await shot(browser, { name: `${name}-390`, url, width: 390, height: 844, mobile: true });
  }
  await shot(browser, { name: "home-en-1440-reduced-motion", url: "/", width: 1440, reduced: true });

  // Grid with more apps (test only – cards are cloned in the page, the site itself is not changed).
  for (const n of [3, 5]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.evaluate((n) => {
      const grid = document.querySelector(".apps-grid");
      const cards = [...grid.querySelectorAll(".app-card")];
      for (let i = cards.length; i < n; i++) {
        const c = cards[i % cards.length].cloneNode(true);
        c.querySelector(".app-link").textContent = `Test app ${i + 1}`;
        grid.append(c);
      }
      grid.dataset.count = String(n);
    }, n);
    await sleep(500);
    await page.locator("#apps").screenshot({ path: path.join(out, `apps-grid-${n}.png`) });
    console.log(`apps-grid-${n}: ${await page.evaluate(() => document.querySelectorAll(".apps-grid .app-card").length)} cards`);
    await ctx.close();
  }
  await shot(browser, { name: "dirwise-en-1440", url: "/dirwise/", width: 1440 });

  // Scroll video of the home page (1440 px, ~13 s).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await sleep(2200);
  await page.mouse.move(700, 450);
  for (let i = 0; i < 70; i++) {
    await page.mouse.wheel(0, 90);
    await sleep(130);
  }
  await sleep(1200);
  const video = page.video();
  await ctx.close();
  const target = path.join(out, "home-en-1440-scroll.webm");
  fs.renameSync(await video.path(), target);
  console.log(`video: ${path.relative(root, target)}`);
} finally {
  await browser.close();
}
console.log(`screens: ${path.relative(root, out)}`);
