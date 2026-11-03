// After the build: the HTML must not contain names of third-party products (same rule and regex as
// Dirwise/site/scripts/check-words.mjs, plus the standalone word "Mac"). URLs are not checked.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
// Also other notes apps and theme names taken from other products/films (the NoirPad card is on this site too –
// same list as the NoirPad website); "matrix" skips only the SVG filter attribute type="matrix".
const FORBIDDEN =
  /finder|macos|quick\s*look|explorer|průzkumník|\bmac\b|obsidian|notion|evernote|onenote|joplin|typora|simplenote|logseq|bear\s*notes|standard\s*notes|tokyo\s*night|(?<!\btype=")\bmatrix\b/gi;

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) files.push(p);
  }
};
walk(dist);
if (files.length === 0) throw new Error("check-words: no HTML in dist/");

let errors = 0;
for (const file of files) {
  const rel = path.relative(dist, file).replace(/\\/g, "/");
  const html = fs.readFileSync(file, "utf8").replace(/https?:\/\/[^\s"'<>)]+/g, "");
  for (const m of html.matchAll(FORBIDDEN)) {
    const ctx = html.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ");
    console.error(`${rel}: forbidden word "${m[0]}" … ${ctx}`);
    errors++;
  }
}
if (errors > 0) process.exit(1);
console.log(`check-words: ${files.length} HTML files without forbidden words`);
