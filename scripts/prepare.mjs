// Before dev/build (same approach as the Dirwise site): star field for the hero, small font subsets and the
// favicon set from the Arcly logo. Generated files are git-ignored (see .gitignore). The OG images are
// static files made by scripts/og.mjs.
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";
import subsetFont from "subset-font";

const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));
const mod = (p) => fileURLToPath(new URL(`../node_modules/${p}`, import.meta.url));

// Star field: deterministic scatter (fixed seed = same file every build), a few hundred bytes of SVG.
let seed = 20261102;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const stars = Array.from({ length: 140 }, () => {
  const r = rnd() < 0.85 ? 0.6 + rnd() * 0.5 : 1.1 + rnd() * 0.7;
  const o = (0.25 + rnd() * 0.65).toFixed(2);
  return `<circle cx="${(rnd() * 1600).toFixed(0)}" cy="${(rnd() * 900).toFixed(0)}" r="${r.toFixed(1)}" fill-opacity="${o}"/>`;
}).join("");
fs.mkdirSync(pub("media"), { recursive: true });
fs.writeFileSync(pub("media/stars.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" fill="#fff">${stars}</svg>`);

fs.mkdirSync(pub("fonts"), { recursive: true });
// Czech: from Inter latin-ext (83 kB) only the letters outside latin-1 – a few kB, preloaded on /cs/ only.
export const CS_CHARS = "ČčĎďĚěŇňŘřŠšŤťŮůŽž";
const interExt = fs.readFileSync(mod("@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2"));
fs.writeFileSync(pub("fonts/inter-cs.woff2"), await subsetFont(interExt, CS_CHARS, { targetFormat: "woff2" }));

// NoirPad card: JetBrains Mono (the app's font), one static instance (weight 600) for printable ASCII,
// Czech letters and a few symbols – about half the size of the variable file.
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const jbLatin = fs.readFileSync(mod("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2"));
const jbExt = fs.readFileSync(mod("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2"));
fs.writeFileSync(pub("fonts/jbmono-np.woff2"), await subsetFont(jbLatin, `${ascii}áéíóúýÁÉÍÓÚÝ–—›→·`, { targetFormat: "woff2", variationAxes: { wght: 600 } }));
fs.writeFileSync(pub("fonts/jbmono-np-cs.woff2"), await subsetFont(jbExt, CS_CHARS, { targetFormat: "woff2", variationAxes: { wght: 600 } }));

// Favicons from the logo (src/assets/brand): SVG as is, PNG sizes rendered by sharp, ICO wrapping a 32 px PNG
// (PNG-in-ICO is valid since Windows Vista and in all current browsers).
const brand = (p) => fileURLToPath(new URL(`../src/assets/brand/${p}`, import.meta.url));
const tile = fs.readFileSync(brand("arcly-icon.svg"));
const mark = fs.readFileSync(brand("arcly-mark-on-dark.svg"));
fs.copyFileSync(brand("arcly-icon.svg"), pub("favicon.svg"));
const png = (svg, size) => sharp(svg, { density: Math.ceil((72 * size) / 200) * 2 }).resize(size, size).png();
const ico32 = await png(tile, 32).toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); // reserved, type icon, 1 image
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(ico32.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(pub("favicon.ico"), Buffer.concat([ico, ico32]));
// Apple touch icon must not be transparent: the tile's rounded corners on the page background.
await png(tile, 180).flatten({ background: "#0a0d16" }).toFile(pub("apple-touch-icon.png"));
await png(tile, 192).toFile(pub("icon-192.png"));
await png(tile, 512).toFile(pub("icon-512.png"));
// Maskable: full-bleed tile colour, the mark inside the 80 % safe zone.
const markPng = await png(mark, 320).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0f1420" } })
  .composite([{ input: markPng, gravity: "center" }]).png().toFile(pub("icon-maskable-512.png"));

console.log("prepare: media/stars.svg, fonts/*.woff2, favicon.svg/.ico, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png");
