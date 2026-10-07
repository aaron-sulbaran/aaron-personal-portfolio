#!/usr/bin/env node
// Renders the hero stills (public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp})
// from a local production build of the full site: the scene at rest
// (?coildebug=still: cards and name, the field at fieldClocks(0), the entrance
// done, the conveyor idle), no hover, no seen rings (a fresh profile), each
// theme through lib/theme.ts's storage key, at DPR 2. Only the canvas and the
// field poster stay visible for the shot (the fixed header and the cursor
// overlap the stage). Encoded with the sharp next ships: AVIF q60 4:4:4 (the
// commit 49ee8ba recipe) and WebP q82. Each encoded buffer is written as is
// and its error is measured on that same buffer.
// Usage: node scripts/render-posters.mjs http://localhost:3160

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const base = process.argv[2];
if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base)) {
  console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> (a full-mode production build)");
  process.exit(1);
}
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "coil");
const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
const SETTLE_MS = 1500; // after the loader has gone: the name's surface growing in (900ms), the cards' last repaints
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

const browser = await chromium.launch({ channel: "chromium", args: ["--mute-audio"] });
try {
  for (const theme of ["light", "dark"]) {
    for (const [cut, viewport] of Object.entries(CUTS)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: DPR, colorScheme: theme, reducedMotion: "no-preference" });
      await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
      const page = await context.newPage();
      await page.goto(new URL("/?coildebug=still", base).href);
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
      await page.addStyleTag({ content: ONLY_STAGE });
      const png = await page.locator("section[data-scene] canvas").screenshot();
      const { width, height } = await sharp(png).metadata();
      if (width !== viewport.width * DPR || height !== viewport.height * DPR) throw new Error(`${theme} ${cut}: shot is ${width}x${height}`);
      for (const [format, encode] of Object.entries(ENCODE)) {
        const buffer = await encode(png);
        const file = `hero-${theme}-${cut}.${format}`;
        writeFileSync(join(OUT, file), buffer);
        const error = await encodeError(png, buffer);
        console.log(`${file}: ${width}x${height}, ${buffer.length} bytes, error mean ${error.mean.toFixed(2)} max ${error.max} of 255`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
