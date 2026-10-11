import { describe, expect, it } from "vitest";
import { cardDims, circlesLayout, containBox, faceGround, logoBox, MARK_INK_BOX, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { strandCardByKey } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { BAR_PTS, BOLT_PTS, LEG_PTS } from "@/lib/mark/geometry";

describe("a logo on its tile", () => {
  it("draws a mark's longer side at 40 percent and a wordmark across 64 percent", () => {
    const minMax = logoBox(548 / 497, 384, COIL.face);
    expect([minMax.w, minMax.h].map((n) => +n.toFixed(3))).toEqual([153.6, 139.305]);
    const apple = logoBox(41.5 / 51, 384, COIL.face);
    expect([apple.w, apple.h].map((n) => +n.toFixed(3))).toEqual([124.988, 153.6]);
    expect(logoBox(578.9 / 65, 384, COIL.face).w).toBeCloseTo(245.76, 2);
    expect(logoBox(0, 384, COIL.face)).toEqual({ w: 0, h: 0 });
  });
  it("contains a logo in a square", () => {
    expect(containBox(2, 100)).toEqual({ w: 100, h: 50 });
    expect(containBox(0.5, 100)).toEqual({ w: 50, h: 100 });
  });
  it("puts a light plate only under a plain tile's logo with no dark file, in the dark theme, unless it is opaque", () => {
    expect(needsGround({ srcDark: null }, "plain", true)).toBe(true);
    expect(needsGround({ srcDark: null }, "plain", false)).toBe(false);
    expect(needsGround({ srcDark: "/x-on-dark.svg" }, "plain", true)).toBe(false);
    expect(needsGround({ srcDark: null, opaque: true }, "plain", true)).toBe(false);
    expect(needsGround({ srcDark: null }, "anvil", true)).toBe(false);
  });
  it("fills the whole face with an opaque logo's ground, and with nothing for any other logo", () => {
    expect(faceGround({ opaque: true, ground: "#14183e" })).toBe("#14183e");
    expect(faceGround({ opaque: true })).toBeNull();
    expect(faceGround({ ground: "#14183e" })).toBeNull();
    expect(faceGround({})).toBeNull();
  });
  it("gives the IEEE square its measured edge colour, in a hex the canvas and the tile both read", () => {
    const face = strandCardByKey.get("ieee")?.face;
    expect(face?.kind === "logo" ? faceGround(face.logo) : null).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Talos's mark in the phone header's tile", () => {
  it("is never under its kit's 20px, where the plain phone tile would draw it smaller", () => {
    const face = strandCardByKey.get("talos")?.face;
    const aspect = face?.kind === "logo" ? face.logo.width / face.logo.height : 0;
    expect(logoBox(aspect, GALLERY.talosTileCompact.width, COIL.face).w).toBeGreaterThanOrEqual(GALLERY.talosMarkMinPx);
    expect(logoBox(aspect, GALLERY.headerTileCompact.width, COIL.face).w).toBeLessThan(GALLERY.talosMarkMinPx);
  });
});

describe("the jobs card's circles", () => {
  const aspect = COIL.cardAspect;
  const circles = circlesLayout(5, aspect, COIL.face.circles);
  const inset = cardDims(COIL.lab.textureSize).inset / COIL.lab.textureSize[0];
  it("grow from the oldest job to the newest, bottom left to top right", () => {
    expect(circles.map((c) => +(c.r * 2).toFixed(3))).toEqual([0.16, 0.2, 0.24, 0.28, 0.32]);
    for (let i = 1; i < 5; i++) {
      expect(circles[i].x).toBeGreaterThan(circles[i - 1].x);
      expect(circles[i].y).toBeLessThan(circles[i - 1].y);
    }
  });
  it("never touch, and stay inside the card's inset", () => {
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) expect(Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y)).toBeGreaterThanOrEqual(circles[i].r + circles[j].r + COIL.face.circles.gap - 1e-9);
      expect(circles[i].x - circles[i].r).toBeGreaterThanOrEqual(inset);
      expect(circles[i].x + circles[i].r).toBeLessThanOrEqual(1 - inset);
      expect(circles[i].y - circles[i].r).toBeGreaterThanOrEqual(inset);
      expect(circles[i].y + circles[i].r).toBeLessThanOrEqual(1 / aspect - inset);
    }
  });
  it("sit centred on the card", () => {
    const left = Math.min(...circles.map((c) => c.x - c.r));
    const right = Math.max(...circles.map((c) => c.x + c.r));
    const top = Math.min(...circles.map((c) => c.y - c.r));
    const bottom = Math.max(...circles.map((c) => c.y + c.r));
    expect((left + right) / 2).toBeCloseTo(0.5, 9);
    expect((top + bottom) / 2).toBeCloseTo(1 / aspect / 2, 9);
    expect(circlesLayout(0, aspect, COIL.face.circles)).toEqual([]);
  });
});

describe("the AS mark alone", () => {
  it("is drawn from its ink box, half a unit outside every point", () => {
    const points = [...BOLT_PTS, ...LEG_PTS, ...BAR_PTS];
    expect(MARK_INK_BOX.x).toBeCloseTo(Math.min(...points.map(([x]) => x)) - 0.5, 2);
    expect(MARK_INK_BOX.y).toBeCloseTo(Math.min(...points.map(([, y]) => y)) - 0.5, 2);
    expect(MARK_INK_BOX.x + MARK_INK_BOX.width).toBeCloseTo(Math.max(...points.map(([x]) => x)) + 0.5, 2);
    expect(MARK_INK_BOX.y + MARK_INK_BOX.height).toBeCloseTo(Math.max(...points.map(([, y]) => y)) + 0.5, 2);
  });
});
