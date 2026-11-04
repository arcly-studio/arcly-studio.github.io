import type { APIRoute } from "astro";
import projects from "../../project-sites.json";
import { isLive } from "../data/live";

// robots.txt is only read at the host root, so this file governs the whole host, including the
// project sites (/dirwise/ …). It blocks nothing and lists the sitemap of every project site that is live
// ("live" in project-sites.json – a sitemap of a site that is not deployed yet would be a 404; the local
// simulation can mark a site live without touching that file, see src/data/live.ts).
export const GET: APIRoute = ({ site }) => {
  const own = new URL("sitemap-index.xml", site);
  const extra = projects.sites
    .filter((p) => p.sitemap && isLive(p.name))
    .map((p) => new URL(`${p.name}/${p.sitemap}`, site));
  const body = ["User-agent: *", "Allow: /", "", ...[own, ...extra].map((u) => `Sitemap: ${u.href}`), ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
