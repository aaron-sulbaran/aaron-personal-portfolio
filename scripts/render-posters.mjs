#!/usr/bin/env node
// Renders the hero stills (public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp})
// from a local production build of the full site: the scene at rest
// (?coildebug=still=<offset>: cards and name, the field at fieldClocks(0), the
// entrance done, the conveyor idle at <offset> cards), no hover, no seen rings
// (a fresh profile per capture), each theme through lib/theme.ts's storage
// key, at DPR 2. Only the canvas and the field poster stay visible for the
// shot (the fixed header and the cursor overlap the stage). Encoded with the
// sharp next ships: AVIF q60 4:4:4 (the commit 49ee8ba recipe) and WebP q82.
// Each encoded buffer is written as is and its error is measured on that
// same buffer.
//
// The offset (the conveyor's phase) is chosen by measurement, per theme and
// cut: it sweeps one card spacing in 16 steps; at each step the canvas is
// captured twice, as is and with nocards, through identical waits; a pixel of
// the lockup region ("Aaron" and "Hi, I'm", from window.__coil.api.nameRect())
// is covered when any channel differs by more than 24/255 between the two.
// The offset with the fewest covered pixels wins (ties: the lower greeting
// fraction, then the lower offset). The picks go to scripts/hero-still-phases.json;
// --phases <file> skips the sweep and renders at the recorded offsets.
// Usage: node scripts/render-posters.mjs http://localhost:3160 [--phases scripts/hero-still-phases.json]

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const [base, ...rest] = process.argv.slice(2);
const phasesFlag = rest.indexOf("--phases");
const phasesIn = phasesFlag >= 0 ? rest[phasesFlag + 1] : null;
if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base) || (phasesFlag >= 0 && !phasesIn)) {
  console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> [--phases <file>] (a full-mode production build)");
  process.exit(1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "coil");
const PHASES_OUT = join(HERE, "hero-still-phases.json");
const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
const THEMES = ["light", "dark"];
const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
const SETTLE_MS = 1500; // after the loader has gone: the name's surface growing in (900ms), the cards' last repaints
const SWEEP_STEPS = 16; // over one card spacing (the conveyor's offset is in cards)
const COVERED_DELTA = 24; // of 255, any channel
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
    await page.addStyleTag({ content: ONLY_STAGE });
    const png = await page.locator("section[data-scene] canvas").screenshot();
    const { width, height } = await sharp(png).metadata();
    if (width !== viewport.width * DPR || height !== viewport.height * DPR) throw new Error(`${theme} ${cut}: shot is ${width}x${height}`);
    return { png, width, height, region };
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

// Covered pixels of the lockup (the union of the two boxes) and of the greeting.
async function coverage(shot, bare) {
  const { width, height, region } = shot;
  const [a, b] = await Promise.all([shot.png, bare.png].map((input) => sharp(input).removeAlpha().raw().toBuffer()));
  const name = devicePx(region.name, width, height);
  const greet = devicePx(region.greeting, width, height);
  const inside = (box, x, y) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
  let pixels = 0;
  let covered = 0;
  let greetPixels = 0;
  let greetCovered = 0;
  for (let y = Math.min(name.y0, greet.y0); y < Math.max(name.y1, greet.y1); y++) {
    for (let x = Math.min(name.x0, greet.x0); x < Math.max(name.x1, greet.x1); x++) {
      const inGreet = inside(greet, x, y);
      if (!inGreet && !inside(name, x, y)) continue;
      const i = (y * width + x) * 3;
      const hit =
        Math.abs(a[i] - b[i]) > COVERED_DELTA || Math.abs(a[i + 1] - b[i + 1]) > COVERED_DELTA || Math.abs(a[i + 2] - b[i + 2]) > COVERED_DELTA;
      pixels++;
      if (hit) covered++;
      if (inGreet) {
        greetPixels++;
        if (hit) greetCovered++;
      }
    }
  }
  return { covered, fraction: covered / pixels, greeting: greetCovered / greetPixels };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (v) => v.toFixed(4);

async function sweep(browser, theme, cut) {
  let best = null;
  for (let k = 0; k < SWEEP_STEPS; k++) {
    const offset = k / SWEEP_STEPS;
    const shot = await capture(browser, theme, cut, `still=${offset}`);
    const bare = await capture(browser, theme, cut, `still=${offset},nocards`);
    if (!shot.region || !same(shot.region, bare.region)) throw new Error(`${theme} ${cut} ${offset}: the lockup region is missing or moved between the two captures`);
    if (k === 0) console.log(`${theme} ${cut}: region ${JSON.stringify(devicePx(shot.region.name, shot.width, shot.height))} + ${JSON.stringify(devicePx(shot.region.greeting, shot.width, shot.height))} device px, ${shot.region.source}`);
    const result = { offset, ...(await coverage(shot, bare)) };
    console.log(`${theme} ${cut} offset ${offset.toFixed(4)}: covered ${fmt(result.fraction)}, greeting ${fmt(result.greeting)}`);
    if (!best || result.covered < best.covered || (result.covered === best.covered && result.greeting < best.greeting)) best = result;
  }
  return best;
}

const browser = await chromium.launch({ channel: "chromium", args: ["--mute-audio"] });
try {
  let phases;
  if (phasesIn) {
    phases = JSON.parse(readFileSync(phasesIn, "utf8"));
    for (const theme of THEMES) for (const cut of Object.keys(CUTS)) if (typeof phases[theme]?.[cut] !== "number") throw new Error(`${phasesIn}: no offset for ${theme} ${cut}`);
  } else {
    phases = {};
    const table = [];
    for (const theme of THEMES) {
      phases[theme] = {};
      for (const cut of Object.keys(CUTS)) {
        const best = await sweep(browser, theme, cut);
        phases[theme][cut] = best.offset;
        table.push(`| ${theme} | ${cut} | ${best.offset} | ${fmt(best.fraction)} | ${fmt(best.greeting)} |`);
      }
    }
    console.log(["", "| theme | cut | offset (cards) | covered fraction | greeting fraction |", "|---|---|---|---|---|", ...table, ""].join("\n"));
    writeFileSync(PHASES_OUT, `${JSON.stringify(phases, null, 2)}\n`);
    console.log(`wrote ${PHASES_OUT}`);
  }
  for (const theme of THEMES) {
    for (const cut of Object.keys(CUTS)) {
      const { png, width, height } = await capture(browser, theme, cut, `still=${phases[theme][cut]}`);
      for (const [format, encode] of Object.entries(ENCODE)) {
        const buffer = await encode(png);
        const file = `hero-${theme}-${cut}.${format}`;
        writeFileSync(join(OUT, file), buffer);
        const error = await encodeError(png, buffer);
        console.log(`${file}: ${width}x${height}, ${buffer.length} bytes, error mean ${error.mean.toFixed(2)} max ${error.max} of 255`);
      }
    }
  }
} finally {
  await browser.close();
}
