import { describe, expect, it } from "vitest";
import { HORIZON, PHONE_MAX_PX, bandLayout, horizonLayout } from "@/lib/waveform/layout";

describe("bandLayout", () => {
  it("spreads columns across the full width, centered", () => {
    const layout = bandLayout(1440, 260);
    const first = layout.startX;
    const last = layout.startX + (layout.columns - 1) * layout.spacing;
    expect(first).toBeGreaterThan(0);
    expect(last).toBeLessThan(1440);
    expect(first).toBeCloseTo(1440 - last, 6);
    expect(layout.baseline).toBe(130);
  });

  it("draws fewer, wider-spaced columns on phones", () => {
    const phone = bandLayout(PHONE_MAX_PX - 377, 180);
    const desktop = bandLayout(1440, 260);
    expect(phone.spacing).toBeGreaterThan(desktop.spacing);
    expect(phone.columns).toBeLessThan(30);
  });

  it("keeps an empty canvas empty", () => {
    expect(bandLayout(0, 0).columns).toBe(0);
  });
});

describe("horizonLayout", () => {
  it("shares the band's columns at one width, on a baseline 72px above the bottom", () => {
    const band = bandLayout(1440, 300);
    const horizon = horizonLayout(1440);
    expect([horizon.columns, horizon.startX, horizon.spacing]).toEqual([band.columns, band.startX, band.spacing]);
    expect(horizon.baseline).toBe(HORIZON.height - 72);
    expect(horizon.maxAmp).toBe(44);
    expect(horizon.maxThick).toBe(6);
  });
});
