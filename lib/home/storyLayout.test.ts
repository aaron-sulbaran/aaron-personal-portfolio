import { describe, expect, it } from "vitest";
import { ABOUT_BLOCKS, FIRST_SCREEN_BLOCKS, PHONE_MOVABLE_BLOCK, phoneBlock2Shows, staggerPlan } from "@/lib/home/storyLayout";
import { siteContent } from "@/lib/content";

describe("the paragraph blocks' stagger", () => {
  it("alternates left and right, starting on the left", () => {
    expect(staggerPlan(4, 0.6).map((step) => step.side)).toEqual(["left", "right", "left", "right"]);
    expect(staggerPlan(3, 0.6).map((step) => step.side)).toEqual(["left", "right", "left"]);
  });

  it("pushes only the right blocks, by the offset", () => {
    expect(staggerPlan(4, 0.6).map((step) => step.shift)).toEqual([0, 0.6, 0, 0.6]);
  });

  it("holds the offset to 0 through 1 and treats a bad number as 0", () => {
    expect(staggerPlan(2, 3)[1].shift).toBe(1);
    expect(staggerPlan(2, -1)[1].shift).toBe(0);
    expect(staggerPlan(2, Number.NaN)[1].shift).toBe(0);
  });

  it("plans nothing for no blocks", () => {
    expect(staggerPlan(0, 0.5)).toEqual([]);
    expect(staggerPlan(-2, 0.5)).toEqual([]);
  });
});

describe("where the story's blocks are told", () => {
  it("tells blocks 1 and 2 on the first screen and 3 and 4 in the about section, each block once", () => {
    expect([...FIRST_SCREEN_BLOCKS, ...ABOUT_BLOCKS]).toEqual([0, 1, 2, 3]);
    expect(siteContent.intro.blocks).toHaveLength(4);
  });

  it("lets a phone's first screen take block 2 or leave it to the about section, never both", () => {
    expect(PHONE_MOVABLE_BLOCK).toBe(1);
    expect(phoneBlock2Shows("about")).toEqual({ firstScreen: false, about: true });
    expect(phoneBlock2Shows("first")).toEqual({ firstScreen: true, about: false });
  });
});
