// npm test – the guard blocks project-site names and CNAME only at the root of the output.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { checkRoot } from "./guard.mjs";

const RESERVED = ["dirwise", "noirpad"];

function tree(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arcly-guard-"));
  fs.writeFileSync(path.join(dir, "index.html"), "ok");
  for (const e of entries) {
    const p = path.join(dir, e);
    if (e.endsWith("/")) fs.mkdirSync(p, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, "x");
    }
  }
  return dir;
}
const check = (entries) => {
  const dir = tree(entries);
  try {
    return checkRoot(dir, RESERVED);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("clean output passes", () => assert.deepEqual(check(["cs/index.html", "robots.txt"]), []));

for (const bad of ["dirwise/", "Dirwise/", "DIRWISE/", "noirpad/", "NoirPad/", "dirwise.html", "NOIRPAD.htm", "dirwise", "CNAME", "cname"]) {
  test(`root entry "${bad}" is blocked`, () => assert.equal(check([bad]).length, 1));
}

for (const ok of [
  "_astro/dirwise-columns.Ab12.webp",
  "assets/dirwise-card.webp",
  "media/dirwise/shot.png",
  "media/noirpad/",
  "cs/dirwise.html",
  "dirwise-card.webp",
  "noirpad-icon.png",
  "media/CNAME",
]) {
  test(`"${ok}" passes (not a root collision)`, () => assert.deepEqual(check([ok]), []));
}
