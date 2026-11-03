# Arcly Studio website

Source of **https://arcly-studio.github.io/** – the studio home page (English at `/`, Czech at `/cs/`).
Built with [Astro](https://astro.build) as a static site for GitHub Pages. The app sites live in their own
repositories and are served next to it as project sites (`/dirwise/`, later `/noirpad/`).

## Requirements

Node.js 22.12+ (developed on Node 24) and git. Nothing is installed globally.

```sh
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload – http://localhost:4321/ (runs `scripts/prepare.mjs` first: star field, font subsets) |
| `npm run build` | `prepare`, build to `dist/`, then `guard` and `check:words` (the build fails if either fails) |
| `npm run guard` | Fails if the **root** of `dist/` contains a project-site entry (`dirwise`, `noirpad` in any case, also `<name>.html`) or a `CNAME` file; deeper paths are fine |
| `npm test` | Unit tests of the guard (`scripts/guard.test.mjs`) |
| `npm run check:words` | Fails if the HTML contains names of third-party products (same rule as the Dirwise site) |
| `npm run sim` | Simulates the whole host on http://localhost:4400/ (see below) |
| `npm run serve` | Serves the last simulation output again without rebuilding |
| `npm run screens` | With the simulation running: full-page screenshots (1440 / 390 px, reduced motion, /dirwise/ for comparison) and a scroll video into `.sim/screens/` (Playwright with the installed Chrome, no browser download) |
| `npm run check:types` | Type check (`astro check`: Astro, TS and the `.mjs` scripts) |
| `npm run check:html` | HTML validation of `dist/` (html-validate, recommended rules, `.htmlvalidate.json`) |
| `npm run check:seo` | Title, description, canonical, reciprocal hreflang, OG/Twitter, JSON-LD, 404 noindex, sitemap, robots.txt, OG image size, icons, manifest |
| `npm run check:links` | Crawls the simulated host (`.sim/site`, incl. `/dirwise/…`): every internal link and asset → 200, fragments exist, external links well-formed (`--list-external` prints them) |
| `npm run check:all` | `check:types`, `npm test`, `sim --no-serve` (build + guard + check:words + Dirwise), `guard`, `check:words`, `check:html`, `check:seo`, `check:links` |
| `npm run lighthouse` | Lighthouse on the simulation: `/`, `/cs/`, `/404.html` × mobile/desktop, reports in `.sim/lighthouse/`; fails below 95 (except SEO of the 404 page – noindex by design). Run after `npm run sim -- --no-serve`. Other pages: `-- --paths dirwise/,dirwise/cs/ --out <name>` |
| `npm run sim:local-dirwise` | Like `sim`, but Dirwise is built from the working tree `../../Dirwise-arcly-link` (incl. uncommitted changes; copied without `.git`, `node_modules`, build outputs). Another tree: `npm run sim -- --local-dirwise <dir>` |
| `npm run sim:local-noirpad` | Like `sim`, plus NoirPad at `/noirpad/` built from its website worktree `../../noirpad-site` (copied without `.git`, `node_modules`, build outputs). `npm run sim:local` = Dirwise and NoirPad both from their worktrees |
| `npm run og` | Re-renders the static OG images `public/og-en.png` / `og-cs.png` (1200×630) with the installed Chrome |

## Local simulation of the whole host

`npm run sim` reproduces what GitHub Pages will serve:

1. builds this site (`npm run build`);
2. clones the Dirwise repo (`../../Dirwise`, or `DIRWISE_REPO`) into `.sim/dirwise-src` – the original
   repo is only read, never written – and builds its `site/` with `BASE_PATH=/dirwise`, without any token
   (the Ideas page is built without its list, the release info may fall back);
3. merges both into `.sim/site/` (studio at `/`, Dirwise at `/dirwise/`);
4. serves it on http://localhost:4400/ with GitHub Pages behaviour: `/dir` → 301 `/dir/`, case-sensitive
   paths, `/name` → `name.html`, missing paths → 404 with the root `404.html`, Range requests.

Options (after `--`, e.g. `npm run sim -- --skip-dirwise`):

- `--skip-dirwise` – reuse the previous Dirwise build (only the studio site changed)
- `--no-serve` – build and merge only
- `--port <n>` – other port
- `--no-root-404` – show a generic 404 under `/dirwise/…` (today's live behaviour, no org site yet)

The simulation uses the last **commit** of the Dirwise repo, i.e. what is deployed – uncommitted changes
there are not included.

Not verifiable locally: GitHub's real rule for colliding paths and which 404 it shows under `/dirwise/`
(check with `curl` after deployment), HTTPS, GitHub's caching and network speed.

## Design

Layout, type scale, cards and motion follow the Dirwise site (`Dirwise/site/`) so the sites read as one
family – only the colours are the Arcly logo palette (token mapping at the top of `src/styles/site.css`).
Motion: `src/scripts/motion.ts` (GSAP + Lenis, bundled, no CDN); with reduced motion or without JS all
content is visible. The hero (title, text, buttons, showcase) is never hidden – it is visible on the
first paint; the intro only adds the light sweep and glow. Third-party code and fonts: [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).

## How to add a new app

1. Put the app's icon (square PNG, ≥ 80 px) and a screenshot (e.g. 1280×800 PNG) into `src/assets/apps/`.
2. Add an entry to the `apps` array in `src/data/apps.ts` (order = order on the page):
   `slug` (`[a-z0-9-]+`), `name`, `tagline` (en/cs, one sentence), `status` (`"live"` or `"coming-soon"`), optional
   `siteUrl` (en/cs – the whole card links there, otherwise to `githubUrl`), optional `storeId`, `githubUrl`,
   `socials` (tiktok / instagram / youtube), `accentColor` (6-digit hex), optional `look: "terminal"` (the only
   look so far), `icon`, `image` (`src`, `alt` en/cs, crop `focus` like `"45% 20%"`, `zoom` 1–3). Wrong values
   stop the build with a message. The card, the footer link and the app count in "About" follow automatically.
3. If the app gets its own project site on this host (`/<slug>/`), add it to `project-sites.json` (guard +
   robots.txt sitemap line).
4. Check: `npm run check:all` (types, words, links, SEO, HTML), then `npm run screens` with the
   simulation running to look at the grid.

The announcement bar at the top is configured in `src/data/announcement.ts` (text, link, `enabled`).

## SEO and icons

- Every page: title, description, absolute canonical, hreflang `en` / `cs` / `x-default`, Open Graph +
  Twitter card (`/og-en.png`, `/og-cs.png`), JSON-LD `Organization` + `WebSite` (the apps have their own
  `SoftwareApplication` data on their sites). The 404 page is `noindex` without canonical/hreflang.
- Icons from the logo, generated by `scripts/prepare.mjs`: `favicon.svg`, `favicon.ico` (32), `apple-touch-icon.png`
  (180), `icon-192/512.png`, `icon-maskable-512.png`; `public/site.webmanifest`.

## Rules

- Never add a folder or file named after a project site (`dirwise`, `noirpad`) or a `CNAME` file –
  `npm run guard` enforces it. Project sites are listed in `project-sites.json` (also used for `robots.txt`).
- `robots.txt` here governs the whole host, including `/dirwise/`. It blocks nothing.
- The 404 page is shown for any missing path on the host, so it uses only absolute links (`/`, `/cs/`, `/dirwise/`).
- No names of third-party products, no analytics, cookies or third-party requests.
