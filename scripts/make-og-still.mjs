// Bakes the social card's background from the committed dark hero still:
// next/og (satori) cannot decode WebP, so the card reads a 1200 by 630 JPEG.
// The still is fitted to the card's height and pinned to the right edge (its own right edge trimmed) on the
// page's dark background colour, leaving the left of the card for the name.
// Run: node scripts/make-og-still.mjs
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const CARD = { width: 1200, height: 630 };
const DARK_BACKGROUND = "#0E1419";
// How much of the still's right edge falls off the card, pushing the cards right.
const CROP_RIGHT = 140;

const fitted = await sharp("public/coil/hero-dark-wide.webp").resize({ height: CARD.height }).toBuffer();
const { width: fittedWidth } = await sharp(fitted).metadata();
const visibleWidth = fittedWidth - CROP_RIGHT;
const still = await sharp(fitted).extract({ left: 0, top: 0, width: visibleWidth, height: CARD.height }).toBuffer();

await sharp({ create: { ...CARD, channels: 3, background: DARK_BACKGROUND } })
  .composite([{ input: still, left: CARD.width - visibleWidth, top: 0 }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile("public/coil/og-still.jpg");
