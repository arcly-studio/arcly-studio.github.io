// Arcly Studio site (GitHub Pages org site). In CI the address comes from actions/configure-pages
// (SITE_URL + BASE_PATH, empty base for an org site); locally the defaults below match production.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site = process.env.SITE_URL || "https://arcly-studio.github.io";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  build: { inlineStylesheets: "always" },
  integrations: [
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", cs: "cs" } },
      // The 404 page must never be in the sitemap.
      filter: (page) => !/\/404\/?$/.test(page),
    }),
  ],
  vite: {
    // Keep the license headers (/*! … */) of the bundled GSAP and Lenis (src/scripts/motion.ts) –
    // Vite 8 drops them when minifying otherwise (same setting as the Dirwise site).
    build: { rolldownOptions: { output: { comments: { legal: true } } } },
  },
});
