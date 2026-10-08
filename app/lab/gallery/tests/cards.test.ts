import { describe, expect, it } from "vitest";
import { CARD_PICTURE, CARDS, drawnShape, runsOf } from "../cards";
import { interleave, readingOrder } from "../rows";

describe("runsOf", () => {
  it("splits bold, italic and tip runs out of the approved markup", () => {
    expect(runsOf("**2024, business analyst.** My first *look*.")).toEqual([
      { text: "2024, business analyst.", bold: true },
      { text: " My first " },
      { text: "look", italic: true },
      { text: "." },
    ]);
    expect(runsOf("a nod to [Fast and Furious](tip:misuki-suk). I")).toEqual([{ text: "a nod to " }, { text: "Fast and Furious", tip: "misuki-suk" }, { text: ". I" }]);
    expect(runsOf("Plain.")).toEqual([{ text: "Plain." }]);
  });
});

describe("the lab's cards", () => {
  it("keep the brief's rules: at most four photos, first-person alt text, every photo placed once", () => {
    for (const card of CARDS) {
      expect(card.photos.length).toBeLessThanOrEqual(4);
      for (const photo of card.photos) expect(photo.alt).toMatch(/^(Me|My|Our)\b/);
      const refs = card.photos.map((p, i) => ({ block: p.block, aspect: drawnShape(card, i) }));
      expect(readingOrder(interleave(card.blocks.length, refs)).sort()).toEqual(card.photos.map((_, i) => i));
    }
  });

  it("draw the flown card picture at 3:4 and every other photo at its own shape or the override", () => {
    const hackathons = CARDS.find((c) => c.id === "hackathons")!;
    expect(drawnShape(hackathons, 1, 2)).toBe(CARD_PICTURE);
    expect(drawnShape(hackathons, 0)).toBeCloseTo(1.41);
    expect(drawnShape(hackathons, 0, 2)).toBe(2);
  });

  it("carry the four-photo cards and a caption on every non-flown photo", () => {
    expect(CARDS.filter((c) => c.photos.length === 4).map((c) => c.id)).toEqual(["mentorship", "misuki"]);
    for (const card of CARDS) card.photos.forEach((p, i) => i !== card.flownPhoto && expect(p.caption).toBeTruthy());
  });
});
