import { describe, expect, it } from "vitest";
import { boxFor, fitWhole, groupFrame, pageStage, phoneBox, rowBox, rowColumns, stageHeight, uniformBoxes } from "@/lib/gallery/boxes";

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
  it("keeps a photo in its orientation's box unless the box would cut more than the allowed share of it", () => {
    expect(rowBox(4 / 3, boxes, 1, 0.15)).toBe(boxes.horizontal);
    expect(rowBox(0.75, boxes, 1, 0.15)).toBe(boxes.vertical);
    // 1.1495 in the 4:3 box loses 13.8 percent of its height: it keeps the box.
    expect(rowBox(1.1495, boxes, 1, 0.15)).toBe(boxes.horizontal);
  });
  it("draws a photo whole at its box's width when the box would cut it more than that", () => {
    // The 1.87:1 award photo in the 4:3 box lost 29 percent of its width, a near-square screenshot 23 percent of its height.
    const wide = rowBox(1.8679, boxes, 1, 0.15);
    expect(wide.width).toBe(424);
    expect(wide.height).toBeCloseTo(424 / 1.8679, 6);
    const square = rowBox(532 / 517, boxes, 1, 0.15);
    expect(square.width).toBe(424);
    expect(square.height).toBeCloseTo(424 * 517 / 532, 6);
    // A tall photo narrower than 3:4 stays 320 wide and takes the height it needs.
    const tall = rowBox(998 / 1600, boxes, 1, 0.15);
    expect(tall.width).toBe(320);
    expect(tall.height).toBeCloseTo(320 * 1600 / 998, 6);
  });
  it("never lets a row's photo be cropped by more than the allowed share", () => {
    for (const aspect of [0.5, 0.62, 0.7, 0.75, 0.8, 0.95, 1, 1.03, 1.15, 1.33, 1.5, 1.87, 2.4]) {
      const box = rowBox(aspect, boxes, 1, 0.15);
      const boxAspect = box.width / box.height;
      expect(1 - Math.min(aspect / boxAspect, boxAspect / aspect), `aspect ${aspect}`).toBeLessThanOrEqual(0.15 + 1e-9);
    }
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
