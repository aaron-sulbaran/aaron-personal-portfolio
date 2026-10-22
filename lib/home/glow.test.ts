import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { glowGeometry, glowMaskCss, type GlowInput } from "@/lib/home/glow";

// A desktop intro: the container at x=100 in a 1440 viewport, the heading 96px
// tall 112px under the intro's top, the paragraph 28px under the heading.
const desktop: GlowInput = {
  containerLeft: 100,
  viewportWidth: 1440,
  headingTop: 112,
  headingHeight: 96,
  textLeft: 0,
  textWidth: 600,
  paragraphTop: 112 + 96 + 28,
  layerTop: 0,
  knobs: { size: 1, offsetX: COIL.deal.glow.offsetX, offsetY: 0, strength: 0.9 },
};

describe("the glow's geometry", () => {
  it("covers the viewport's width and ends at the paragraph's top", () => {
    const { box } = glowGeometry(desktop);
    expect(box.x).toBe(-100);
    expect(box.w).toBe(1440);
    expect(box.y + box.h).toBe(desktop.paragraphTop);
  });

  it("falls to nothing above the paragraph, at any size, offset or heading height", () => {
    for (const size of [0.3, 1, 2]) {
      for (const offsetY of [-0.5, 0, 0.5]) {
        for (const headingHeight of [60, 96, 192]) {
          const input: GlowInput = { ...desktop, headingHeight, paragraphTop: desktop.headingTop + headingHeight + 28, knobs: { ...desktop.knobs, size, offsetY } };
          const { box, mask } = glowGeometry(input);
          expect(mask.cy + mask.ry, `size ${size} offsetY ${offsetY} h ${headingHeight}`).toBeLessThanOrEqual(box.h + 1e-9);
          expect(mask.cy - mask.ry).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    }
  });

  it("spreads into the empty space right of the heading on a wide page, and stays inside the viewport", () => {
    const { box, mask } = glowGeometry(desktop);
    const rightOfText = box.x + mask.cx + mask.rx - (desktop.textLeft + desktop.textWidth);
    expect(rightOfText).toBeGreaterThan(40);
    expect(mask.cx - mask.rx).toBeGreaterThanOrEqual(-1e-9);
    expect(mask.cx + mask.rx).toBeLessThanOrEqual(box.w + 1e-9);
  });

  it("scales its radii with the size knob until the box or the viewport holds it", () => {
    const small = glowGeometry({ ...desktop, knobs: { ...desktop.knobs, size: 0.5 } }).mask;
    const large = glowGeometry({ ...desktop, knobs: { ...desktop.knobs, size: 1 } }).mask;
    expect(small.rx).toBeLessThan(large.rx);
    expect(small.ry).toBeLessThan(large.ry + 1e-9);
  });

  it("moves its center with the offset knobs and carries the strength, held to 0..1", () => {
    const base = glowGeometry(desktop).mask;
    const moved = glowGeometry({ ...desktop, knobs: { ...desktop.knobs, offsetX: desktop.knobs.offsetX + 0.2 } }).mask;
    expect(moved.cx).toBeGreaterThan(base.cx);
    expect(glowGeometry({ ...desktop, knobs: { ...desktop.knobs, strength: 3 } }).mask.k).toBe(1);
    expect(glowGeometry({ ...desktop, knobs: { ...desktop.knobs, strength: -1 } }).mask.k).toBe(0);
  });

  it("fits a phone: the heading fills the width, the glow stays within the screen and above the paragraph", () => {
    const phone: GlowInput = { ...desktop, containerLeft: 23, viewportWidth: 390, headingTop: 112, headingHeight: 112, textLeft: 0, textWidth: 300, paragraphTop: 112 + 112 + 32 };
    const { box, mask } = glowGeometry(phone);
    expect(mask.cx - mask.rx).toBeGreaterThanOrEqual(-1e-9);
    expect(mask.cx + mask.rx).toBeLessThanOrEqual(box.w + 1e-9);
    expect(mask.cy + mask.ry).toBeLessThanOrEqual(box.h + 1e-9);
  });
});

describe("the poster fallback's mask", () => {
  it("is a radial gradient with the geometry's center and radii, ending clear", () => {
    const geo = glowGeometry(desktop);
    const css = glowMaskCss(geo);
    expect(css.startsWith("radial-gradient(ellipse ")).toBe(true);
    expect(css).toContain(`${geo.mask.rx.toFixed(1)}px ${geo.mask.ry.toFixed(1)}px at ${geo.mask.cx.toFixed(1)}px ${geo.mask.cy.toFixed(1)}px`);
    expect(css.endsWith("rgba(0,0,0,0) 100%)")).toBe(true);
    expect(css).toContain(`rgba(0,0,0,${geo.mask.k.toFixed(3)}) 0%`);
  });
});
