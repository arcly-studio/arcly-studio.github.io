// Announcement bar at the top of every page (Nav.astro). Change the text/link here, or set
// `enabled: false` to hide it everywhere.
import type { Localized } from "./apps";

export const announcement: { enabled: boolean; tag: Localized; text: Localized; href: Localized } = {
  enabled: true,
  tag: { en: "NEW", cs: "NOVÉ" },
  text: { en: "Dirwise is now on Microsoft Store", cs: "Dirwise je nově v Microsoft Store" },
  href: {
    en: "https://apps.microsoft.com/detail/9MZ67726S65X?mode=direct",
    cs: "https://apps.microsoft.com/detail/9MZ67726S65X?hl=cs-cz&gl=CZ&mode=direct",
  },
};
