import { test, expect } from "./support/fixtures";
import { cardRegion, pixelDiff, shoot } from "./support/pixels";

// The pixel helpers the flight checks rest on, against shapes of known color:
// the decoder reads Chromium's PNGs exactly, and the diff sees a 1px slide of
// an edge as about 1px and an unchanged frame as nothing.

const square = (left: number) =>
  `<body style="margin:0;background:rgb(20,40,60)"><div style="position:absolute;left:${left}px;top:20px;width:60px;height:60px;background:rgb(230,120,10)"></div></body>`;
const outline = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];
const box = { x: 0, y: 0, width: 100, height: 100 };

test("pixels: the PNG decoder reads a screenshot's colors exactly", async ({ page }) => {
  await page.setContent(square(20));
  const image = await shoot(page, box);
  const at = (x: number, y: number) => Array.from(image.rgba.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
  expect([image.width, image.height]).toEqual([100, 100]);
  expect(at(5, 5)).toEqual([20, 40, 60, 255]);
  expect(at(50, 50)).toEqual([230, 120, 10, 255]);
});

test("pixels: an unchanged frame measures zero and a 1px slide measures about 1px", async ({ page }) => {
  await page.setContent(square(20));
  const still = await shoot(page, box);
  const again = await shoot(page, box);
  await page.setContent(square(21));
  const slid = await shoot(page, box);
  await page.setContent(`<body style="margin:0;background:rgb(20,40,60)"></body>`);
  const without = await shoot(page, box);
  const region = cardRegion(outline, { width: 100, height: 100 }, 0);

  const same = pixelDiff(still, again, without, region);
  expect(same.insideMean).toBe(0);
  expect(same.edgeMovePx).toBe(0);

  const moved = pixelDiff(still, slid, without, region);
  expect(moved.edgeMovePx).toBeGreaterThan(0.9);
  expect(moved.edgeMovePx).toBeLessThanOrEqual(1);
});
