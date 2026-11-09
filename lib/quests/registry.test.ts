import { describe, expect, it } from "vitest";
import { cards, strandOrder } from "@/lib/content/cards";
import { intro } from "@/lib/content/intro";
import { ALL_QUEST_IDS, groupOf, isQuestId, questIds } from "./registry";

describe("quest registry", () => {
  it("has the 14 cards, keyed as the seen store keys them", () => {
    expect(questIds("cards")).toHaveLength(14);
    expect(questIds("cards")).toEqual(strandOrder.map((key) => `card:${key}`));
  });

  it("has the words page 1 and the cards offer, page 1 first, in the visited store's id format", () => {
    expect(questIds("pops")).toEqual([
      "def:product",
      "pop:3d-printing",
      "pop:family",
      "pop:friends",
      "pop:leadership-award",
      "pop:thrill-seeker",
      "pop:venezuela-flag",
      "pop:wanderlust",
      "pop:contrabass-clarinet",
      "pop:misuki-suki",
      "pop:rango",
      "pop:sister-kyoto",
      "tip:ieee-ao",
      "tip:this-site-playground",
    ]);
  });

  it("takes every pops id from the intro or the cards copy", () => {
    const copy = JSON.stringify([intro, cards]);
    for (const id of questIds("pops")) {
      const [kind, key] = id.split(":");
      expect(copy).toContain(`](${kind}:${key})`);
    }
  });

  it("has two eggs and the MVP", () => {
    expect(questIds("eggs")).toEqual(["egg:logo", "egg:period"]);
    expect(questIds("mvp")).toEqual(["mvp:quick"]);
  });

  it("has unique ids that each belong to one group", () => {
    expect(new Set(ALL_QUEST_IDS).size).toBe(ALL_QUEST_IDS.length);
    expect(ALL_QUEST_IDS).toHaveLength(14 + 14 + 2 + 1);
    expect(groupOf("card:talos")).toBe("cards");
    expect(groupOf("pop:family")).toBe("pops");
    expect(groupOf("nope")).toBeNull();
    expect(isQuestId("egg:period")).toBe(true);
    expect(isQuestId("card:nope")).toBe(false);
  });
});
