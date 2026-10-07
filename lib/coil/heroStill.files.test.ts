import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HERO_STILL_DPR, HERO_STILL_SIZE, heroStillSrc } from "@/lib/coil/heroStill";

type Meta = { width?: number; height?: number; format?: string; compression?: string };
type Sharp = (input: string) => { metadata: () => Promise<Meta> };

// The sharp next ships (it is not a direct dependency).
function loadSharp(): Sharp | null {
  try {
    const require = createRequire(import.meta.url);
    return createRequire(require.resolve("next/package.json"))("sharp") as Sharp;
  } catch {
    return null;
  }
}

const sharp = loadSharp();
if (!sharp) console.warn("heroStill.files.test: sharp is not resolvable through next; the hero still size checks are skipped.");
const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

describe.skipIf(!sharp)("hero still files", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const cut of ["wide", "square", "narrow"] as const) {
      const width = HERO_STILL_SIZE[cut].width * HERO_STILL_DPR;
      const height = HERO_STILL_SIZE[cut].height * HERO_STILL_DPR;
      it(`${theme} ${cut} is ${width}x${height} in AVIF and WebP`, async () => {
        const avif = await sharp!(join(publicDir, heroStillSrc(theme, cut, "avif"))).metadata();
        const webp = await sharp!(join(publicDir, heroStillSrc(theme, cut, "webp"))).metadata();
        expect({ compression: avif.compression, width: avif.width, height: avif.height }).toEqual({ compression: "av1", width, height });
        expect({ format: webp.format, width: webp.width, height: webp.height }).toEqual({ format: "webp", width, height });
      });
    }
  }
});
