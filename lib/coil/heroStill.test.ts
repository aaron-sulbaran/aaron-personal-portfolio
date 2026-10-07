import { describe, expect, it } from "vitest";
import { STILL_MEDIA, heroStillSrc, stillCause, stillCut, stillFallback, stillSources } from "@/lib/coil/heroStill";

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
