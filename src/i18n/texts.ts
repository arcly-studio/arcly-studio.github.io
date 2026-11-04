// All page copy, English and Czech. Short and concrete; no names of third-party products
// (scripts/check-words.mjs enforces it on the built HTML). App names, taglines and links live in
// src/data/apps.ts, the announcement bar in src/data/announcement.ts.
import type { Lang } from "../data/apps";
export type { Lang };

export const texts = {
  en: {
    htmlLang: "en",
    ogLocale: "en_US",
    title: "Arcly Studio – small, fast, open-source apps for Windows",
    description:
      "Independent one-developer studio making free, open-source Windows apps: the Dirwise file manager and NoirPad, Markdown notes you can lock with a password.",
    ogAlt: "Arcly Studio – Small. Fast. Open source. Free apps for Windows.",
    skip: "Skip to content",
    langSwitch: "Language",
    nav: { apps: "Apps", about: "About", principles: "Principles", contact: "Contact", menu: "Menu" },
    // [before, accent, after] per line – the accent word gets the logo gradient.
    heroLines: [["SMALL. FAST.", "", ""], ["", "OPEN SOURCE", "."]] as [string, string, string][],
    heroSub:
      "Arcly Studio is an independent one-developer studio. Free apps for Windows – no account, no telemetry, nothing you don't need.",
    heroApps: "See the apps",
    heroMeta: "Windows 10/11 · Free · MIT license",
    apps: {
      eyebrow: "Apps",
      // Valid for any number of apps (alternative: "Apps that do one thing well").
      title: "Small apps, each with one job",
      lead: "Free and open source, for Windows 10 and 11.",
      status: { live: "Available" },
      storeSoon: "Planned for Microsoft Store",
      openSite: "website",
      openRepo: "on GitHub",
      store: "Microsoft Store",
      github: "GitHub",
      links: "links",
    },
    about: {
      eyebrow: "About",
      title: "One developer, a few focused apps",
      body: [
        "Arcly Studio is one independent developer making small apps for Windows. Each app solves one problem, starts fast and stays out of the way.",
        "The source code is public on GitHub under the MIT license, and every app speaks English and Czech. Development is done with the help of AI tools; every release is tested before it ships.",
      ],
      facts: { developer: "developer", trackers: "trackers" },
      appsLabel: (n: number) => (n === 1 ? "app" : "apps"),
    },
    principles: {
      eyebrow: "Principles",
      title: "What every app gets",
      items: [
        { icon: "Gift", title: "Free", body: "No price, no ads, no paid tier." },
        { icon: "Code", title: "Open source", body: "MIT license. Read the code or build it yourself." },
        {
          icon: "EyeOff",
          title: "No telemetry",
          body: "No accounts, no tracking, no cookies. The only request an app may make on its own is a once-a-day check for a new version – and it can be switched off.",
        },
        { icon: "Zap", title: "Focused and quick", body: "One job per app. Installs for your user only, no admin rights needed." },
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: "Get in touch",
      lead: "Questions, ideas or feedback. Bugs are best reported as GitHub issues in the app's repository.",
      email: "E-mail",
      github: "GitHub",
      githubText: "Source code and issues of all apps",
    },
    footerNav: "Links",
    footerSocials: "The apps on social networks",
  },
  cs: {
    htmlLang: "cs",
    ogLocale: "cs_CZ",
    title: "Arcly Studio – malé open-source aplikace pro Windows zdarma",
    description:
      "Malé aplikace pro Windows od nezávislého vývojáře, zdarma a s otevřeným kódem: správce souborů Dirwise a poznámky NoirPad, které jde zamknout heslem.",
    ogAlt: "Arcly Studio – Malé. Rychlé. Open source. Aplikace pro Windows zdarma.",
    skip: "Přeskočit na obsah",
    langSwitch: "Jazyk",
    nav: { apps: "Aplikace", about: "O studiu", principles: "Principy", contact: "Kontakt", menu: "Nabídka" },
    heroLines: [["MALÉ. RYCHLÉ.", "", ""], ["", "OPEN SOURCE", "."]] as [string, string, string][],
    heroSub:
      "Arcly Studio je nezávislé studio jednoho vývojáře. Aplikace pro Windows zdarma – bez účtu, bez telemetrie, nic navíc.",
    heroApps: "Aplikace",
    heroMeta: "Windows 10/11 · Zdarma · Licence MIT",
    apps: {
      eyebrow: "Aplikace",
      // Platí pro libovolný počet aplikací (varianta: „Aplikace, které dělají jednu věc dobře“).
      title: "Malé aplikace, každá na jednu věc",
      lead: "Zdarma a s otevřeným kódem, pro Windows 10 a 11.",
      status: { live: "Dostupné" },
      storeSoon: "Připravujeme pro Microsoft Store",
      openSite: "web",
      openRepo: "na GitHubu",
      store: "Microsoft Store",
      github: "GitHub",
      links: "odkazy",
    },
    about: {
      eyebrow: "O studiu",
      title: "Jeden vývojář, pár aplikací",
      body: [
        "Arcly Studio je jeden nezávislý vývojář, který dělá malé aplikace pro Windows. Každá řeší jeden problém, startuje rychle a nepřekáží.",
        "Zdrojový kód je veřejný na GitHubu pod licencí MIT a všechny aplikace umí česky i anglicky. Vývoj probíhá s pomocí AI nástrojů; každé vydání se před zveřejněním testuje.",
      ],
      facts: { developer: "vývojář", trackers: "sledovacích nástrojů" },
      appsLabel: (n: number) => (n >= 1 && n <= 4 ? "aplikace" : "aplikací"), // 1–4 aplikace, 0 / 5+ aplikací
    },
    principles: {
      eyebrow: "Principy",
      title: "Co platí pro každou aplikaci",
      items: [
        { icon: "Gift", title: "Zdarma", body: "Žádná cena, reklamy ani placená verze." },
        { icon: "Code", title: "Open source", body: "Licence MIT. Kód si můžete přečíst i sestavit sami." },
        {
          icon: "EyeOff",
          title: "Bez telemetrie",
          body: "Žádné účty, sledování ani cookies. Jediný požadavek, který aplikace může udělat sama, je jednou denně dotaz na novou verzi – a ten jde vypnout.",
        },
        { icon: "Zap", title: "Jedna věc, rychle", body: "Každá aplikace dělá jednu věc. Instaluje se jen pro vás, bez práv správce." },
      ],
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Napište",
      lead: "Otázky, nápady nebo zpětná vazba. Chyby nejlépe hlaste jako issue na GitHubu u dané aplikace.",
      email: "E-mail",
      github: "GitHub",
      githubText: "Zdrojový kód a hlášení chyb všech aplikací",
    },
    footerNav: "Odkazy",
    footerSocials: "Aplikace na sociálních sítích",
  },
} as const;

export const EMAIL = "arclystudio.dev@gmail.com";

export const links = { org: "https://github.com/arcly-studio" };

// Root-relative paths: they work on localhost (simulation) and in production alike.
export const home = (lang: Lang) => (lang === "cs" ? "/cs/" : "/");
