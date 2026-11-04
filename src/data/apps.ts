// All apps of the studio – the single source for the app cards on the home page, the footer links and
// the app count in "About". Order on the page = order in this array. How to add an app: README.md.
import type { ImageMetadata } from "astro";
import { isLive } from "./live";
import { socials, type SocialAccount } from "./socials";
import dirwiseIcon from "../assets/apps/dirwise-icon.png";
import dirwiseShot from "../assets/apps/dirwise-columns.png";
import noirpadIcon from "../assets/apps/noirpad-icon.png";
import noirpadShot from "../assets/apps/noirpad-hero.png";

export type Lang = "en" | "cs";
export type Localized = Record<Lang, string>;
export type { SocialNetwork } from "./socials";

export interface App {
  /** Id matching [a-z0-9-]+; also the project-site path if the app has its own site (/dirwise/). */
  slug: string;
  name: string;
  /** One sentence for the card. */
  tagline: Localized;
  status: "live" | "coming-soon";
  /** The app's own website. Without it the whole card links to the GitHub repo. */
  siteUrl?: Localized;
  /** Microsoft Store product id (adds a Store icon link). */
  storeId?: string;
  githubUrl: string;
  /** Accounts on social networks – from src/data/socials.ts. */
  socials: SocialAccount[];
  /** Card accent as a 6-digit hex colour (border glow, badge, hover, focus ring). */
  accentColor: string;
  /** Optional look of the card: "terminal" = monospace name and a darker green-tinted surface. */
  look?: "terminal";
  icon: ImageMetadata;
  /** Screenshot for the card preview; `focus` = crop centre like "45% 20%", `zoom` = scale 1–3. */
  image: { src: ImageMetadata; alt: Localized; focus: string; zoom: number };
}

export const apps: App[] = [
  {
    slug: "dirwise",
    name: "Dirwise",
    tagline: {
      en: "File manager with column view, tabs, split view, instant preview and a Ctrl+K command palette.",
      cs: "Správce souborů se sloupcovým zobrazením, záložkami, rozděleným oknem, rychlým náhledem a paletou Ctrl+K.",
    },
    status: "live",
    siteUrl: { en: "/dirwise/", cs: "/dirwise/cs/" },
    storeId: "9MZ67726S65X",
    githubUrl: "https://github.com/arcly-studio/dirwise",
    socials: socials.dirwise,
    accentColor: "#0a84ff",
    icon: dirwiseIcon,
    image: {
      src: dirwiseShot,
      alt: {
        en: "Dirwise in column view: folders, a file list and a preview panel",
        cs: "Dirwise ve sloupcovém zobrazení: složky, seznam souborů a panel s náhledem",
      },
      focus: "45% 20%",
      zoom: 1.25,
    },
  },
  {
    slug: "noirpad",
    name: "NoirPad",
    tagline: {
      en: "Markdown notes you can lock with a password, in a terminal look – no account, no cloud, notes stay on your PC.",
      cs: "Poznámky v Markdownu, které můžete zamknout heslem, v terminálovém vzhledu – bez účtu a cloudu, zůstávají v počítači.",
    },
    status: "coming-soon",
    // The card links to /noirpad/ only once the site is deployed – the one switch is "live" in project-sites.json
    // (in the local simulation sim.mjs sets ARCLY_SIM_LIVE=noirpad, see src/data/live.ts).
    ...(isLive("noirpad") ? { siteUrl: { en: "/noirpad/", cs: "/noirpad/cs/" } } : {}),
    githubUrl: "https://github.com/arcly-studio/noirpad",
    socials: socials.noirpad,
    accentColor: "#00ff41",
    look: "terminal",
    icon: noirpadIcon,
    image: {
      src: noirpadShot,
      alt: {
        en: "NoirPad with a note in green monospace text and a note tree on the left",
        cs: "NoirPad s poznámkou v zeleném neproporcionálním písmu, vlevo strom poznámek",
      },
      focus: "42% 12%",
      zoom: 1.3,
    },
  },
];

/** Where the whole card leads: the app's site, otherwise its GitHub repo. */
export const appHref = (app: App, lang: Lang) => app.siteUrl?.[lang] ?? app.githubUrl;

export const storeUrl = (id: string, lang: Lang) =>
  lang === "cs"
    ? `https://apps.microsoft.com/detail/${id}?hl=cs-cz&gl=CZ&mode=direct`
    : `https://apps.microsoft.com/detail/${id}?mode=direct`;
