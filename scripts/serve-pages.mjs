// Static server that mimics GitHub Pages closely enough to test the whole host locally.
// Behaviour (measured on the live site with curl, 2026-11-02):
//   - /dir/ serves dir/index.html; /dir (an existing directory, no slash) → 301 to /dir/
//   - /name serves name.html when it exists
//   - paths are case-sensitive (checked against real directory entries; Windows itself is not)
//   - missing path → 404 with the root 404.html (with --no-root-404: a generic page for project
//     paths, which is what /dirwise/… shows today while no org site exists)
//   - no SPA fallback; Range/206 and HEAD supported (video playback)
//   - text files (HTML, CSS, JS, SVG, XML, JSON, manifest, txt) are sent gzip-compressed when the client
//     accepts it, with "Vary: Accept-Encoding" – measured on the live Dirwise site 2026-11-03 (curl: HTML and SVG gzip, PNG not; the other text types assumed alike). This
//     keeps Lighthouse transfer sizes realistic; images, fonts and video are sent as they are.
// Usage: node scripts/serve-pages.mjs [dir=.sim/site] [--port 4400] [--no-root-404]
import http from "http";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function createPagesServer({ dir, projects = [], rootFallback404 = true }) {
  const base = path.resolve(dir);
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
  };

  const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;
  const gzipCache = new Map(); // file → { mtimeMs, body }
  const gzipped = (file) => {
    const { mtimeMs } = fs.statSync(file);
    const hit = gzipCache.get(file);
    if (hit && hit.mtimeMs === mtimeMs) return hit.body;
    const body = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
    gzipCache.set(file, { mtimeMs, body });
    return body;
  };

  // Case-sensitive lookup: each segment must match a real directory entry exactly.
  const entry = (parent, name) => {
    try {
      return fs.readdirSync(parent, { withFileTypes: true }).find((e) => e.name === name) ?? null;
    } catch {
      return null;
    }
  };
  const resolve = (segments) => {
    let cur = base;
    for (let i = 0; i < segments.length; i++) {
      const e = entry(cur, segments[i]);
      if (!e) return null;
      cur = path.join(cur, e.name);
      if (i < segments.length - 1 && !e.isDirectory()) return null;
    }
    return { file: cur, isDir: fs.statSync(cur).isDirectory() };
  };

  const send = (req, res, status, file, extraHeaders = {}) => {
    const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    const size = fs.statSync(file).size;
    const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "max-age=600", ...extraHeaders };
    const range = status === 200 && req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, ...(COMPRESSIBLE.test(type) ? { Vary: "Accept-Encoding" } : {}), "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).on("error", () => res.destroy()).pipe(res);
    }
    if (COMPRESSIBLE.test(type) && !req.headers.range && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      const body = gzipped(file);
      res.writeHead(status, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": body.length });
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    res.writeHead(status, { ...headers, "Content-Length": size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
  };

  const GENERIC_404 =
    "<!doctype html><html><head><meta charset=utf-8><title>Page not found &middot; GitHub Pages</title></head>" +
    "<body><h1>404</h1><p>File not found (simulated generic GitHub Pages 404).</p></body></html>";

  const notFound = (req, res, pathname) => {
    const first = pathname.split("/")[1] ?? "";
    const underProject = projects.includes(first);
    const custom = path.join(base, "404.html");
    if ((rootFallback404 || !underProject) && fs.existsSync(custom)) return send(req, res, 404, custom);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : GENERIC_404);
  };

  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    // Collapse leading slashes so "//host/x" is not parsed as a hostname.
    const url = new URL(req.url.replace(/^\/+/, "/"), "http://localhost");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    // Reject traversal and Windows-style separators outright.
    if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((s) => s === ".." || s === ".")) {
      res.writeHead(400);
      return res.end();
    }

    const segments = pathname.split("/").filter(Boolean);
    const hit = resolve(segments);

    if (hit?.isDir) {
      if (!pathname.endsWith("/")) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      const index = entry(hit.file, "index.html");
      if (index?.isFile()) return send(req, res, 200, path.join(hit.file, "index.html"));
      return notFound(req, res, pathname);
    }
    if (hit && !pathname.endsWith("/")) return send(req, res, 200, hit.file);

    // /name → name.html
    if (segments.length && !pathname.endsWith("/")) {
      const html = resolve([...segments.slice(0, -1), `${segments.at(-1)}.html`]);
      if (html && !html.isDir) return send(req, res, 200, html.file);
    }
    return notFound(req, res, pathname);
  });
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--port"));
  const dir = path.resolve(root, positional[0] ?? ".sim/site");
  const port = Number(opt("--port", 4400));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('serve-pages: --port needs a number, e.g. "--port 4401"');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(dir, "index.html"))) {
    console.error(`serve-pages: ${dir} has no index.html – run "npm run sim" first`);
    process.exit(1);
  }
  const { sites } = JSON.parse(fs.readFileSync(path.join(root, "project-sites.json"), "utf8"));
  createPagesServer({ dir, projects: sites.map((s) => s.name), rootFallback404: !flag("--no-root-404") })
    .listen(port, "127.0.0.1", () => console.log(`serve-pages: http://localhost:${port}/  (${dir})`));
}
