import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { shoot } from "./support/pixels";

const order = siteContent.strand.order as readonly string[];
const PHOTO_CARDS = ["mentorship", "band", "travel", "hackathons", "misuki", "building-in-public"];

test("coil faces: the strand draws the fourteen cards in Aaron's order, the photo cards as photos", async ({ page }) => {
  await openHome(page, { debug: "flight" });
  const slots = await page.evaluate(() => (window as HookWindow).__coilFlight!.scene.slots());
  for (const slot of slots) {
    expect(order, slot.key).toContain(slot.key);
    expect(slot.kind, slot.key).toBe(PHOTO_CARDS.includes(slot.key) ? "photo" : "work");
  }
  const byU = [...slots].sort((a, b) => a.u - b.u);
  let neighbours = 0;
  for (let i = 1; i < byU.length; i++) {
    if (Math.round(byU[i].u - byU[i - 1].u) !== 1) continue;
    expect(order.indexOf(byU[i].key), `${byU[i - 1].key} then ${byU[i].key}`).toBe((order.indexOf(byU[i - 1].key) + 1) % order.length);
    neighbours += 1;
  }
  expect(neighbours).toBeGreaterThan(4);
});

// A card's lightness at one point of its face grid (s across, t down, in
// eighths), with the card held at the front by its row. The default point is
// an eighth of the way in from the top left corner, clear of its rim and its
// logo; size is the sample's side in px, centred on the point.
async function paneLightness(page: import("@playwright/test").Page, key: string, { s = 0.125, t = 0.125, size = 3 } = {}) {
  await page.evaluate((k) => (window as HookWindow).__coil!.api.focusCard(k), key);
  await page.waitForTimeout(900);
  const slot = await page.evaluate((k) => {
    const slots = (window as HookWindow).__coilFlight!.scene.slots().filter((s) => s.key === k && s.alpha > 0.9);
    return slots.sort((a, b) => b.depth - a.depth)[0] ?? null;
  }, key);
  expect(slot, `${key} on screen`).not.toBeNull();
  const point = slot!.grid.find((p) => p.s === s && p.t === t)!;
  const half = Math.floor(size / 2);
  const image = await shoot(page, { x: Math.round(point.x) - half, y: Math.round(point.y) - half, width: size, height: size });
  let sum = 0;
  for (let i = 0; i < image.rgba.length; i += 4) sum += 0.2126 * image.rgba[i] + 0.7152 * image.rgba[i + 1] + 0.0722 * image.rgba[i + 2];
  return sum / (image.rgba.length / 4) / 255;
}

test("coil faces: Talos sits on its dark anvil in the light theme, Capital One on the light pane", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openHome(page, { debug: "flight" });
  expect(await paneLightness(page, "talos")).toBeLessThan(0.4);
  expect(await paneLightness(page, "capital-one")).toBeGreaterThan(0.6);
});

// Capital One has a white file for the dark theme, so it stays on the dark pane with no plate: the
// point an eighth in at mid height, left of the logo's ink, is dark.
test("coil faces: in the dark theme Capital One's white logo sits on the dark pane and Talos stays on its anvil", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page, { debug: "flight" });
  expect(await paneLightness(page, "capital-one")).toBeLessThan(0.4);
  expect(await paneLightness(page, "capital-one", { s: 0.125, t: 0.5, size: 1 })).toBeLessThan(0.4);
  expect(await paneLightness(page, "talos")).toBeLessThan(0.4);
});

// The default point (an eighth in from the top left) is in the frame above IEEE's square, which takes
// the logo's own navy as its face, so the frame is as dark as the square in both themes.
for (const theme of ["light", "dark"] as const) {
  test(`coil faces: IEEE's face is navy edge to edge in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await openHome(page, { debug: "flight" });
    expect(await paneLightness(page, "ieee")).toBeLessThan(0.15);
  });
}
