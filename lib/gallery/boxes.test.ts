import { describe, expect, it } from "vitest";
import { boxFor, fitWhole, groupFrame, pageStage, phoneBox, rowColumns, stageHeight, uniformBoxes } from "@/lib/gallery/boxes";

const boxes = uniformBoxes(320, 424);
const settings = { boxes, wideFrom: 1, columnGap: 56, textWidth: 460, padding: 40, border: 1 };

describe("the desktop boxes", () => {
  it("draws every vertical photo 320 by 427 (3:4) and every horizontal one 424 by 318 (4:3), about the same area", () => {
    expect(boxes.vertical.width).toBe(320);
    expect(boxes.vertical.height).toBeCloseTo(426.667, 2);
    expect(boxes.horizontal).toEqual({ width: 424, height: 318 });
    expect(Math.abs(boxes.horizontal.width * boxes.horizontal.height - boxes.vertical.width * boxes.vertical.height) / (320 * 426.667)).toBeLessThan(0.02);
  });
  it("takes the horizontal box from square up", () => {
    expect(boxFor(1, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(1125 / 978, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(0.75, boxes, 1)).toBe(boxes.vertical);
    expect(boxFor(998 / 1600, boxes, 1)).toBe(boxes.vertical);
  });
  it("sizes the photo column to the card's widest box and the panel around it", () => {
    expect(rowColumns([0.75, 0.75, 0.75], settings)).toEqual({ slot: 320, panel: 918 });
    expect(rowColumns([0.75, 1600 / 858], settings)).toEqual({ slot: 424, panel: 1022 });
    expect(rowColumns([], settings)).toEqual({ slot: 0, panel: 542 });
  });
  it("frames a group at its largest box in each direction", () => {
    expect(groupFrame([boxes.vertical, boxes.horizontal])).toEqual({ width: 424, height: boxes.vertical.height });
    expect(groupFrame([])).toEqual({ width: 0, height: 0 });
  });
});

describe("the phone stage", () => {
  it("fits every photo whole, the frame the largest of them", () => {
    expect(fitWhole(0.75, 316, 300)).toEqual({ width: 225, height: 300 });
    expect(fitWhole(4 / 3, 316, 300)).toEqual({ width: 316, height: 237 });
    const stage = pageStage([0, 1], [0.75, 4 / 3], 316, 300);
    expect(stage.frame).toEqual({ width: 316, height: 300 });
    expect(stage.boxes.map((box) => box.width / box.height)).toEqual([0.75, 4 / 3]);
  });
  it("crops a portrait on a short stage to the share of the width it keeps, as a phone's column does", () => {
    // 316 wide, 140 tall: whole it is 105 wide, under the 60 percent (190) it keeps, so it fills that and is cropped.
    expect(phoneBox(0.75, 316, 140, 0.6)).toEqual({ width: 316 * 0.6, height: 140, cropped: true });
    // Tall enough to stay at that width whole, it is drawn whole.
    expect(phoneBox(0.75, 316, 300, 0.6)).toEqual({ width: 225, height: 300, cropped: false });
  });
  it("never crops past the share it is allowed, however wide the page", () => {
    const maxCrop = 0.3;
    for (const [width, height, aspect] of [[826, 240, 0.75], [826, 140, 0.6239], [316, 140, 0.75], [301, 202, 0.7506], [690, 200, 1]] as const) {
      const box = phoneBox(aspect, width, height, 0.6, maxCrop);
      const whole = fitWhole(aspect, width, height);
      // The share of the picture cut is one less the whole photo's width over the box's (the box is wider than the photo's own shape).
      const cut = box.cropped ? 1 - whole.width / box.width : 0;
      expect(cut, `${width} by ${height} at ${aspect}`).toBeLessThanOrEqual(maxCrop + 1e-9);
      expect(box.width).toBeLessThanOrEqual(width * 0.6 + 1e-9);
      expect(box.height).toBe(box.cropped ? height : whole.height);
    }
    // A 900 by 600 window's page: a 3:4 photo on a 240 stage kept at 60 percent of 826 was a 496 by 240 strip (64 percent cut); now a 257 by 240 box.
    const box = phoneBox(0.75, 826, 240, 0.6, 0.3);
    expect(box.cropped).toBe(true);
    expect(box.width).toBeCloseTo(180 / 0.7, 6);
    expect(box.height).toBe(240);
  });
  it("leaves a photo whole when no crop is allowed or it already fills its share", () => {
    expect(phoneBox(0.75, 316, 140, 0.6, 0)).toEqual({ ...fitWhole(0.75, 316, 140), cropped: false });
    expect(phoneBox(4 / 3, 316, 300, 0.6, 0.3)).toEqual({ width: 316, height: 237, cropped: false });
    const stage = pageStage([0], [0.75], 826, 240, 0.6, () => false, 0.3);
    expect(stage.boxes[0].cropped).toBe(true);
    expect(stage.frame.width).toBeCloseTo(180 / 0.7, 6);
  });
  it("caps the stage, leaves the words their room and keeps a floor", () => {
    expect(stageHeight(337.6, 500, 120)).toBe(337.6);
    expect(stageHeight(337.6, 200, 120)).toBe(200);
    expect(stageHeight(337.6, 40, 120)).toBe(120);
  });
});
