import { describe, expect, it } from "vitest";
import { paneGutter, paneViewport } from "./pane";

const host = { left: 0, right: 1440, width: 1440, height: 900 };

describe("the helix's pane", () => {
  it("is the whole canvas when no pane shows", () => {
    expect(paneViewport(host, null)).toEqual({ width: 1440, height: 900 });
    expect(paneViewport(host, { left: 0, right: 0 })).toEqual({ width: 1440, height: 900 });
  });

  it("is the canvas less the same gutter on both sides", () => {
    expect(paneViewport(host, { left: 200, right: 1240 })).toEqual({ width: 1040, height: 900 });
  });

  it("takes the wider gutter when the columns differ, so the helix stays centered", () => {
    expect(paneViewport(host, { left: 160, right: 1240 })).toEqual({ width: 1040, height: 900 });
    expect(paneViewport(host, { left: 240, right: 1240 })).toEqual({ width: 960, height: 900 });
  });

  it("never narrows below half the canvas's height", () => {
    expect(paneViewport(host, { left: 600, right: 840 }).width).toBe(450);
  });

  it("reads the gutter back from the pane", () => {
    expect(paneGutter(1440, { width: 1040, height: 900 })).toBe(200);
    expect(paneGutter(1440, { width: 1440, height: 900 })).toBe(0);
  });
});
