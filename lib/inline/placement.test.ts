import { describe, expect, it } from "vitest";
import { anchorPosition, followPosition } from "@/lib/inline/placement";
const view = { width: 1440, height: 900 };
const size = { width: 120, height: 30 };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
describe("followPosition", () => {
  it("sits below and right of the pointer, flips at the edges, and clamps", () => {
    expect(followPosition({ x: 100, y: 100 }, size, view)).toEqual({ x: 114, y: 118 });
    expect(followPosition({ x: 1400, y: 100 }, size, view)).toEqual({ x: 1266, y: 118 });
    expect(followPosition({ x: 100, y: 880 }, size, view)).toEqual({ x: 114, y: 832 });
    expect(followPosition({ x: 100, y: 100 }, { width: 2000, height: 30 }, view).x).toBe(12);
  });
});
describe("anchorPosition", () => {
  it("centres under the link, flips above near the bottom, and clamps", () => {
    expect(anchorPosition(rect(200, 300, 60, 30), size, view)).toEqual({ x: 170, y: 338 });
    expect(anchorPosition(rect(200, 850, 60, 30), size, view)).toEqual({ x: 170, y: 812 });
    expect(anchorPosition(rect(0, 300, 20, 30), size, view).x).toBe(12);
  });
});
