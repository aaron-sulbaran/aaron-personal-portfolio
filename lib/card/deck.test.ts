import { describe, expect, it } from "vitest";
import { quickEntries } from "@/lib/content/quick";
import { strandOrder } from "@/lib/content/cards";
import { yearRows } from "@/lib/quick/years";
import { deckOf, homeDeck, placeIn, stepFrom } from "./deck";

describe("the card deck the modal steps through", () => {
  it("is page 2's columns in reading order, Work then Builds, every card once", () => {
    expect(homeDeck).toEqual([
      "capital-one", "anthropic", "ieee", "fsdatalink", "jobs", "mentorship",
      "min-max", "talos", "this-site", "hackathons", "building-in-public", "band", "misuki", "travel",
    ]);
    expect([...homeDeck].sort()).toEqual([...strandOrder].sort());
  });

  it("is the MVP's tiles top to bottom, a card with several tiles at its first", () => {
    const deck = deckOf(yearRows(quickEntries).flatMap((row) => row.entries.map((entry) => entry.id)));
    expect(deck).toHaveLength(14);
    expect([...deck].sort()).toEqual([...strandOrder].sort());
    expect(deck[deck.length - 1]).toBe("band");
    expect(deck.indexOf("jobs")).toBeLessThan(deck.indexOf("ieee"));
  });

  it("steps one card either way and stops at the ends", () => {
    expect(stepFrom(homeDeck, "ieee", 1)).toBe("fsdatalink");
    expect(stepFrom(homeDeck, "ieee", -1)).toBe("anthropic");
    expect(stepFrom(homeDeck, "mentorship", 1)).toBe("min-max");
    expect(stepFrom(homeDeck, "capital-one", -1)).toBeNull();
    expect(stepFrom(homeDeck, "travel", 1)).toBeNull();
    expect(stepFrom(["band"], "talos", 1)).toBeNull();
  });

  it("counts a card's place from one", () => {
    expect(placeIn(homeDeck, "capital-one")).toBe(1);
    expect(placeIn(homeDeck, "travel")).toBe(14);
  });
});
