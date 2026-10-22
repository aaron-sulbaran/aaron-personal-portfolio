import { describe, expect, it } from "vitest";
import { fieldFrame, maskCss, nameFieldMask, type NameFieldInput } from "@/lib/home/nameField";

const SHARES = { rxOfWidth: 0.9, ryOfHeight: 1.35 };
const KNOBS = { size: 1, offsetX: 0, offsetY: 0, strength: 1 };

function input(over: Partial<NameFieldInput> = {}): NameFieldInput {
  return {
    stage: { width: 1440, height: 560 },
    heading: { left: 427, top: 150, width: 586, height: 260 },
    knobs: KNOBS,
    shares: SHARES,
    ...over,
  };
}

describe("the field behind the name", () => {
  it("is centered on the heading", () => {
    const mask = nameFieldMask(input());
    expect(mask.cx).toBeCloseTo(427 + 586 / 2, 6);
    expect(mask.cy).toBeCloseTo(150 + 130, 6);
  });

  it("ends above the first paragraph: its falloff never reaches below the stage, at any size", () => {
    for (const size of [0.3, 0.6, 1, 1.6, 2]) {
      for (const offsetY of [-0.5, 0, 0.5]) {
        const mask = nameFieldMask(input({ knobs: { ...KNOBS, size, offsetY } }));
        expect(mask.cy + mask.ry, `size ${size} offsetY ${offsetY}`).toBeLessThanOrEqual(560 + 0.001);
        expect(mask.cy - mask.ry).toBeGreaterThanOrEqual(-0.001);
      }
    }
  });

  it("stays inside the stage's width, at any size and shift", () => {
    for (const size of [0.5, 1, 2]) {
      for (const offsetX of [-0.8, 0, 0.8]) {
        const mask = nameFieldMask(input({ knobs: { ...KNOBS, size, offsetX } }));
        expect(mask.cx - mask.rx).toBeGreaterThanOrEqual(-0.001);
        expect(mask.cx + mask.rx).toBeLessThanOrEqual(1440 + 0.001);
      }
    }
  });

  it("holds when the heading sits at the top, at the top left, and on a phone", () => {
    const layouts: NameFieldInput[] = [
      input({ stage: { width: 1440, height: 380 }, heading: { left: 427, top: 112, width: 586, height: 220 } }),
      input({ stage: { width: 1440, height: 380 }, heading: { left: 100, top: 112, width: 586, height: 220 } }),
      input({ stage: { width: 390, height: 340 }, heading: { left: 64, top: 100, width: 262, height: 130 } }),
    ];
    for (const layout of layouts) {
      const mask = nameFieldMask(layout);
      expect(mask.cy + mask.ry).toBeLessThanOrEqual(layout.stage.height + 0.001);
      expect(mask.rx).toBeGreaterThan(0);
      expect(mask.ry).toBeGreaterThan(0);
    }
  });

  it("grows with the size knob until the stage stops it", () => {
    const small = nameFieldMask(input({ knobs: { ...KNOBS, size: 0.5 } }));
    const large = nameFieldMask(input({ knobs: { ...KNOBS, size: 1 } }));
    expect(large.rx).toBeGreaterThan(small.rx);
    expect(large.ry).toBeGreaterThan(small.ry);
  });

  it("moves with the offset knobs, in shares of the heading", () => {
    const base = nameFieldMask(input());
    const moved = nameFieldMask(input({ knobs: { ...KNOBS, offsetX: 0.1, offsetY: 0.1 } }));
    expect(moved.cx - base.cx).toBeCloseTo(58.6, 6);
    expect(moved.cy - base.cy).toBeCloseTo(26, 6);
  });

  it("holds strength to 0 through 1 and never makes an empty ellipse", () => {
    expect(nameFieldMask(input({ knobs: { ...KNOBS, strength: 3 } })).k).toBe(1);
    expect(nameFieldMask(input({ knobs: { ...KNOBS, strength: -1 } })).k).toBe(0);
    const tiny = nameFieldMask(input({ stage: { width: 0, height: 0 } }));
    expect(tiny.rx).toBeGreaterThan(0);
    expect(tiny.ry).toBeGreaterThan(0);
  });
});

describe("the poster fallback's mask", () => {
  it("is the shader's falloff, scaled by the strength, as a CSS radial gradient", () => {
    const css = maskCss({ cx: 720, cy: 280, rx: 500, ry: 280, k: 0.5 });
    expect(css).toContain("ellipse 500.0px 280.0px at 720.0px 280.0px");
    expect(css).toContain("rgba(0,0,0,0.500) 0%");
    expect(css).toContain("rgba(0,0,0,0.052) 75%");
    expect(css.endsWith("rgba(0,0,0,0) 100%)")).toBe(true);
  });
});

describe("the field's frame", () => {
  it("shows the stage's share of the viewport, from the sampling height up", () => {
    const frame = fieldFrame({ width: 1440, height: 450 }, 900, 0.1);
    expect(frame.aspect).toBeCloseTo(1.6, 6);
    expect(frame.frameY).toBeCloseTo(0.5, 6);
    expect(frame.frameY0).toBe(0.1);
  });

  it("holds the sampling height to the field", () => {
    expect(fieldFrame({ width: 1, height: 1 }, 900, 3).frameY0).toBe(1);
    expect(fieldFrame({ width: 1, height: 1 }, 900, -1).frameY0).toBe(0);
  });
});
