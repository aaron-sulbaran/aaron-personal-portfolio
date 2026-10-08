import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAR_D, BAR_PTS, BOLT_D, BOLT_PTS, LEG_D, LEG_PTS, VIEW_BOX, type Point } from "@/lib/mark/geometry";

const asPath = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;

describe("the mark's geometry", () => {
  it("is the brand file's three paths and viewBox, character for character", () => {
    const svg = readFileSync("public/brand/as-mark-ink.svg", "utf8");
    expect(svg).toContain(`viewBox="${VIEW_BOX}"`);
    for (const d of [BOLT_D, LEG_D, BAR_D]) expect(svg).toContain(`d="${d}"`);
  });

  it("lists the same points the paths draw", () => {
    expect([asPath(BOLT_PTS), asPath(LEG_PTS), asPath(BAR_PTS)]).toEqual([BOLT_D, LEG_D, BAR_D]);
  });
});
