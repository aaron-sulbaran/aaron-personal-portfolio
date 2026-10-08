import { describe, expect, it } from "vitest";
import { CARDS, runsOf } from "../cards";
import { interleave } from "../rows";

describe("runsOf", () => {
  it("splits bold and italic runs out of the approved markup", () => {
    expect(runsOf("**2024, business analyst.** My first *look*.")).toEqual([
      { text: "2024, business analyst.", bold: true },
      { text: " My first " },
      { text: "look", italic: true },
      { text: "." },
    ]);
    expect(runsOf("Plain.")).toEqual([{ text: "Plain." }]);
  });
});

describe("the lab's cards", () => {
  it("keep the brief's rules: at most three photos, alt text in first person, every photo placed", () => {
    for (const card of CARDS) {
      expect(card.photos.length).toBeLessThanOrEqual(3);
      for (const photo of card.photos) expect(photo.alt).toMatch(/^(Me|My|Our)\b/);
      const rows = interleave(card.blocks.length, card.photos);
      const placed = rows.flatMap((r) => (r.kind === "pair" ? [r.photo] : r.kind === "photos" ? r.photos : []));
      expect(placed.sort()).toEqual(card.photos.map((_, i) => i));
    }
  });
});
