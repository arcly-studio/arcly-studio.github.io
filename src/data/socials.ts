// Social network accounts – the one place to add or change them (app cards and the footer read from here).
// Every URL was opened and checked on 3. 11. 2026. Icons are local inline SVG (src/lib/icons.ts, simple-icons),
// no embeds, widgets or scripts from the networks.
export type SocialNetwork = "tiktok" | "instagram" | "youtube";
export interface SocialAccount {
  network: SocialNetwork;
  /** Account name as shown on the network (for the accessible name: "TikTok @dirwise"). */
  handle: string;
  url: string;
}

/** Accounts per app slug (src/data/apps.ts). The studio itself has no accounts yet. */
export const socials: Record<string, SocialAccount[]> = {
  dirwise: [
    { network: "tiktok", handle: "@dirwise", url: "https://www.tiktok.com/@dirwise" },
    { network: "instagram", handle: "@dirwise.app", url: "https://www.instagram.com/dirwise.app/" },
    // TODO: YouTube channel of Dirwise – URL not known yet.
  ],
  noirpad: [
    { network: "tiktok", handle: "@noirpad", url: "https://www.tiktok.com/@noirpad" },
    { network: "instagram", handle: "@noirpad.app", url: "https://www.instagram.com/noirpad.app/" },
    { network: "youtube", handle: "@Noirpad", url: "https://www.youtube.com/@Noirpad" },
  ],
};
