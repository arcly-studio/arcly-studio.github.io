// Local simulation of the whole host https://arcly-studio.github.io/ on http://localhost:4400/:
// the studio site at / and Dirwise at /dirwise/, served like GitHub Pages (scripts/serve-pages.mjs).
//
// The Dirwise repo is never touched: it is cloned (read-only for the source, last commit = what is
// deployed) into .sim/dirwise-src and built there with the same SITE_URL/BASE_PATH as in its CI.
// No token is needed: without GITHUB_TOKEN and without CI, Dirwise's ideas.ts builds the Ideas page
// without the list (its own fallback); release.ts falls back if the anonymous API call fails.
//
// Usage: npm run sim [-- --skip-dirwise] [--no-serve] [--port 4400] [--no-root-404] [--local-dirwise [dir]] [--local-noirpad [dir]]
//   --skip-dirwise   reuse the last Dirwise build in .sim/ (faster when only the studio site changed)
//   --no-serve       build and merge only
//   --no-root-404    serve the generic 404 under /dirwise/… (today's live behaviour)
//   --local-dirwise  build Dirwise from a working tree instead of the last commit – including uncommitted
//                    changes (default ../../Dirwise-arcly-link, the feature worktree). The tree is copied into
//                    .sim/dirwise-local without .git, node_modules and build outputs; the source is only read.
//                    `npm run sim:local-dirwise` = this flag. A relative [dir] is resolved against web/.
//   --local-noirpad  add NoirPad at /noirpad/, built from its website worktree (default ../../noirpad-site),
//                    copied the same way. `npm run sim:local-noirpad` = this flag, `npm run sim:local` = both.
// Env: DIRWISE_REPO = path to the Dirwise repo for the clone (default ../../Dirwise)
import { spawnSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPagesServer } from "./serve-pages.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

const SITE_URL = "https://arcly-studio.github.io";
const dirwiseRepo = path.resolve(root, process.env.DIRWISE_REPO ?? "../../Dirwise");
const simDir = path.join(root, ".sim");
const cloneDir = path.join(simDir, "dirwise-src");
const outDir = path.join(simDir, "site");
const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));

// Clean environment for every build: no CI flag (ideas.ts would demand a token), no tokens,
// no inherited SITE_URL/BASE_PATH.
const cleanEnv = (extra = {}) => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(CI|GITHUB_TOKEN|GH_TOKEN|SITE_URL|BASE_PATH|GITHUB_ACTIONS|INIT_CWD)$|^npm_/i.test(k)) delete env[k];
  }
  return { ...env, ...extra };
};

const run = (cmd, cmdArgs, cwd, env = cleanEnv()) => {
  console.log(`\n> ${cmd} ${cmdArgs.join(" ")}   (${path.relative(root, cwd) || "."})`);
  // npm is a .cmd shim on Windows → needs a shell; arguments here never contain spaces.
  const opts = { cwd, env, stdio: "inherit" };
  const r = cmd === "npm"
    ? spawnSync(`npm ${cmdArgs.join(" ")}`, { ...opts, shell: true })
    : spawnSync(cmd, cmdArgs, opts);
  if (r.status !== 0) {
    console.error(`sim: "${cmd} ${cmdArgs.join(" ")}" failed (exit ${r.status ?? r.error?.message})`);
    process.exit(1);
  }
};

const port = Number(opt("--port", 4400));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('sim: --port needs a number, e.g. "npm run sim -- --port 4401"');
  process.exit(1);
}

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// 1) Studio site (build includes guard + check-words). With a local NoirPad build the studio is built as if
//    NoirPad were deployed (ARCLY_SIM_LIVE, src/data/live.ts): its card leads to /noirpad/ and robots.txt lists
//    its sitemap – only in the simulation; project-sites.json ("live") stays the switch for production.
//    The marker dist/.sim-live.json tells check-seo which sites this build treats as live (a normal build
//    empties dist/, so the marker never outlives the simulation build).
const simLive = flag("--local-noirpad") ? ["noirpad"] : [];
run("npm", ["run", "build"], root, cleanEnv(simLive.length ? { ARCLY_SIM_LIVE: simLive.join(",") } : {}));
if (simLive.length) fs.writeFileSync(path.join(root, "dist", ".sim-live.json"), JSON.stringify(simLive));

/** npm ci only when the lock file changed (stamp per source), then the site build with CI-like settings. */
const buildSite = (site, stampName, basePath) => {
  const lock = path.join(site, "package-lock.json");
  const stamp = path.join(simDir, stampName);
  const hasModules = fs.existsSync(path.join(site, "node_modules"));
  if (!hasModules || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== sha(lock)) {
    run("npm", ["ci", "--no-audit", "--no-fund"], site);
    fs.writeFileSync(stamp, sha(lock));
  } else {
    console.log(`\nsim: ${basePath} dependencies unchanged – skipping npm ci`);
  }
  run("npm", ["run", "build"], site, cleanEnv({ SITE_URL, BASE_PATH: basePath }));
};

/** Fresh copy of a working tree into .sim/<dirName> (only the installed site/node_modules are kept as a
 *  cache). The source is only read. Skipped: .git (a file in worktrees), node_modules, build outputs and
 *  local bulk the site builds don't read. */
const copyTree = (src, dirName) => {
  const dest = path.join(simDir, dirName);
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(dest)) if (e !== "site") fs.rmSync(path.join(dest, e), { recursive: true, force: true });
  if (fs.existsSync(path.join(dest, "site"))) {
    for (const e of fs.readdirSync(path.join(dest, "site"))) if (e !== "node_modules") fs.rmSync(path.join(dest, "site", e), { recursive: true, force: true });
  }
  const SKIP_NAMES = new Set([".git", "node_modules", "__pycache__", ".venv"]);
  const SKIP_PATHS = new Set(["dist", "build", "target", "site/dist", "site/.astro", "src-tauri/target", "docs/demo", ".claude"].map((p) => path.join(src, p)));
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => !SKIP_NAMES.has(path.basename(p)) && !SKIP_PATHS.has(p),
    verbatimSymlinks: true, // copy links as links, never follow them back into the source
  });
  console.log(`\nsim: copied the working tree ${src} → ${path.relative(root, dest)} (without .git, node_modules, build outputs)`);
  return dest;
};

/** Value of an optional path argument ("--flag [dir]"), resolved against web/. */
const treeArg = (name, fallback) => {
  const v = opt(name, undefined);
  return path.resolve(root, v && !v.startsWith("--") ? v : fallback);
};
const requireSite = (dir, label) => {
  if (!fs.existsSync(path.join(dir, "site", "package.json"))) {
    console.error(`sim: no ${label} working tree with site/ at ${dir}`);
    process.exit(1);
  }
};

// 2) Dirwise – from a working tree (--local-dirwise) or from a clone of the last commit (default)
const localMode = flag("--local-dirwise");
const localSrc = treeArg("--local-dirwise", "../../Dirwise-arcly-link");
const localDir = path.join(simDir, "dirwise-local");
const dirwiseDist = path.join(localMode ? localDir : cloneDir, "site", "dist");
if (localMode && !flag("--skip-dirwise")) {
  requireSite(localSrc, "Dirwise");
  buildSite(path.join(copyTree(localSrc, "dirwise-local"), "site"), "dirwise-local-lock.sha256", "/dirwise");
}

// 2b) NoirPad – only from a working tree for now (--local-noirpad; site/ is not in the repo's main yet)
const noirpadMode = flag("--local-noirpad");
const noirpadSrc = treeArg("--local-noirpad", "../../noirpad-site");
const noirpadDist = path.join(simDir, "noirpad-local", "site", "dist");
if (noirpadMode) {
  requireSite(noirpadSrc, "NoirPad");
  buildSite(path.join(copyTree(noirpadSrc, "noirpad-local"), "site"), "noirpad-local-lock.sha256", "/noirpad");
  if (!fs.existsSync(path.join(noirpadDist, "index.html"))) {
    console.error(`sim: no NoirPad build in ${path.relative(root, noirpadDist)}`);
    process.exit(1);
  }
}
if (!localMode && !flag("--skip-dirwise")) {
  if (!fs.existsSync(path.join(dirwiseRepo, ".git"))) {
    console.error(`sim: Dirwise repo not found at ${dirwiseRepo} (set DIRWISE_REPO)`);
    process.exit(1);
  }
  fs.mkdirSync(simDir, { recursive: true });
  // A half-finished clone, or a clone of another repo (DIRWISE_REPO changed), is removed and cloned again.
  if (fs.existsSync(cloneDir)) {
    const origin = spawnSync("git", ["remote", "get-url", "origin"], { cwd: cloneDir, encoding: "utf8" });
    const ok = fs.existsSync(path.join(cloneDir, ".git")) && origin.status === 0 &&
      path.resolve(origin.stdout.trim()).toLowerCase() === dirwiseRepo.toLowerCase();
    if (!ok) fs.rmSync(cloneDir, { recursive: true, force: true });
  }
  if (!fs.existsSync(path.join(cloneDir, ".git"))) {
    // --no-local: use the git transport (no hardlinks into the source .git, --depth honoured)
    run("git", ["clone", "--no-local", "--depth", "1", dirwiseRepo, cloneDir], root);
  } else {
    run("git", ["fetch", "--depth", "1", "origin", "HEAD"], cloneDir);
    run("git", ["reset", "--hard", "FETCH_HEAD"], cloneDir);
    // Drop old build outputs, keep the installed dependencies.
    run("git", ["clean", "-fdx", "-e", "node_modules"], cloneDir);
  }

  buildSite(path.join(cloneDir, "site"), "dirwise-lock.sha256", "/dirwise");
}
if (!fs.existsSync(path.join(dirwiseDist, "index.html"))) {
  console.error(`sim: no Dirwise build in ${path.relative(root, dirwiseDist)} – run without --skip-dirwise`);
  process.exit(1);
}

// 3) Merge: studio at /, Dirwise at /dirwise/, NoirPad at /noirpad/ (when built). The guard has already
//    checked dist/ for collisions.
fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist"), outDir, { recursive: true });
fs.cpSync(dirwiseDist, path.join(outDir, "dirwise"), { recursive: true });
if (noirpadMode) fs.cpSync(noirpadDist, path.join(outDir, "noirpad"), { recursive: true });
console.log(`\nsim: merged → ${path.relative(root, outDir)} (studio at /, Dirwise at /dirwise/${noirpadMode ? ", NoirPad at /noirpad/" : ""})`);

// 4) Serve
if (!flag("--no-serve")) {
  createPagesServer({ dir: outDir, projects: sites.map((s) => s.name), rootFallback404: !flag("--no-root-404") })
    .listen(port, "127.0.0.1", () => {
      console.log(`\nsim: http://localhost:${port}/  ·  http://localhost:${port}/dirwise/${noirpadMode ? `  ·  http://localhost:${port}/noirpad/` : ""}  (Ctrl+C to stop)`);
    });
}
