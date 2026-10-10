import { describe, expect, it } from "vitest";
import { boxFor, fitWhole, groupFrame, pageStage, rowColumns, stageHeight, uniformBoxes } from "@/lib/gallery/boxes";

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
  it("caps the stage, leaves the words their room and keeps a floor", () => {
    expect(stageHeight(337.6, 500, 120)).toBe(337.6);
    expect(stageHeight(337.6, 200, 120)).toBe(200);
    expect(stageHeight(337.6, 40, 120)).toBe(120);
  });
});
