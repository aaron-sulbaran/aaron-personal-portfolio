import { describe, expect, it } from "vitest";
import { LATE_BLOCKS, STORY_SIDES, TOP_BLOCKS, sideOf } from "@/lib/home/storyLayout";
import { siteContent } from "@/lib/content";

describe("page 1's stagger", () => {
  it("tells both paragraphs on page 1, each once, in order: one beside the name, one after the wave", () => {
    expect([...TOP_BLOCKS, ...LATE_BLOCKS]).toEqual([0, 1]);
    expect(siteContent.intro.blocks).toHaveLength(2);
  });

  it("puts paragraph 1 right of the name and paragraph 2 on the left after the wave, so the late grid's right side is free", () => {
    expect(STORY_SIDES).toEqual(["right", "left"]);
    expect([0, 1].map(sideOf)).toEqual(["right", "left"]);
    expect(LATE_BLOCKS.map(sideOf)).toEqual(["left"]);
  });

  it("leans an unknown block left", () => {
    expect(sideOf(9)).toBe("left");
  });
});
