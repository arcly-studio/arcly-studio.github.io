// Animation layer – adapted from the Dirwise site (Dirwise/site/src/scripts/motion.ts), same libraries,
// versions and rules: GSAP (ScrollTrigger) + Lenis smooth scrolling. Layout.astro loads it
// only from JS (desktop right away, mobile after interaction / 3 s after `load`), so without JS, on error
// or with reduced motion everything is visible. Initial hidden states live in CSS only under
// `html[data-motion="pending"]` (site.css); here they become GSAP inline styles and the attribute turns "on".
// Rules (design language of the Arcly family, D1): only transform and opacity (plus the accent word's sweep
// and glow), every element is revealed once (except scrub effects); entrances 0.6 s with a strong ease-out
// (power4.out = cubic-bezier(.23,1,.32,1)), offset 24 px (cards 32 px), scale from 0.97, stagger 0.06 s;
// scroll-linked effects follow Lenis directly (scrub: true – one smoothing, not two). The navigation stays put.
// Studio differences: no live demo and no video section – the app cards follow the hero; the key caps
// are on the principle tiles. The hero content (title, text, buttons) is never hidden – it is visible on the first paint, before any JS (LCP); the intro only adds
// effects on top: the light sweep over the accent word, its glow pulse and the background glow.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/*! Bundled third-party code (THIRD-PARTY-LICENSES.md):
 * GSAP 3.15.0 (gsap, ScrollTrigger) – Copyright 2008-2026, GreenSock. All rights reserved.
 *   Subject to the terms at https://gsap.com/standard-license
 * Lenis 1.3.27 – Copyright (c) 2024 darkroom.engineering – MIT License
 *   https://github.com/darkroomengineering/lenis/blob/main/LICENSE
 */
gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
/** Strong ease-out of the family design language: power4.out ≈ cubic-bezier(.23,1,.32,1). */
const EASE = "power4.out";
/** From 768 px full motion (hero intro, parallax, Lenis); below only gentle section reveals. */
const DESKTOP = "(min-width: 768px)";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/** Elements revealed on scroll. */
const REVEAL = "[data-reveal], .foot";

let mm: gsap.MatchMedia | null = null;
let introDone = false;
let lenis: Lenis | null = null;

/** Revert everything (GSAP inline styles, Lenis) and show the content without motion – on any error. */
export function abort() {
  try {
    mm?.revert();
  } catch {
    /* revert itself failed – at least remove the attribute below */
  }
  mm = null;
  html.removeAttribute("data-motion");
}

export function init() {
  // The safety net in Layout.astro already removed the attribute (slow network) or reduced motion applies.
  if (html.dataset.motion !== "pending" || html.dataset.motionInit) return;
  html.dataset.motionInit = "1";

  try {
    mm = gsap.matchMedia();
    // The callback runs only when at least one condition matches – desktop + mobile cover every width.
    mm.add(
      { desktop: DESKTOP, mobile: "not all and (min-width: 768px)", fine: "(hover: hover) and (pointer: fine)", reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const { desktop, fine, reduce } = ctx.conditions as Record<string, boolean>;
        if (reduce) {
          html.removeAttribute("data-motion");
          return;
        }
        // Listeners bound to this run – removed when switching desktop/mobile or reduced motion.
        const ac = new AbortController();
        const signal = ac.signal;
        let accent: HTMLElement | null = null;
        let ro: ResizeObserver | null = null;
        try {
          // On mobile the module loads after interaction – hide only what is still below the fold.
          const unseen = (el: Element) => desktop || el.getBoundingClientRect().top > innerHeight;
          const pending = $$(REVEAL).filter((el) => !el.dataset.revealed);
          // Content the visitor has already seen (mobile: above the fold when the module loaded) counts as
          // revealed – otherwise a later switch to the desktop branch (rotating a tablet, widening the window)
          // would hide it again and, when already scrolled past, never reveal it. (Fix over the Dirwise code.)
          for (const el of pending) if (!unseen(el)) el.dataset.revealed = "1";
          const revealTargets = pending.filter((el) => !el.dataset.revealed);
          // The footer only fades: moving it down would lengthen a short page and cause CLS.
          if (revealTargets.length) gsap.set(revealTargets, { opacity: 0, y: (_: number, el: Element) => revealY(el), scale: (_: number, el: Element) => (isCard(el) ? 0.97 : 1) });
          // Intro only on the first view at the top – not after switching from mobile, after scrolling or with a hash.
          if (desktop && !introDone && scrollY < 50 && !targetOf(location.hash)) accent = $(".hero-title em");
          introDone = true;
          html.dataset.motion = "on";

          if (desktop) {
            if (fine) lenis = setupLenis();
            if (accent) heroIntro(accent);
            heroBackdrop(!!accent, !!lenis);
            cardsParallax();
          }
          reveals(revealTargets, signal);
          keyCaps(unseen);
          anchors(signal);
          ro = refreshOnResize();
        } catch (err) {
          // Error in the middle of the setup: never leave content at opacity 0 – revert everything.
          queueMicrotask(abort);
          console.error(err);
        }

        return () => {
          ac.abort();
          ro?.disconnect();
          if (ro) clearTimeout(refreshTimer);
          lenis?.destroy();
          lenis = null;
          html.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped");
        };
      },
    );
  } catch (err) {
    abort();
    console.error(err);
  }
}

/* ---------- Lenis ---------- */

function setupLenis() {
  const l = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
  l.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => l.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  const origDestroy = l.destroy.bind(l);
  l.destroy = () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33); // GSAP defaults
    origDestroy();
  };
  return l;
}

const targetOf = (hash: string) => {
  try {
    const id = decodeURIComponent(hash.slice(1));
    return id ? document.getElementById(id) : null;
  } catch {
    return null;
  }
};

/** Menu anchors and "Skip to content": smooth with Lenis, focus on the target like a native jump.
 *  The offset below the navigation comes from `scroll-margin-top` in site.css (Lenis honours it). */
function anchors(signal: AbortSignal) {
  document.addEventListener(
    "click",
    (e) => {
      if (!lenis || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href*="#"]');
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const el = targetOf(url.hash);
      if (!el) return;
      e.preventDefault();
      if (url.hash !== location.hash) history.pushState(null, "", url.hash);
      if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
      el.focus({ preventScroll: true });
      lenis.scrollTo(el, { duration: 0.8 });
    },
    { signal },
  );
}

/* ---------- Hero ---------- */

/** The accent word "lights up": a light sweep from left to right (--sweep, CSS .hero-title em) and a
 *  short glow boost. Start and end values are the resting state from CSS – nothing changes afterwards. */
function heroIntro(accent: HTMLElement) {
  gsap.timeline({ defaults: { ease: EASE }, onComplete: () => gsap.set(accent, { clearProps: "--sweep,filter" }) })
    .fromTo(accent, { "--sweep": "100%" }, { "--sweep": "0%", duration: 0.9, ease: "power2.inOut" }, 0.3)
    .to(accent, { filter: "drop-shadow(0 0 44px rgba(244, 63, 94, 0.9))", duration: 0.45, ease: "power2.out", yoyo: true, repeat: 1 }, 0.35);
}

/** Glow and stars behind the hero: light up on load, move slower than the content and dim on scroll. */
function heroBackdrop(intro: boolean, smooth: boolean) {
  const sky = $(".hero-sky");
  const glow = $(".hero-glow");
  if (!sky || !glow) return;
  if (intro) gsap.fromTo(glow, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.9, ease: EASE, clearProps: "opacity,transform" });
  else gsap.set(glow, { clearProps: "opacity,transform" });
  // With Lenis the scroll is already smoothed – follow it directly; without (touch, coarse pointer) a light lag.
  gsap.to(sky, { y: 160, scale: 1.12, opacity: 0.45, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: smooth ? true : 0.3 } });
}

/* ---------- Sections ---------- */

const isCard = (el: Element) => el.classList.contains("card");
/** Initial offset: cards 32 px, others 24 px, footer 0 (see above). */
const revealY = (el: Element) => (isCard(el) ? 32 : el.classList.contains("foot") ? 0 : 24);

const show = (els: HTMLElement[], stagger = 0.06) => {
  for (const el of els) el.dataset.revealed = "1";
  gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: EASE, stagger, overwrite: "auto", clearProps: "opacity,transform" });
};

/** Reveal on scroll – once, in batches with a stagger. An element that receives keyboard focus before
 *  the scroll reveals it (Tab near the bottom edge) is shown at once. */
function reveals(targets: HTMLElement[], signal: AbortSignal) {
  if (!targets.length) return;
  for (const group of [targets.filter(isCard), targets.filter((el) => !isCard(el))]) {
    if (!group.length) continue;
    ScrollTrigger.batch(group, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        const rest = (batch as HTMLElement[]).filter((el) => el.dataset.revealed !== "1");
        if (rest.length) show(rest);
      },
    });
  }
  document.addEventListener(
    "focusin",
    (e) => {
      const el = (e.target as Element).closest<HTMLElement>(REVEAL);
      if (el && el.dataset.revealed !== "1" && targets.includes(el)) show([el], 0);
    },
    { signal },
  );
}

/** Key caps on the principle tiles settle like a pressed key – once, together with the tile; a small overshoot
 *  from 0.8, never from far smaller (design language: nothing appears from nothing). */
function keyCaps(unseen: (el: Element) => boolean) {
  // Tiles already revealed (seen on mobile before a switch to desktop) keep their caps as they are.
  const tiles = $$(".keys li").filter((li) => !li.dataset.keysDone && !li.dataset.revealed && unseen(li));
  for (const li of tiles) {
    const caps = $$(".keycap", li);
    if (!caps.length) continue;
    gsap.set(caps, { scale: 0.8, y: -6 });
    ScrollTrigger.create({
      trigger: li,
      start: "top 90%", // same as the tile reveal
      once: true,
      onEnter: () => {
        li.dataset.keysDone = "1";
        gsap.to(caps, { scale: 1, y: 0, duration: 0.4, ease: "back.out(1.7)", stagger: 0.06, delay: 0.1, clearProps: "transform" });
      },
    });
  }
}

/** Screenshots in the app cards: gentle parallax ±12 px (scrub), as the Dirwise feature cards but scaled to
 *  the smaller preview. scale 1.15 keeps the edges covered over the whole range. */
function cardsParallax() {
  for (const card of $$(".apps-grid .app-card")) {
    const pic = $(".app-shot picture", card);
    if (!pic) continue;
    gsap.fromTo(pic, { y: -12, scale: 1.15 }, { y: 12, scale: 1.15, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true } });
  }
}

/* ---------- Details ---------- */

/** The page height can change without a resize (images, fonts) – refresh ScrollTriggers. */
let refreshTimer = 0;
function refreshOnResize() {
  if (!("ResizeObserver" in window)) return null;
  let last = document.body.offsetHeight;
  const ro = new ResizeObserver(() => {
    const h = document.body.offsetHeight;
    if (h === last) return;
    last = h;
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
  });
  ro.observe(document.body);
  return ro;
}
