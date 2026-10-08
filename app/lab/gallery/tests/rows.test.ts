import { describe, expect, it } from "vitest";
import { columnBox, fitWhole, gallerySizes, interleave, isWide, panelWidthIn, readingOrder, stageLayout, textColumn, wideBox } from "../rows";

const V = 3 / 4;
const H = 4 / 3;

describe("interleave", () => {
  it("pairs vertical photos beside their blocks, alternating sides from the left", () => {
    // Capital One: five blocks, three vertical summers.
    const rows = interleave(5, [
      { block: 1, aspect: V },
      { block: 2, aspect: V },
      { block: 3, aspect: V },
    ]);
    expect(rows).toEqual([
      { kind: "text", block: 0 },
      { kind: "pair", block: 1, photo: 0, side: "left" },
      { kind: "pair", block: 2, photo: 1, side: "right" },
      { kind: "pair", block: 3, photo: 2, side: "left" },
      { kind: "text", block: 4 },
    ]);
  });

  it("stacks a horizontal photo above its block and alternates only the side-by-side rows", () => {
    // Hackathons: a horizontal, then two verticals.
    const rows = interleave(4, [
      { block: 0, aspect: 1.41 },
      { block: 1, aspect: V },
      { block: 2, aspect: V },
    ]);
    expect(rows).toEqual([
      { kind: "stack", block: 0, photo: 0 },
      { kind: "pair", block: 1, photo: 1, side: "left" },
      { kind: "pair", block: 2, photo: 2, side: "right" },
      { kind: "text", block: 3 },
    ]);
  });

  it("gives each horizontal extra its own row and groups vertical extras between them", () => {
    // Misuki: two paired verticals, then a horizontal and a vertical extra.
    const misuki = interleave(2, [{ block: 0, aspect: V }, { block: 1, aspect: V }, { aspect: H }, { aspect: V }]);
    expect(misuki.slice(2)).toEqual([
      { kind: "wide", photo: 2 },
      { kind: "photos", photos: [3], side: "left" },
    ]);
    const mixed = interleave(1, [{ aspect: V }, { aspect: V }, { aspect: 2 }, { aspect: V }, { aspect: 0.8 }]);
    expect(mixed).toEqual([
      { kind: "text", block: 0 },
      { kind: "photos", photos: [0, 1], side: "left" },
      { kind: "wide", photo: 2 },
      { kind: "photos", photos: [3, 4], side: "right" },
    ]);
  });

  it("decides wide by the threshold, so the 1.15:1 booth print can go either way", () => {
    // Mentorship: the flown 3:4 card picture, the 1.15:1 booth print, two 4:3 extras.
    const photos = [{ block: 0, aspect: V }, { block: 1, aspect: 1.15 }, { aspect: H }, { aspect: H }];
    expect(interleave(2, photos, { wideFrom: 1.1 }).map((r) => r.kind)).toEqual(["pair", "stack", "wide", "wide"]);
    expect(interleave(2, photos, { wideFrom: 1.2 }).map((r) => r.kind)).toEqual(["pair", "pair", "wide", "wide"]);
    expect(isWide(1.1, 1.1)).toBe(true);
  });

  it("puts every photo after a card's only block, and a second claim on a block becomes an extra", () => {
    expect(interleave(1, [{ block: 0, aspect: V }]).map((r) => r.kind)).toEqual(["text", "photos"]);
    const rows = interleave(3, [{ block: 0, aspect: V }, { block: 0, aspect: V }, { block: 7, aspect: V }]);
    expect(rows[3]).toEqual({ kind: "photos", photos: [1, 2], side: "right" });
  });

  it("reads the photos in row order, every kind included", () => {
    const rows = interleave(3, [{ aspect: H }, { block: 2, aspect: V }, { block: 0, aspect: 2 }, { aspect: V }]);
    expect(readingOrder(rows)).toEqual([2, 1, 0, 3]);
  });
});

describe("boxes", () => {
  it("fits a photo whole inside a box, by width or by height", () => {
    expect(fitWhole(V, 318, 464)).toEqual({ width: 318, height: 424 });
    expect(fitWhole(2, 318, 464)).toEqual({ width: 318, height: 159 });
    expect(fitWhole(0.8, 600, 300)).toEqual({ width: 240, height: 300 });
    expect(fitWhole(0, 300, 300)).toEqual({ width: 0, height: 0 });
  });

  it("draws a vertical photo at the column's width and its own height", () => {
    expect(columnBox(V, 356).height).toBeCloseTo(474.67);
    expect(columnBox(0.8, 356).height).toBeCloseTo(445);
  });

  it("spans a horizontal photo across the row up to the height cap, never under 320px", () => {
    expect(wideBox(2, 864, 420)).toEqual({ width: 840, height: 420 });
    const fourThree = wideBox(H, 864, 420);
    expect(fourThree.width).toBeCloseTo(560);
    expect(fourThree.height).toBeCloseTo(420);
    expect(wideBox(1.15, 864, 200).width).toBe(320);
    expect(wideBox(1.87, 600, 720).width).toBe(600);
  });

  it("lays out the phone stage per photo or at the tallest", () => {
    // 390 by 844: inner width 318, cap 55 percent of 844.
    const each = stageLayout([V, H, 2], 318, 464.2, "each");
    expect(each.heights.map(Math.round)).toEqual([424, 239, 159]);
    const tallest = stageLayout([V, H, 2], 318, 464.2, "tallest");
    expect(tallest.heights.map(Math.round)).toEqual([424, 424, 424]);
    expect(tallest.boxes[2].width).toBe(318);
    // 360 by 740 with a 4:5 photo: the height cap binds.
    const short = stageLayout([0.8], 288, 333, "each");
    expect(short.boxes[0].height).toBeCloseTo(333);
    expect(short.boxes[0].width).toBeCloseTo(266.4);
  });
});

describe("widths", () => {
  it("leaves the text column the panel's inner width less the photo and the gap", () => {
    expect(textColumn(944, 40, 356, 56)).toEqual({ inner: 864, width: 452, roomy: true });
    expect(textColumn(840, 40, 440, 96).roomy).toBe(false);
  });

  it("caps the panel by the viewport less the backdrop's padding", () => {
    expect(panelWidthIn(1440, 944, 40)).toBe(944);
    expect(panelWidthIn(1024, 1040, 40)).toBe(944);
  });

  it("asks for the drawn width, scaled when the source is wider than the drawn shape", () => {
    expect(gallerySizes(V, V, 356)).toBe("(max-width: 1023px) calc(100vw - 72px), 356px");
    expect(gallerySizes(1.5, V, 356)).toBe("(max-width: 1023px) calc((100vw - 72px) * 2), 712px");
    expect(gallerySizes(1.5, 1.5, 840)).toBe("(max-width: 1023px) calc(100vw - 72px), 840px");
  });
});
