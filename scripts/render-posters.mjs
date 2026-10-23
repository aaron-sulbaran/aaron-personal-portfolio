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
// Each theme goes through lib/theme.ts's storage key, at DPR 2, a fresh
// profile per capture. Only the canvas stays visible for the shot. Encoded with
// the sharp next ships: AVIF q60 4:4:4 (the commit 49ee8ba recipe) and WebP q82.
// Each encoded buffer is written as is and its error is measured on that same
// buffer. Nothing is written until every capture has passed its checks: a failed
// one stops the run with the repo untouched.
// Usage: node scripts/render-posters.mjs http://localhost:3160

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const [base] = process.argv.slice(2);
if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base)) {
  console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> (a full-mode production build)");
  process.exit(1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "coil");
const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
const INVITE_KEY = "aaron-express-invite"; // lib/quick/invite.ts: answered, so no toast lands over a shot
const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
const THEMES = ["light", "dark"];
const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
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
    for (const cut of Object.keys(CUTS)) await add(`hero-${theme}-${cut}`, ["avif", "webp"], await heroStill(browser, theme, cut));
  }
  // Every check passed: write it all.
  for (const { file, buffer } of images) writeFileSync(join(OUT, file), buffer);
  console.log(`wrote ${images.length} images to ${OUT}`);
} finally {
  await browser.close();
}
