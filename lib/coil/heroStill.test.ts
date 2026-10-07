import { describe, expect, it } from "vitest";
import {
  HERO_STILL_SIZE,
  STILL_MEDIA,
  bakedLockupRect,
  heroStillSrc,
  stillCause,
  stillCut,
  stillFallback,
  stillSources,
  type BakedLockup,
  type StillCut,
} from "@/lib/coil/heroStill";
import { HERO_STILL_RECTS } from "@/lib/coil/heroStill.rects";

describe("hero still", () => {
  it("cuts on the narrow composition's strict line and at 1.2", () => {
    expect(stillCut(390 / 844)).toBe("narrow");
    expect(stillCut(0.7999)).toBe("narrow");
    expect(stillCut(0.8)).toBe("square");
    expect(stillCut(1)).toBe("square");
    expect(stillCut(1.1999)).toBe("square");
    expect(stillCut(1.2)).toBe("wide");
    expect(stillCut(1440 / 900)).toBe("wide");
  });
  it("writes each line as a strict less-than old Safari understands", () => {
    expect(STILL_MEDIA.narrow).toBe("not all and (min-aspect-ratio: 800/1000)");
    expect(STILL_MEDIA.square).toBe("not all and (min-aspect-ratio: 1200/1000)");
  });
  it("names the files and orders the sources AVIF before WebP, narrow to wide", () => {
    expect(heroStillSrc("dark", "square", "webp")).toBe("/coil/hero-dark-square.webp");
    expect(stillSources("light").map((s) => [s.media ?? "", s.type, s.src])).toEqual([
      [STILL_MEDIA.narrow, "image/avif", "/coil/hero-light-narrow.avif"],
      [STILL_MEDIA.narrow, "image/webp", "/coil/hero-light-narrow.webp"],
      [STILL_MEDIA.square, "image/avif", "/coil/hero-light-square.avif"],
      [STILL_MEDIA.square, "image/webp", "/coil/hero-light-square.webp"],
      ["", "image/avif", "/coil/hero-light-wide.avif"],
    ]);
    expect(stillFallback("dark")).toBe("/coil/hero-dark-wide.webp");
  });
});

describe("still cause", () => {
  it("names reduced motion first, then a missing context, else a scene that failed", () => {
    expect(stillCause({ reducedMotion: true, hasApi: false, failure: "unavailable" })).toBe("reducedMotion");
    expect(stillCause({ reducedMotion: false, hasApi: false, failure: null })).toBe("noWebgl");
    expect(stillCause({ reducedMotion: false, hasApi: true, failure: "noWebgl" })).toBe("noWebgl");
    expect(stillCause({ reducedMotion: false, hasApi: true, failure: "unavailable" })).toBe("unavailable");
  });
});

// Every length of a baked lockup times s, every x plus ox, every y plus oy.
function mapped(r: BakedLockup, s: number, ox: number, oy: number): BakedLockup {
  return {
    left: r.left * s + ox,
    baseline: r.baseline * s + oy,
    width: r.width * s,
    fontPx: r.fontPx * s,
    greeting: { left: r.greeting.left * s + ox, baseline: r.greeting.baseline * s + oy, fontPx: r.greeting.fontPx * s },
    gradient: { top: r.gradient.top * s + oy, height: r.gradient.height * s },
  };
}

function expectClose(actual: BakedLockup, expected: BakedLockup) {
  const flat = (r: BakedLockup) => [r.left, r.baseline, r.width, r.fontPx, r.greeting.left, r.greeting.baseline, r.greeting.fontPx, r.gradient.top, r.gradient.height];
  flat(actual).forEach((v, i) => expect(v).toBeCloseTo(flat(expected)[i], 6));
}

describe("the baked lockup through object-fit cover", () => {
  const cuts: StillCut[] = ["wide", "square", "narrow"];

  it("records a lockup inside each cut, the greeting above the name", () => {
    for (const cut of cuts) {
      const r = HERO_STILL_RECTS[cut];
      const { width, height } = HERO_STILL_SIZE[cut];
      expect(r.left, cut).toBeGreaterThan(0);
      expect(r.left + r.width, cut).toBeLessThan(width);
      expect(r.baseline, cut).toBeLessThan(height);
      expect(r.fontPx, cut).toBeGreaterThan(0);
      expect(r.greeting.baseline, cut).toBeLessThan(r.baseline - r.fontPx * 0.5);
      expect(r.gradient.top, cut).toBeLessThan(r.baseline);
    }
  });

  it("returns the recorded lockup at the cut's own size", () => {
    for (const cut of cuts) {
      const { width, height } = HERO_STILL_SIZE[cut];
      expectClose(bakedLockupRect(cut, width, height), HERO_STILL_RECTS[cut]);
    }
  });

  it("scales by height and crops the sides equally in a taller box", () => {
    // 1440x1200 on the wide cut: s = 1200 / 900, the image 1920 wide, 240 cropped each side.
    expectClose(bakedLockupRect("wide", 1440, 1200), mapped(HERO_STILL_RECTS.wide, 4 / 3, -240, 0));
    // 1000x1150 on the square cut: s = 1.15, 75 cropped each side.
    expectClose(bakedLockupRect("square", 1000, 1150), mapped(HERO_STILL_RECTS.square, 1.15, -75, 0));
    // 390x900 on the narrow cut: s = 900 / 844.
    const s = 900 / 844;
    expectClose(bakedLockupRect("narrow", 390, 900), mapped(HERO_STILL_RECTS.narrow, s, (390 - 390 * s) / 2, 0));
  });

  it("scales by width and crops top and bottom equally in a wider box", () => {
    // 1920x900 on the wide cut: s = 1920 / 1440, the image 1200 tall, 150 cropped top and bottom.
    expectClose(bakedLockupRect("wide", 1920, 900), mapped(HERO_STILL_RECTS.wide, 4 / 3, 0, -150));
    // 1180x1000 on the square cut: s = 1.18.
    expectClose(bakedLockupRect("square", 1180, 1000), mapped(HERO_STILL_RECTS.square, 1.18, 0, -90));
    // 820x1180 on the narrow cut: s = 820 / 390.
    const s = 820 / 390;
    expectClose(bakedLockupRect("narrow", 820, 1180), mapped(HERO_STILL_RECTS.narrow, s, 0, (1180 - 844 * s) / 2));
  });

  it("scales uniformly in a box of the cut's aspect", () => {
    expectClose(bakedLockupRect("wide", 1280, 800), mapped(HERO_STILL_RECTS.wide, 1280 / 1440, 0, 0));
  });
});
