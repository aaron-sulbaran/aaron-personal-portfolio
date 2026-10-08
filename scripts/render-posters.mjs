#!/usr/bin/env node
// Renders the hero stills (public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp})
// from a local production build of the full site: the scene at rest
// (?coildebug=still=<offset>: the cards, the field at fieldClocks(0), the
// entrance done, the conveyor idle at <offset> cards, the name and greeting
// behind the cards at the strong ink, COIL.lockup.stillInk), no hover, no
// seen rings (a fresh profile per capture), each theme through lib/theme.ts's
// storage key, at DPR 2. Only the canvas and the field poster stay visible
// for the shot (the fixed header and the cursor overlap the stage). Encoded
// with the sharp next ships: AVIF q60 4:4:4 (the commit 49ee8ba recipe) and
// WebP q82. Each encoded buffer is written as is and its error is measured
// on that same buffer.
//
// The offsets (the conveyor's phase, per theme and cut) come from
// scripts/hero-still-phases.json when it exists, else 0 everywhere; the run
// prints them as a table. --sweep measures them and rewrites that file: per
// theme and cut it sweeps one card spacing in 16 steps; at each step the
// canvas is captured twice, still=<offset> as is and with nocards (the name
// drawn in both), through identical waits; a lockup pixel is covered when any
// channel differs by more than 24/255 between the two. The name sits behind
// the cards, so the offset that leaves the most of it showing wins: the
// fewest covered pixels over the whole lockup (the name's box and the
// greeting's), then the fewest in the greeting's box, then the lower offset.
// The boxes come from window.__coil.api.nameRect(). --phases <file> renders
// from another file of the same shape.
//
// Every still is checked for its name: the same capture with noname at the
// same offset, and more than 10 percent of the lockup's pixels must differ by
// more than 24/255 between the two. The run prints the measured share.
//
// Every run also records the lockup each cut baked (nameRect()'s geometry,
// not its colors, in CSS px of the cut's viewport from the canvas's top left)
// into lib/coil/heroStill.rects.ts, which the loader lands its resting lockup
// on (lib/coil/heroStill.ts bakedLockupRect). The two themes must agree
// within RECT_AGREE px per cut.
//
// Nothing is written until everything has passed: every theme and cut is
// rendered, checked and encoded in memory, the rects are checked, and only
// then are the images, the rects file and (with --sweep) the phases file
// written. A failed check stops the run with the repo untouched.
// Usage: node scripts/render-posters.mjs http://localhost:3160 [--sweep | --phases <file>]

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const [base, ...rest] = process.argv.slice(2);
const phasesFlag = rest.indexOf("--phases");
const phasesIn = phasesFlag >= 0 ? rest[phasesFlag + 1] : null;
const sweepPhases = rest.includes("--sweep");
if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base) || (phasesFlag >= 0 && !phasesIn) || (sweepPhases && phasesIn)) {
  console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> [--sweep | --phases <file>] (a full-mode production build)");
  process.exit(1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "coil");
const PHASES_OUT = join(HERE, "hero-still-phases.json");
const RECTS_OUT = join(HERE, "..", "lib", "coil", "heroStill.rects.ts");
const RECT_AGREE = 0.5; // CSS px, light against dark
const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
const THEMES = ["light", "dark"];
const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
const SETTLE_MS = 1500; // after the loader has gone: the name's surface growing in (900ms), the cards' last repaints
const SWEEP_STEPS = 16; // over one card spacing (the conveyor's offset is in cards)
const COVERED_DELTA = 24; // of 255, any channel
const NAME_PRESENT = 0.1; // of the lockup's pixels, the still against its noname capture
const ONLY_STAGE = 'body *{visibility:hidden!important}section[data-scene] :is(canvas,img[src*="/coil/field-"]){visibility:visible!important}';
const ENCODE = {
  avif: (input) => sharp(input).avif({ quality: 60, chromaSubsampling: "4:4:4" }).toBuffer(),
  webp: (input) => sharp(input).webp({ quality: 82, smartSubsample: true, effort: 6 }).toBuffer(),
};

async function encodeError(png, encoded) {
  const [a, b] = await Promise.all([png, encoded].map((input) => sharp(input).removeAlpha().raw().toBuffer()));
  let sum = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / a.length, max };
}

// In the page, after the freeze: the lockup's two boxes in CSS px from the
// canvas's top left. The name: its ink from nameRect() (left, width,
// baseline), its ink top measured with a 2D canvas in the scene's own face
// (--font-display, weight 900, as scene/boot.ts and scene/name.ts set it), or
// the mask's top should that fail. The greeting: "Hi, I'm" as the loader's
// resting lockup carries it, measured the same way at its own size; should
// that fail, the name's box extended upward by the greeting's cap height and
// its gap (window.__coil.nameFx().greetCap, the greeting's baseline).
function lockupRegion() {
  const target = window.__coil.api.nameRect();
  if (!target) return null;
  const canvas = document.querySelector("section[data-scene] canvas").getBoundingClientRect();
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  const probe = document.createElement("canvas").getContext("2d");
  const measure = (text, fontPx) => {
    if (!probe || !text) return null;
    probe.font = `900 ${fontPx}px ${family}`;
    const m = probe.measureText(text);
    const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    return m.actualBoundingBoxAscent > 0 && width > 0 ? { ascent: m.actualBoundingBoxAscent, width } : null;
  };
  const nameInk = measure(document.querySelector(".coil-loader__rest-name")?.textContent?.trim(), target.fontPx);
  const nameTop = nameInk ? target.baseline - nameInk.ascent : target.gradient.top;
  const name = { x0: target.left, x1: target.left + target.width, y0: nameTop, y1: target.baseline };
  const greetInk = measure(document.querySelector(".coil-loader__rest-greet")?.textContent?.trim(), target.greeting.fontPx);
  const greetCap = window.__coil.nameFx?.().greetCap ?? 0;
  const greeting = greetInk
    ? { x0: target.greeting.left, x1: target.greeting.left + greetInk.width, y0: target.greeting.baseline - greetInk.ascent, y1: target.greeting.baseline }
    : { x0: name.x0, x1: name.x1, y0: target.greeting.baseline - greetCap, y1: nameTop };
  const local = (box) => ({ x0: box.x0 - canvas.left, x1: box.x1 - canvas.left, y0: box.y0 - canvas.top, y1: box.y1 - canvas.top });
  return {
    name: local(name),
    greeting: local(greeting),
    source: `name top ${nameInk ? "measured" : "from the mask's top"}, greeting ${greetInk ? "measured" : "by the cap-height fallback"}`,
  };
}

// In the page, after the freeze: nameRect()'s geometry in CSS px from the
// canvas's top left (the still's own pixels, over DPR).
function lockupTarget() {
  const t = window.__coil.api.nameRect();
  if (!t) return null;
  const c = document.querySelector("section[data-scene] canvas").getBoundingClientRect();
  return {
    left: t.left - c.left,
    baseline: t.baseline - c.top,
    width: t.width,
    fontPx: t.fontPx,
    greeting: { left: t.greeting.left - c.left, baseline: t.greeting.baseline - c.top, fontPx: t.greeting.fontPx },
    gradient: { top: t.gradient.top - c.top, height: t.gradient.height },
  };
}

// One capture through the same steps every time: a fresh context, the
// theme, the waits, the settle, the freeze, the region read, the stage-only
// style, the canvas shot.
async function capture(browser, theme, cut, tokens) {
  const viewport = CUTS[cut];
  const context = await browser.newContext({ viewport, deviceScaleFactor: DPR, colorScheme: theme, reducedMotion: "no-preference" });
  try {
    await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
    const page = await context.newPage();
    await page.goto(new URL(`/?coildebug=${tokens}`, base).href);
    await page.waitForFunction(
      (want) =>
        document.querySelector("section[data-scene]")?.dataset.scene === "on" &&
        document.documentElement.dataset.home === "ready" &&
        document.documentElement.dataset.theme === want &&
        document.querySelector(".coil-loader")?.dataset.state === "gone",
      theme,
      { timeout: 60_000 },
    );
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(async () => {
      window.__coil.api.freeze(true);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const region = await page.evaluate(lockupRegion);
    const target = await page.evaluate(lockupTarget);
    await page.addStyleTag({ content: ONLY_STAGE });
    const png = await page.locator("section[data-scene] canvas").screenshot();
    const { width, height } = await sharp(png).metadata();
    if (width !== viewport.width * DPR || height !== viewport.height * DPR) throw new Error(`${theme} ${cut}: shot is ${width}x${height}`);
    return { png, width, height, region, target };
  } finally {
    await context.close();
  }
}

// A box in CSS px to whole device pixels, clamped to the shot.
function devicePx(box, width, height) {
  const clamp = (v, max) => Math.min(max, Math.max(0, v));
  return {
    x0: clamp(Math.floor(box.x0 * DPR), width),
    x1: clamp(Math.ceil(box.x1 * DPR), width),
    y0: clamp(Math.floor(box.y0 * DPR), height),
    y1: clamp(Math.ceil(box.y1 * DPR), height),
  };
}

// The pixels of the whole lockup (the union of the two boxes) and of the
// greeting where two captures differ by more than COVERED_DELTA in any
// channel. The boxes are the first shot's.
async function lockupDiff(shot, other) {
  const { width, height, region } = shot;
  const [a, b] = await Promise.all([shot.png, other.png].map((input) => sharp(input).removeAlpha().raw().toBuffer()));
  const name = devicePx(region.name, width, height);
  const greet = devicePx(region.greeting, width, height);
  const inside = (box, x, y) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
  let pixels = 0;
  let differ = 0;
  let greetPixels = 0;
  let greetDiffer = 0;
  for (let y = Math.min(name.y0, greet.y0); y < Math.max(name.y1, greet.y1); y++) {
    for (let x = Math.min(name.x0, greet.x0); x < Math.max(name.x1, greet.x1); x++) {
      const inGreet = inside(greet, x, y);
      if (!inGreet && !inside(name, x, y)) continue;
      const i = (y * width + x) * 3;
      const d =
        Math.abs(a[i] - b[i]) > COVERED_DELTA || Math.abs(a[i + 1] - b[i + 1]) > COVERED_DELTA || Math.abs(a[i + 2] - b[i + 2]) > COVERED_DELTA;
      pixels++;
      if (d) differ++;
      if (inGreet) {
        greetPixels++;
        if (d) greetDiffer++;
      }
    }
  }
  return { differ, greetDiffer, lockup: differ / pixels, greeting: greetDiffer / greetPixels };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (v) => v.toFixed(4);

// The most of the lockup showing: fewest covered lockup pixels, then fewest
// covered greeting pixels, then the lower offset (the steps run upward).
async function sweep(browser, theme, cut) {
  let best = null;
  for (let k = 0; k < SWEEP_STEPS; k++) {
    const offset = k / SWEEP_STEPS;
    const shot = await capture(browser, theme, cut, `still=${offset}`);
    const bare = await capture(browser, theme, cut, `still=${offset},nocards`);
    if (!shot.region || !same(shot.region, bare.region)) throw new Error(`${theme} ${cut} ${offset}: the lockup region is missing or moved between the two captures`);
    if (k === 0) console.log(`${theme} ${cut}: region ${JSON.stringify(devicePx(shot.region.name, shot.width, shot.height))} + ${JSON.stringify(devicePx(shot.region.greeting, shot.width, shot.height))} device px, ${shot.region.source}`);
    const covered = await lockupDiff(shot, bare);
    const result = { offset, ...covered };
    console.log(`${theme} ${cut} offset ${offset.toFixed(4)}: lockup covered ${fmt(result.lockup)} (${result.differ} px), greeting covered ${fmt(result.greeting)} (${result.greetDiffer} px)`);
    if (!best || result.differ < best.differ || (result.differ === best.differ && result.greetDiffer < best.greetDiffer)) best = result;
  }
  return best;
}

// The name is really in the still: against the same capture with noname.
async function namePresent(browser, theme, cut, offset, shot) {
  const bare = await capture(browser, theme, cut, `still=${offset},noname`);
  if (!shot.region || !same(shot.region, bare.region)) throw new Error(`${theme} ${cut}: the lockup region is missing or moved between the still and its noname capture`);
  const { lockup } = await lockupDiff(shot, bare);
  console.log(`hero-${theme}-${cut}: the name differs from noname over ${(lockup * 100).toFixed(1)}% of the lockup's pixels`);
  if (!(lockup > NAME_PRESENT)) throw new Error(`hero-${theme}-${cut}: only ${(lockup * 100).toFixed(1)}% of the lockup differs from noname (needs more than ${NAME_PRESENT * 100}%); nothing written`);
}

const CUT_NAMES = Object.keys(CUTS);

// A phases file: per theme and cut, { offset, lockup, greeting } (the covered
// fractions from the sweep that picked it) or a bare offset.
function readPhases(file) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const phases = {};
  for (const theme of THEMES) {
    phases[theme] = {};
    for (const cut of CUT_NAMES) {
      const entry = raw[theme]?.[cut];
      const pick = typeof entry === "number" ? { offset: entry } : entry;
      if (typeof pick?.offset !== "number") throw new Error(`${file}: no offset for ${theme} ${cut}`);
      phases[theme][cut] = pick;
    }
  }
  return phases;
}

function printTable(phases) {
  const frac = (v) => (typeof v === "number" ? fmt(v) : "n/a");
  const rows = THEMES.flatMap((theme) =>
    CUT_NAMES.map((cut) => {
      const { offset, greeting, lockup } = phases[theme][cut];
      return `| ${theme} | ${cut} | ${offset} | ${frac(lockup)} | ${frac(greeting)} |`;
    }),
  );
  console.log(["", "| theme | cut | offset (cards) | lockup covered fraction | greeting covered fraction |", "|---|---|---|---|---|", ...rows, ""].join("\n"));
}

// The baked lockups, one per cut: the themes must agree (the same face, the
// same pose); the light theme's numbers, to the hundredth, as the rects
// file's text (written by the caller once everything has passed).
function rectsText(targets) {
  const flat = (t, path = "") =>
    Object.entries(t).flatMap(([key, value]) => (typeof value === "number" ? [[`${path}${key}`, value]] : flat(value, `${path}${key}.`)));
  const round = (t) => JSON.parse(JSON.stringify(t, (_, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)));
  const rects = {};
  for (const cut of CUT_NAMES) {
    const [light, dark] = THEMES.map((theme) => targets[theme]?.[cut]);
    if (!light || !dark) throw new Error(`${cut}: no lockup rect for both themes; nothing written`);
    const darkAt = Object.fromEntries(flat(dark));
    let most = 0;
    for (const [key, value] of flat(light)) {
      const apart = Math.abs(value - darkAt[key]);
      most = Math.max(most, apart);
      if (!(apart <= RECT_AGREE)) throw new Error(`${cut}: ${key} is ${value} light, ${darkAt[key]} dark (${apart.toFixed(2)}px apart, at most ${RECT_AGREE}); nothing written`);
    }
    rects[cut] = round(light);
    console.log(`${cut}: light and dark at most ${most.toFixed(3)}px apart; ${JSON.stringify(rects[cut])}`);
  }
  const body = JSON.stringify(rects, null, 2).replace(/"(\w+)":/g, "$1:");
  return [
    "// Generated by scripts/render-posters.mjs; do not edit by hand, rerun the script.",
    "// The lockup each hero still baked behind its cards (nameRect()'s geometry),",
    "// in CSS px of the cut's viewport from its top left.",
    'import type { BakedLockup, StillCut } from "./heroStill";',
    "",
    `export const HERO_STILL_RECTS: Readonly<Record<StillCut, BakedLockup>> = ${body};`,
    "",
  ].join("\n");
}

const browser = await chromium.launch({ channel: "chromium", args: ["--mute-audio"] });
try {
  let phases;
  if (sweepPhases) {
    phases = {};
    for (const theme of THEMES) {
      phases[theme] = {};
      for (const cut of CUT_NAMES) {
        const best = await sweep(browser, theme, cut);
        phases[theme][cut] = { offset: best.offset, lockup: Number(fmt(best.lockup)), greeting: Number(fmt(best.greeting)) };
      }
    }
  } else if (phasesIn || existsSync(PHASES_OUT)) {
    phases = readPhases(phasesIn ?? PHASES_OUT);
    console.log(`offsets from ${phasesIn ?? PHASES_OUT}`);
  } else {
    phases = Object.fromEntries(THEMES.map((theme) => [theme, Object.fromEntries(CUT_NAMES.map((cut) => [cut, { offset: 0 }]))]));
    console.log("no phases file: offset 0 everywhere");
  }
  printTable(phases);
  // Everything in memory first: each still rendered, its name checked, both encodes.
  const targets = {};
  const images = [];
  for (const theme of THEMES) {
    targets[theme] = {};
    for (const cut of CUT_NAMES) {
      const { offset } = phases[theme][cut];
      const shot = await capture(browser, theme, cut, `still=${offset}`);
      targets[theme][cut] = shot.target;
      await namePresent(browser, theme, cut, offset, shot);
      const { png, width, height } = shot;
      for (const [format, encode] of Object.entries(ENCODE)) {
        const buffer = await encode(png);
        const file = `hero-${theme}-${cut}.${format}`;
        const error = await encodeError(png, buffer);
        console.log(`${file}: ${width}x${height}, ${buffer.length} bytes, error mean ${error.mean.toFixed(2)} max ${error.max} of 255`);
        images.push({ file, buffer });
      }
    }
  }
  const rects = rectsText(targets);
  // Every check passed: write it all.
  for (const { file, buffer } of images) writeFileSync(join(OUT, file), buffer);
  console.log(`wrote ${images.length} images to ${OUT}`);
  writeFileSync(RECTS_OUT, rects);
  console.log(`wrote ${RECTS_OUT}`);
  if (sweepPhases) {
    writeFileSync(PHASES_OUT, `${JSON.stringify(phases, null, 2)}\n`);
    console.log(`wrote ${PHASES_OUT}`);
  }
} finally {
  await browser.close();
}
