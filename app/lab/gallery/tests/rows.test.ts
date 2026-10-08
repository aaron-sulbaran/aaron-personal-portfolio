import { describe, expect, it } from "vitest";
import { gallerySizes, interleave, panelWidthIn, readingOrder, stageBox, textColumn } from "../rows";

describe("interleave", () => {
  it("pairs each photo with its block, alternating sides from the left", () => {
    // Capital One: five blocks, the three summers carry a photo each.
    const rows = interleave(5, [{ block: 1 }, { block: 2 }, { block: 3 }]);
    expect(rows).toEqual([
      { kind: "text", block: 0 },
      { kind: "pair", block: 1, photo: 0, side: "left" },
      { kind: "pair", block: 2, photo: 1, side: "right" },
      { kind: "pair", block: 3, photo: 2, side: "left" },
      { kind: "text", block: 4 },
    ]);
  });

  it("puts extras after the last block and keeps alternating", () => {
    // Mentorship: two blocks, two paired photos and one after.
    const rows = interleave(2, [{ block: 0 }, { block: 1 }, {}]);
    expect(rows).toEqual([
      { kind: "pair", block: 0, photo: 0, side: "left" },
      { kind: "pair", block: 1, photo: 1, side: "right" },
      { kind: "photos", photos: [2], side: "left" },
    ]);
  });

  it("puts every photo after a card's only block", () => {
    const rows = interleave(1, [{ block: 0 }, { block: 0 }, {}]);
    expect(rows).toEqual([
      { kind: "text", block: 0 },
      { kind: "photos", photos: [0, 1], side: "left" },
      { kind: "photos", photos: [2], side: "right" },
    ]);
  });

  it("turns a second claim on a block, or a block the card lacks, into an extra", () => {
    const rows = interleave(3, [{ block: 0 }, { block: 0 }, { block: 7 }]);
    expect(rows.map((r) => r.kind)).toEqual(["pair", "text", "text", "photos"]);
    expect(rows[3]).toEqual({ kind: "photos", photos: [1, 2], side: "right" });
  });

  it("honours the extras per row, never below one", () => {
    expect(interleave(2, [{}, {}, {}], 1).filter((r) => r.kind === "photos")).toHaveLength(3);
    expect(interleave(2, [{}, {}, {}], 0).filter((r) => r.kind === "photos")).toHaveLength(3);
  });

  it("reads the photos in row order", () => {
    expect(readingOrder(interleave(4, [{}, { block: 2 }, { block: 0 }]))).toEqual([2, 1, 0]);
  });

  it("has no rows for no blocks and no photos", () => {
    expect(interleave(0, [])).toEqual([]);
  });
});

describe("widths", () => {
  it("leaves the text column the panel's inner width less the photo and the gap", () => {
    expect(textColumn(928, 40, 380, 56)).toEqual({ inner: 848, width: 412, roomy: true });
    expect(textColumn(840, 40, 440, 96).roomy).toBe(false);
  });

  it("caps the panel by the viewport less the backdrop's padding", () => {
    expect(panelWidthIn(1440, 928, 40)).toBe(928);
    expect(panelWidthIn(1024, 1040, 40)).toBe(944);
  });

  it("bounds the phone stage by height share or by width", () => {
    // 390 by 844: the panel's inner width is 318, so the width binds.
    const phone = stageBox(318, 844, 55);
    expect(phone.width).toBe(318);
    expect(phone.height).toBeCloseTo(424);
    expect(phone.heightBound).toBe(false);
    // A short, wide viewport: the height binds at its share.
    const short = stageBox(600, 600, 50);
    expect(short.height).toBeCloseTo(300);
    expect(short.share).toBeCloseTo(0.5);
    expect(short.heightBound).toBe(true);
  });

  it("scales sizes for a source wider than 3:4", () => {
    expect(gallerySizes(3 / 4, 380)).toBe("(max-width: 1023px) calc(100vw - 72px), 380px");
    expect(gallerySizes(1084 / 724, 380)).toBe("(max-width: 1023px) calc((100vw - 72px) * 1.996), 759px");
  });
});
