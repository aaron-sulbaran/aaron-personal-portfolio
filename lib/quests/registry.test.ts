import { describe, expect, it } from "vitest";
import { strandOrder } from "@/lib/content/cards";
import { ALL_QUEST_IDS, groupOf, isQuestId, questIds } from "./registry";

describe("quest registry", () => {
  it("has the 14 cards, keyed as the seen store keys them", () => {
    expect(questIds("cards")).toHaveLength(14);
    expect(questIds("cards")).toEqual(strandOrder.map((key) => `card:${key}`));
  });

  it("has the eight words page 1 offers, in the visited store's id format", () => {
    expect(questIds("pops")).toEqual([
      "def:product",
      "pop:3d-printing",
      "pop:family",
      "pop:friends",
      "pop:leadership-award",
      "pop:thrill-seeker",
      "pop:venezuela-flag",
      "pop:wanderlust",
    ]);
  });

  it("has two eggs and the MVP", () => {
    expect(questIds("eggs")).toEqual(["egg:logo", "egg:period"]);
    expect(questIds("mvp")).toEqual(["mvp:quick"]);
  });

  it("has unique ids that each belong to one group", () => {
    expect(new Set(ALL_QUEST_IDS).size).toBe(ALL_QUEST_IDS.length);
    expect(ALL_QUEST_IDS).toHaveLength(14 + 8 + 2 + 1);
    expect(groupOf("card:talos")).toBe("cards");
    expect(groupOf("pop:family")).toBe("pops");
    expect(groupOf("nope")).toBeNull();
    expect(isQuestId("egg:period")).toBe(true);
    expect(isQuestId("card:nope")).toBe(false);
  });
});
