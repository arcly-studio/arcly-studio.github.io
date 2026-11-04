// Which project sites (/dirwise/, /noirpad/) count as deployed – the one switch is "live" in
// project-sites.json (robots.txt lists their sitemaps, the app cards link to them).
// Simulation only: `npm run sim:local` / `sim:local-noirpad` builds the studio with ARCLY_SIM_LIVE=noirpad, so the
// card leads to the local /noirpad/ copy you can click through. Production builds never set it, so
// project-sites.json alone decides there.
import projects from "../../project-sites.json";

const simLive = (process.env.ARCLY_SIM_LIVE ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const isLive = (name: string) =>
  simLive.includes(name) || projects.sites.some((s) => s.name === name && s.live === true);
