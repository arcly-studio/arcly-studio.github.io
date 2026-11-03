// Guard against breaking the project sites that share this host (https://arcly-studio.github.io/<repo>/).
// Checks ONLY the top level of the build output (default dist/, or the directory given as the first
// argument) and fails, in any letter case, on:
//   - a directory or file named after a project site (dirwise, noirpad, … from project-sites.json),
//     including "<name>.html" / "<name>.htm" (GitHub Pages serves /<name> from <name>.html);
//   - a CNAME file (a custom domain on the org site would move every project site with it).
// Anything deeper (e.g. _astro/dirwise-columns.webp, media/dirwise/…) is fine – it cannot shadow /<name>/.
// Tests: scripts/guard.test.mjs (npm test).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function reservedNames() {
  const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));
  return sites.map((s) => s.name.toLowerCase());
}

/** Returns a list of problems (empty = OK) for the top level of `dir`. */
export function checkRoot(dir, reserved = reservedNames()) {
  const names = new Set(reserved.map((n) => n.toLowerCase()));
  const problems = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const lower = e.name.toLowerCase();
    const stem = lower.replace(/\.html?$/, "");
    if (names.has(lower) || names.has(stem)) problems.push(`"${e.name}" collides with the project site /${stem}/`);
    if (lower === "cname") problems.push(`"${e.name}" would set a custom domain for the whole host`);
  }
  return problems;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(root, process.argv[2] ?? "dist");
  if (!fs.existsSync(dir)) {
    console.error(`guard: ${dir} does not exist – run the build first`);
    process.exit(1);
  }
  const reserved = reservedNames();
  const problems = checkRoot(dir, reserved);
  if (problems.length) {
    for (const p of problems) console.error(`guard: ${p}`);
    process.exit(1);
  }
  console.log(`guard: OK – no ${reserved.join("/")} entries and no CNAME at the root of ${path.relative(root, dir) || "."}`);
}
