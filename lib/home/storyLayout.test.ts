import { describe, expect, it } from "vitest";
import { LATE_BLOCKS, STORY_SIDES, TOP_BLOCKS, sideOf } from "@/lib/home/storyLayout";
import { siteContent } from "@/lib/content";

describe("page 1's stagger", () => {
  it("tells all four blocks on page 1, each once, in order: two around the name, two after the wave", () => {
    expect([...TOP_BLOCKS, ...LATE_BLOCKS]).toEqual([0, 1, 2, 3]);
    expect(siteContent.intro.blocks).toHaveLength(4);
  });

  it("puts block 1 right of the name, block 2 under it on the left, then block 3 on the right and block 4 on the left", () => {
    expect(STORY_SIDES).toEqual(["right", "left", "right", "left"]);
    expect([0, 1, 2, 3].map(sideOf)).toEqual(["right", "left", "right", "left"]);
  });

  it("alternates sides after the name's own row, so no two blocks stack in one column", () => {
    for (let i = 1; i < STORY_SIDES.length; i++) expect(STORY_SIDES[i]).not.toBe(STORY_SIDES[i - 1]);
  });

  it("leans an unknown block left", () => {
    expect(sideOf(9)).toBe("left");
  });
});
