#!/usr/bin/env node
// Renders the stage's stills from a local production build of the full site:
//
//   public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp}
//     The cards section's scene at rest (?coildebug=still: the cards, the field
//     at fieldClocks(0), the entrance done, the conveyor idle at offset 0, no
//     hover, no seen rings), shown where no scene can run (no WebGL, reduced
//     motion). The scene no longer draws the name behind the Coil, so none is
//     baked. The stage is held to the cut's own viewport (the cards section's
//     frame, fixed over the page), so the scene lays out at the cut's aspect.
//
//   public/coil/wheel-{light,dark}.avif
//     The wheel at rest (?coildebug=1,entrance=-1: the strand held as the
//     teaser's wheel, the field closed, the cards alone on a transparent
//     canvas), shown in the teaser's slot (components/coil/Poster.tsx
//     WheelStill) where no scene can draw it. The page is laid out as a wide
//     visitor sees it; the capture is a square centred on [data-coil-wheel],
//     WHEEL_SPAN times its width, with alpha. The theme's cards differ, so one
//     per theme.
//
// Each theme goes through lib/theme.ts's storage key, at DPR 2, a fresh
// profile per capture. Only the canvas stays visible for the shot. Encoded with
// the sharp next ships: AVIF q60 4:4:4 (the commit 49ee8ba recipe) and WebP q82
// for the hero stills, AVIF q60 with alpha for the wheel. Each encoded buffer
// is written as is and its error is measured on that same buffer. Nothing is
// written until every capture has passed its checks: a failed one stops the run
// with the repo untouched.
// Usage: node scripts/render-posters.mjs http://localhost:3160 [--only hero|wheel]

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const [base, ...rest] = process.argv.slice(2);
const onlyFlag = rest.indexOf("--only");
const only = onlyFlag >= 0 ? rest[onlyFlag + 1] : null;
if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base) || (onlyFlag >= 0 && !["hero", "wheel"].includes(only))) {
  console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> [--only hero|wheel] (a full-mode production build)");
  process.exit(1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "coil");
const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
const INVITE_KEY = "aaron-express-invite"; // lib/quick/invite.ts: answered, so no toast lands over a shot
const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
const THEMES = ["light", "dark"];
const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
const WHEEL_VIEWPORT = { width: 1440, height: 900 };
const WHEEL_SPAN = 1.7; // the capture's side, in slot widths (the ring is 1.3 slots wide, and leans)
const SETTLE_MS = 1500; // after the page is ready: the cards' textures and last repaints
const PAPER = { r: 250, g: 250, b: 247 }; // --color-background, light: only to flatten a shot for the error measure
// Everything but the canvas is hidden for the shot; the page behind it is clear.
// (The body's colour transition is off, or it would still be fading to clear in the shot.)
const ONLY_STAGE = "body *{visibility:hidden!important}html,body{background:transparent!important;transition:none!important}section[data-scene] canvas{visibility:visible!important}";
// The cards section's frame held to the viewport, so the scene lays out at the cut's size.
const FILL_VIEWPORT =
  "section[data-scene] [data-coil-frame]{position:fixed!important;inset:0!important;z-index:2147483000!important;height:auto!important;min-height:0!important}" +
  "section[data-scene] [data-coil-rail]{top:0!important;bottom:auto!important;height:100%!important}" +
  "section[data-scene] [data-coil-sticky]{position:relative!important;top:0!important;height:100%!important}";
const ENCODE = {
  avif: (input) => sharp(input).avif({ quality: 60, chromaSubsampling: "4:4:4" }).toBuffer(),
  webp: (input) => sharp(input).webp({ quality: 82, smartSubsample: true, effort: 6 }).toBuffer(),
};

// The mean and largest channel difference over the flattened pixels (alpha put
// over the paper first, so a transparent stage compares like a drawn one).
async function encodeError(png, encoded) {
  const flat = (input) => sharp(input).flatten({ background: PAPER }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([png, encoded].map(flat));
  let sum = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / a.length, max };
}

async function openPage(browser, theme, viewport, tokens) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: DPR, colorScheme: theme, reducedMotion: "no-preference" });
  await context.addInitScript(
    ([themeKey, theme, inviteKey]) => {
      localStorage.setItem(themeKey, theme);
      localStorage.setItem(inviteKey, "dismissed");
    },
    [THEME_KEY, theme, INVITE_KEY],
  );
  const page = await context.newPage();
  await page.goto(new URL(`/?coildebug=${tokens}`, base).href);
  await page.waitForFunction(
    (want) =>
      document.querySelector("section[data-scene]")?.dataset.scene === "on" &&
      document.documentElement.dataset.home === "ready" &&
      document.documentElement.dataset.theme === want &&
      !["on", "shrink"].includes(document.documentElement.dataset.introLoader ?? ""),
    theme,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// The hero still: the scene at rest, the stage filling the cut's viewport.
async function heroStill(browser, theme, cut) {
  const viewport = CUTS[cut];
  const { context, page } = await openPage(browser, theme, viewport, "still=0");
  try {
    await page.addStyleTag({ content: FILL_VIEWPORT });
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(async () => {
      window.__coil.api.freeze(true);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await page.addStyleTag({ content: ONLY_STAGE });
    const png = await page.locator("section[data-scene] canvas").screenshot();
    const { width, height } = await sharp(png).metadata();
    if (width !== viewport.width * DPR || height !== viewport.height * DPR) throw new Error(`hero ${theme} ${cut}: shot is ${width}x${height}`);
    return { png, width, height };
  } finally {
    await context.close();
  }
}

// The wheel still: the teaser's slot and the canvas around it, cards only, clear behind.
async function wheelStill(browser, theme) {
  const { context, page } = await openPage(browser, theme, WHEEL_VIEWPORT, "1,entrance=-1");
  try {
    // The stage's top at the top of the screen puts the slot inside the canvas.
    await page.evaluate(() => {
      const stage = document.querySelector("[data-coil-sticky]").getBoundingClientRect();
      window.scrollTo({ top: stage.top + window.scrollY, behavior: "instant" });
    });
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(async () => {
      window.__coil.api.freeze(true);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const slot = await page.evaluate(() => {
      const r = document.querySelector("[data-coil-wheel]").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width };
    });
    const side = Math.round(slot.width * WHEEL_SPAN);
    const clip = { x: Math.round(slot.x - side / 2), y: Math.round(slot.y - side / 2), width: side, height: side };
    if (clip.x < 0 || clip.y < 0 || clip.x + side > WHEEL_VIEWPORT.width || clip.y + side > WHEEL_VIEWPORT.height) throw new Error(`wheel ${theme}: the slot's square ${JSON.stringify(clip)} leaves the viewport`);
    await page.addStyleTag({ content: ONLY_STAGE });
    await frames(page);
    const png = await page.screenshot({ clip, omitBackground: true });
    const { width, height, channels } = await sharp(png).metadata();
    if (width !== side * DPR || height !== side * DPR || channels !== 4) throw new Error(`wheel ${theme}: shot is ${width}x${height}, ${channels} channels`);
    // The wheel is really in it, and nothing touches the edge (the capture must be wide enough).
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let drawn = 0;
    let edge = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] < 8) continue;
        drawn++;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge++;
      }
    }
    const share = drawn / (width * height);
    console.log(`wheel-${theme}: ${width}x${height}, ${(share * 100).toFixed(1)}% drawn, ${edge} drawn pixels on the edge`);
    if (!(share > 0.1)) throw new Error(`wheel ${theme}: only ${(share * 100).toFixed(1)}% of the capture is drawn; nothing written`);
    if (edge > 0) throw new Error(`wheel ${theme}: the wheel touches the capture's edge (raise WHEEL_SPAN); nothing written`);
    return { png, width, height };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ channel: "chromium", args: ["--mute-audio"] });
try {
  const images = [];
  const add = async (stem, formats, shot) => {
    for (const format of formats) {
      const buffer = await ENCODE[format](shot.png);
      const file = `${stem}.${format}`;
      const error = await encodeError(shot.png, buffer);
      console.log(`${file}: ${shot.width}x${shot.height}, ${buffer.length} bytes, error mean ${error.mean.toFixed(2)} max ${error.max} of 255`);
      images.push({ file, buffer });
    }
  };
  for (const theme of THEMES) {
    if (only !== "wheel") for (const cut of Object.keys(CUTS)) await add(`hero-${theme}-${cut}`, ["avif", "webp"], await heroStill(browser, theme, cut));
    if (only !== "hero") await add(`wheel-${theme}`, ["avif"], await wheelStill(browser, theme));
  }
  // Every check passed: write it all.
  for (const { file, buffer } of images) writeFileSync(join(OUT, file), buffer);
  console.log(`wrote ${images.length} images to ${OUT}`);
} finally {
  await browser.close();
}
