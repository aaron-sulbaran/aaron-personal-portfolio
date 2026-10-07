import { describe, expect, it } from "vitest";
import { newCssCache, rgbCss, rgbaCss } from "./cssCache";

describe("the per-slot colour string cache", () => {
  it("returns the cached string, without building, while the rounded triple holds", () => {
    const cache = newCssCache(2);
    const first = rgbCss(cache, 0, 10.2, 20.4, 30.1);
    expect(first).toBe("rgb(10,20,30)");
    expect(cache.built).toBe(1);
    expect(rgbCss(cache, 0, 9.8, 19.6, 29.9)).toBe(first);
    expect(rgbCss(cache, 0, 10, 20, 30)).toBe(first);
    expect(cache.built).toBe(1);
  });
  it("builds a new string once the rounded triple changes", () => {
    const cache = newCssCache(1);
    rgbCss(cache, 0, 10, 20, 30);
    expect(rgbCss(cache, 0, 10, 20, 31)).toBe("rgb(10,20,31)");
    expect(cache.built).toBe(2);
    expect(rgbCss(cache, 0, 10, 20, 31)).toBe("rgb(10,20,31)");
    expect(cache.built).toBe(2);
  });
  it("keeps each slot apart", () => {
    const cache = newCssCache(2);
    rgbCss(cache, 0, 1, 2, 3);
    expect(rgbCss(cache, 1, 4, 5, 6)).toBe("rgb(4,5,6)");
    expect(rgbCss(cache, 0, 1, 2, 3)).toBe("rgb(1,2,3)");
    expect(cache.built).toBe(2);
  });
  it("starts empty, so a black first colour still builds", () => {
    const cache = newCssCache(1);
    expect(rgbCss(cache, 0, 0, 0, 0)).toBe("rgb(0,0,0)");
    expect(cache.built).toBe(1);
  });
  it("keys an rgba slot on the triple and the alpha in thousandths", () => {
    const cache = newCssCache(1);
    const ink: [number, number, number] = [245, 242, 236];
    expect(rgbaCss(cache, 0, ink, 0.85)).toBe("rgba(245,242,236,0.850)");
    expect(rgbaCss(cache, 0, ink, 0.8501)).toBe("rgba(245,242,236,0.850)");
    expect(cache.built).toBe(1);
    expect(rgbaCss(cache, 0, ink, 0.4)).toBe("rgba(245,242,236,0.400)");
    expect(rgbaCss(cache, 0, [0, 0, 0], 0.4)).toBe("rgba(0,0,0,0.400)");
    expect(cache.built).toBe(3);
  });
});
