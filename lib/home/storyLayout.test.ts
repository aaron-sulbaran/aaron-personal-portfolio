import { describe, expect, it } from "vitest";
import { BAND_ID, MORE_ID, blockId, clampPlacement, sequenceOf, staggerPlan, storyItems } from "@/lib/home/storyLayout";

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

describe("the band's place in the story", () => {
  const read = (placement: number, where: "desktop" | "phone" = "desktop") =>
    sequenceOf(storyItems(4, { wavePlacement: placement, phoneLayout: "storyFirst" }), where);

  it("sits after block 1, 2 or 3 on request", () => {
    expect(read(1)).toEqual([blockId(1), BAND_ID, blockId(2), blockId(3), blockId(4)]);
    expect(read(2)).toEqual([blockId(1), blockId(2), BAND_ID, blockId(3), blockId(4)]);
    expect(read(3)).toEqual([blockId(1), blockId(2), blockId(3), BAND_ID, blockId(4)]);
  });

  it("is held between the blocks: never first, never the story's foot", () => {
    expect(clampPlacement(0, 4)).toBe(1);
    expect(clampPlacement(9, 4)).toBe(3);
    expect(clampPlacement(2.4, 4)).toBe(2);
    expect(clampPlacement(Number.NaN, 4)).toBe(2);
    expect(read(9)).toEqual(read(3));
  });
});

describe("the phone's arrangement", () => {
  const peeks = storyItems(4, { wavePlacement: 2, phoneLayout: "teaserPeeks" });
  const whole = storyItems(4, { wavePlacement: 2, phoneLayout: "storyFirst" });

  it("story first stacks every block, the band where it sits on a desktop, and no disclosure", () => {
    expect(sequenceOf(whole, "phone")).toEqual(sequenceOf(whole, "desktop"));
    expect(sequenceOf(whole, "phone")).not.toContain(MORE_ID);
    expect(whole.some((item) => item.collapsible)).toBe(false);
  });

  it("teaser peeks puts the name's block, the music line and the disclosure first on a phone, and folds blocks 2 to 4 behind it", () => {
    expect(sequenceOf(peeks, "phone")).toEqual([blockId(1), BAND_ID, MORE_ID, blockId(2), blockId(3), blockId(4)]);
    expect(peeks.filter((item) => item.collapsible).map((item) => item.id)).toEqual([blockId(2), blockId(3), blockId(4)]);
  });

  it("teaser peeks changes nothing on a desktop", () => {
    expect(sequenceOf(peeks, "desktop")).toEqual(sequenceOf(whole, "desktop"));
  });

  it("never folds the first block or the band", () => {
    for (const item of peeks) if (item.id === blockId(1) || item.id === BAND_ID || item.id === MORE_ID) expect(item.collapsible).toBe(false);
  });

  it("gives every item its own order on both screens", () => {
    for (const items of [peeks, whole]) {
      for (const where of ["desktop", "phone"] as const) {
        const orders = items.filter((item) => item.id !== MORE_ID).map((item) => item.order[where]);
        expect(new Set(orders).size).toBe(orders.length);
      }
    }
  });
});
