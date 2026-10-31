import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot } from "./support/coil";
import { settled } from "./support/fallback";
import { tabTo } from "./support/inline";

// The MVP's short name, "MVP", fades to "Minimum Viable Portfolio" in place on
// the Menu's MVP line and in page 1's line under Deal me in, on a fine pointer
// that can hover (a hover or keyboard focus) (components/quick/MvpUnfurl,
// globals.css "The MVP unfurl"). No letter travels within its sentence: the
// short word fades out where it stands, the full name fades in over it from the
// same left edge, and the capital the two share keeps its place and its ink the
// whole way. On page 1 the whole sentence glides left by half the width the full
// name adds, so it ends centred under the button, and a pointer resting on it
// stays on it. It plays once per hover and goes back on leave or blur, switches
// at once under reduced motion, and moves nothing around it (layout shift 0). The
// Menu's line is its own, so there the full name covers nothing and nothing
// glides. A touch screen never unfurls (e2e/touch.spec.ts).

const { teaser } = siteContent.intro;
const M = siteContent.menu;
const WORDS = quickCopy.title;

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (target: Locator): Promise<Box> =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
const line = (page: Page) => page.locator("[data-intro-cta] a[data-mvp-link]");
const menuLink = (page: Page) => page.locator("[data-menu-mvp]");
const full = (link: Locator) => link.locator(".mvp-full");
const opacityOf = (target: Locator) => target.evaluate((el) => Number(getComputedStyle(el).opacity));

// One frame of a link's drawing: each layer's opacity, the left edge of the capital in the short word and in the full name, the left
// edge of the sentence's first letter, and whether the link is hovered.
type Row = { t: number; short: number; cap: number; full: number; shortCapX: number; fullCapX: number; startX: number; hovered: boolean };
type Rest = { capX: number; startX: number };

// Samples the link's drawing on every frame for `ms` from now (collect with recorded()).
async function record(link: Locator, ms: number) {
  await link.evaluate((el, ms) => {
    const capLeft = (root: Element) => {
      const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 1);
      return range.getBoundingClientRect().left;
    };
    const opacity = (selector: string) => Number(getComputedStyle(el.querySelector(selector)!).opacity);
    const sample = (t: number): Row => ({
      t,
      short: opacity(".mvp-short-rest"),
      cap: opacity(".mvp-short-cap"),
      full: opacity(".mvp-full"),
      shortCapX: capLeft(el.querySelector(".mvp-short-cap")!),
      fullCapX: capLeft(el.querySelector(".mvp-full")!),
      startX: capLeft(el),
      hovered: el.matches(":hover"),
    });
    const rows: Row[] = [];
    const t0 = performance.now();
    (window as unknown as { __rows: Promise<Row[]> }).__rows = new Promise((resolve) => {
      const tick = () => {
        const t = performance.now() - t0;
        rows.push(sample(t));
        if (t < ms) requestAnimationFrame(tick);
        else resolve(rows);
      };
      requestAnimationFrame(tick);
    });
  }, ms);
}
const recorded = (page: Page) => page.evaluate(() => (window as unknown as { __rows: Promise<Row[]> }).__rows);

// The link's resting drawing: the shared capital's left edge and the sentence's.
const restOf = (link: Locator): Promise<Rest> =>
  link.evaluate((el) => {
    const capLeft = (root: Element) => {
      const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 1);
      return range.getBoundingClientRect().left;
    };
    return { capX: capLeft(el.querySelector(".mvp-short-cap")!), startX: capLeft(el) };
  });

// What a recording must show, whichever way the fade runs: within its sentence the capital never moves (in either layer, and the
// two layers' capitals coincide), its ink never dims, since the short word's capital is drawn until the full name's is in, and both
// layers really fade (a frame partway) rather than switch.
function expectNoTravelAndAFade(rows: Row[], rest: Rest, label: string) {
  expect(rows.length, `${label}: frames sampled`).toBeGreaterThan(10);
  for (const row of rows) {
    const at = `at ${Math.round(row.t)}ms`;
    expect(Math.abs(row.fullCapX - row.shortCapX), `${label}: the two capitals coincide ${at}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(row.shortCapX - row.startX - (rest.capX - rest.startX)), `${label}: the capital's place in the sentence ${at}`).toBeLessThanOrEqual(0.5);
    expect(1 - (1 - row.cap) * (1 - row.full), `${label}: the capital's ink ${at}`).toBeGreaterThanOrEqual(0.99);
  }
  const partway = (value: number) => value > 0.05 && value < 0.95;
  expect(rows.some((row) => partway(row.full)), `${label}: the full name fades rather than switches`).toBe(true);
  expect(rows.some((row) => partway(row.short)), `${label}: the short word fades rather than switches`).toBe(true);
}

// Layout shifts and every transition that runs inside an MVP link from here on, kept on window. Only opacity, colour and the link
// fill may run, and on page 1 the sentence's glide: a width, a transform or a position anywhere else would be a letter travelling.
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __shift: number; __outside: string[]; __props: string[]; __fades: number };
    w.__shift = 0;
    w.__outside = [];
    w.__props = [];
    w.__fades = 0;
    new PerformanceObserver((list) => {
      type Source = { node: Node | null };
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: Source[] }[]) {
        if (entry.hadRecentInput) continue;
        w.__shift += entry.value;
        for (const { node } of entry.sources) {
          const el = node instanceof Element ? node : (node?.parentElement ?? null);
          w.__outside.push(`${el?.tagName ?? "?"}.${el?.className ?? ""}`);
        }
      }
    }).observe({ type: "layout-shift" });
    document.addEventListener("transitionrun", (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-mvp-link]")) return;
      // Page 1's sentence gliding (a translate on .mvp-glide) is the one move allowed, and only there.
      const name = event.propertyName === "translate" && target.classList.contains("mvp-glide") ? "glide" : event.propertyName;
      if (!w.__props.includes(name)) w.__props.push(name);
      if (target.classList.contains("mvp-full") && event.propertyName === "opacity") w.__fades += 1;
    });
  });
}
const shifts = (page: Page) => page.evaluate(() => (window as unknown as { __shift: number }).__shift);
const shifted = (page: Page) => page.evaluate(() => (window as unknown as { __outside: string[] }).__outside);
const props = (page: Page) => page.evaluate(() => (window as unknown as { __props: string[] }).__props);
const fades = (page: Page) => page.evaluate(() => (window as unknown as { __fades: number }).__fades);
const ONLY_FADES = ["opacity", "color", "--inline-p"];
const FADES_AND_GLIDE = [...ONLY_FADES, "glide"];

async function arrived(page: Page) {
  await page.waitForFunction(() => !document.documentElement.dataset.introWords);
}

async function openLine(page: Page) {
  await openHome(page, { at: "foot" });
  await arrived(page);
  await page.mouse.move(2, 2);
  await expect(line(page)).toBeVisible();
}

// The Menu's foot: the settings (theme, freeze the wave), then the MVP on a line of its own, then the contact row.
async function openMenu(page: Page, path = "/") {
  if (path === "/") await openHome(page, { at: "top" });
  else await page.goto(path);
  await page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const dialog = page.getByRole("dialog", { name: M.dialogLabel });
  await expect(dialog.locator("[data-menu-mvp-line]")).toBeVisible();
  // The foot has risen in (its own 0.5s after a 0.42s wait).
  await page.waitForTimeout(1200);
  await page.mouse.move(2, 2);
  return dialog;
}

// Hovers the link while every frame is sampled, then leaves it the same way; returns both recordings and the capital's resting x.
async function hoverAndLeave(page: Page, link: Locator) {
  const rest = await restOf(link);
  await record(link, 1200);
  await link.hover();
  const over = await recorded(page);
  await record(link, 900);
  await page.mouse.move(2, 2);
  const away = await recorded(page);
  return { rest, over, away };
}

// Page 1's glide: how far the sentence moves (--mvp-shift, half the width the full name adds), and the visible sentence's centre
// against the button's (the full name's end once it is in, the short word's before).
const shiftOf = (link: Locator) => link.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--mvp-shift")));
async function centres(page: Page) {
  return line(page).evaluate((el) => {
    const range = document.createRange();
    const text = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const open = Number(getComputedStyle(el.querySelector(".mvp-full")!).opacity) === 1;
    const end = el.querySelector(open ? ".mvp-full" : ".mvp-short")!.getBoundingClientRect().right;
    const button = document.querySelector("[data-deal-button]")!.getBoundingClientRect();
    return { sentence: (range.getBoundingClientRect().left + end) / 2, button: button.left + button.width / 2, start: range.getBoundingClientRect().left };
  });
}

test("mvp unfurl: page 1's line reads In a rush? The MVP, is named for the whole MVP, and goes to the MVP page", async ({ page }) => {
  await openLine(page);
  await expect(page.getByRole("link", { name: teaser.quickName, exact: true })).toHaveCount(1);
  await expect(line(page)).toHaveAttribute("href", "/quick");
  // What is drawn at rest: the line and its short word; the full name is there, faded out, and hidden from assistive tech.
  await expect(line(page).locator(".mvp-short")).toHaveText(quickCopy.titleShort);
  expect(await line(page).evaluate((el, lead) => (el.textContent ?? "").startsWith(lead), teaser.quick.slice(0, -quickCopy.titleShort.length))).toBe(true);
  await expect(full(line(page))).toHaveText(WORDS);
  expect(await opacityOf(full(line(page)))).toBe(0);
  expect(await full(line(page)).getAttribute("aria-hidden")).toBe("true");
});

test("mvp unfurl: hovering page 1's line fades MVP to Minimum Viable Portfolio in place, once, and leaving fades it back; no letter travels", async ({ page }) => {
  await openLine(page);
  await watch(page);
  const shift = await shiftOf(line(page));
  expect(shift, "the sentence glides left").toBeLessThan(-30);
  const { rest, over, away } = await hoverAndLeave(page, line(page));

  expectNoTravelAndAFade(over, rest, "hover");
  const open = over.at(-1)!;
  expect([open.full, open.short, open.cap], "open: the full name in, the short word out").toEqual([1, 0, 0]);
  // The full name starts a beat after the short word: on the first frame the short word has begun to go, the full name has barely come.
  const first = over.find((row) => row.short < 0.99)!;
  expect(first.full, "the full name lags the short word").toBeLessThan(0.2);
  // The glide: the sentence only ever moves left, and ends half the added width from where it stood.
  over.slice(1).forEach((row, i) => expect(row.startX, `the glide at ${Math.round(row.t)}ms`).toBeLessThanOrEqual(over[i].startX + 0.01));
  expect(open.startX - rest.startX).toBeCloseTo(shift, 1);

  expectNoTravelAndAFade(away, rest, "leave");
  const back = away.at(-1)!;
  expect([back.full, back.short, back.cap], "rest: the short word back, the full name gone").toEqual([0, 1, 1]);
  expect(away[0].cap, "the capital is back at once, under the full name").toBe(1);
  away.slice(1).forEach((row, i) => expect(row.startX, `the way back at ${Math.round(row.t)}ms`).toBeGreaterThanOrEqual(away[i].startX - 0.01));
  expect(back.startX).toBeCloseTo(rest.startX, 1);

  // Once per hover: one fade in, one fade back, and holding the pointer there plays nothing more.
  expect(await fades(page)).toBe(2);
  await line(page).hover();
  await expect.poll(() => opacityOf(full(line(page)))).toBe(1);
  await page.waitForTimeout(700);
  expect(await fades(page), "the next hover plays once").toBe(3);
  expect(await props(page)).toContain("glide");
  expect((await props(page)).filter((name) => !FADES_AND_GLIDE.includes(name)), "anything but a fade or the glide that ran").toEqual([]);
});

test("mvp unfurl: once open, the full name holds the pointer, so reading along it to Portfolio does not fade it back", async ({ page }) => {
  await openLine(page);
  const lineBox = await boxOf(line(page));
  await line(page).hover();
  await expect.poll(() => opacityOf(full(line(page)))).toBe(1);
  const words = await boxOf(full(line(page)));
  // Past the line's own box, over the end of "Portfolio".
  const end = { x: words.x + words.width - 8, y: words.y + words.height / 2 };
  expect(end.x).toBeGreaterThan(lineBox.x + lineBox.width + 20);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.waitForTimeout(500);
  expect(await opacityOf(full(line(page))), "still open over Portfolio").toBe(1);
  await page.mouse.move(end.x + 60, end.y + 60, { steps: 4 });
  await expect.poll(() => opacityOf(full(line(page))), { message: "off the words it fades back" }).toBe(0);
  // At rest the full name takes no pointer: the same spot does not open it.
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.waitForTimeout(500);
  expect(await opacityOf(full(line(page))), "the faded name is not a target").toBe(0);
});

test("mvp unfurl: keyboard focus on page 1's line fades it in, and a blur fades it back", async ({ page }) => {
  await openLine(page);
  await tabTo(page, line(page));
  await expect.poll(() => opacityOf(full(line(page)))).toBe(1);
  expect(await opacityOf(line(page).locator(".mvp-short-rest"))).toBe(0);
  await page.keyboard.press("Tab");
  await expect.poll(() => opacityOf(full(line(page)))).toBe(0);
  expect(await opacityOf(line(page).locator(".mvp-short-rest"))).toBe(1);
});

test("mvp unfurl: page 1's line box, the button and the page hold still while the sentence fades and glides (layout shift 0)", async ({ page }) => {
  await openLine(page);
  const deal = page.locator("[data-deal-button]");
  const centreX = (b: Box) => b.x + b.width / 2;
  const [line0, deal0] = [await boxOf(line(page)), await boxOf(deal)];
  expect(Math.abs(centreX(line0) - centreX(deal0)), "the line is centred under Deal me in at rest").toBeLessThanOrEqual(1);
  const page0 = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }));
  await watch(page);
  await line(page).hover();
  await expect.poll(() => opacityOf(full(line(page)))).toBe(1);
  expect(await boxOf(line(page)), "the line's own box").toEqual(line0);
  expect(await boxOf(deal), "Deal me in").toEqual(deal0);
  // The words reach past the line's box on the right, from the short word's left edge, the sentence's start past it on the left,
  // and all of it stays on the screen.
  const [open, short, viewport] = [await boxOf(full(line(page))), await boxOf(line(page).locator(".mvp-short")), page.viewportSize()!];
  const { start } = await centres(page);
  expect(open.x).toBeCloseTo(short.x, 1);
  expect(open.x + open.width).toBeGreaterThan(line0.x + line0.width);
  expect(open.x + open.width).toBeLessThan(viewport.width);
  expect(start).toBeLessThan(line0.x);
  expect(start).toBeGreaterThan(0);
  expect(await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }))).toEqual(page0);
  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(full(line(page)))).toBe(0);
  expect(await boxOf(line(page))).toEqual(line0);
  expect(await shifted(page), "anything that shifted").toEqual([]);
  expect(await shifts(page), "layout shift while it faded in and back").toBe(0);
});

test("mvp unfurl: the full name takes the link fill from the centre, in the accent", async ({ page }) => {
  await openLine(page);
  const ink = line(page).locator(".mvp-full-fill");
  const inkOf = () => ink.evaluate((el) => ({ p: Number(getComputedStyle(el).getPropertyValue("--inline-p")), clip: getComputedStyle(el).backgroundClip }));
  expect((await inkOf()).p).toBe(0);
  await line(page).hover();
  await expect.poll(async () => (await inkOf()).p, { message: "the fill comes in" }).toBe(1);
  expect((await inkOf()).clip).toMatch(/text/);
});

test("mvp unfurl: page 1's whole sentence is centred under the button, at rest and with the full name in", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await openLine(page);
    const label = `${width}x${height}`;
    const atRest = await centres(page);
    expect(Math.abs(atRest.sentence - atRest.button), `${label}: at rest`).toBeLessThanOrEqual(1);
    await line(page).hover();
    await expect.poll(() => opacityOf(full(line(page)))).toBe(1);
    // The glide has landed: the sentence's start holds still between two reads a frame apart.
    await expect.poll(async () => { const a = (await centres(page)).start; await page.waitForTimeout(50); return Math.abs((await centres(page)).start - a); }).toBeLessThan(0.01);
    const open = await centres(page);
    expect(Math.abs(open.sentence - open.button), `${label}: with the full name in`).toBeLessThanOrEqual(1);
    expect(open.start, `${label}: the sentence moved left to get there`).toBeLessThan(atRest.start - 30);
    await page.mouse.move(2, 2);
    await expect.poll(() => opacityOf(full(line(page)))).toBe(0);
    await expect.poll(async () => Math.abs((await centres(page)).start - atRest.start)).toBeLessThan(0.01);
  }
});

// The sentence glides under a resting pointer, so the hover must not flicker: the link's own box stays put and the full name takes
// the pointer once it is in, so a pointer parked anywhere on the line stays on it. Parked by a single jump (no path across the line)
// on the line's right end and on MVP, each frame after it lands is hovered, the full name only ever rises, to 1, and one fade runs.
test("mvp unfurl: a pointer parked on page 1's line, on its right end or on MVP, holds the state steady while the sentence glides under it", async ({ page }) => {
  await openLine(page);
  await watch(page);
  const link = line(page);
  const [box, short] = [await boxOf(link), await boxOf(link.locator(".mvp-short"))];
  const spots = [
    { name: "the line's right end", x: box.x + box.width - 2, y: box.y + box.height / 2 },
    { name: "MVP", x: short.x + short.width / 2, y: short.y + short.height / 2 },
  ];
  for (const spot of spots) {
    await page.mouse.move(2, 2);
    await expect.poll(() => opacityOf(full(link))).toBe(0);
    await page.waitForTimeout(300);
    const before = await fades(page);
    await record(link, 1300);
    await page.mouse.move(spot.x, spot.y);
    const rows = await recorded(page);
    const from = rows.findIndex((row) => row.hovered);
    expect(from, `${spot.name}: hovered`).toBeGreaterThanOrEqual(0);
    const held = rows.slice(from);
    expect(held.filter((row) => !row.hovered).map((row) => Math.round(row.t)), `${spot.name}: frames it let go`).toEqual([]);
    held.slice(1).forEach((row, i) => expect(row.full, `${spot.name}: the full name at ${Math.round(row.t)}ms`).toBeGreaterThanOrEqual(held[i].full - 0.001));
    expect(held.at(-1)!.full, `${spot.name}: open`).toBe(1);
    expect(held.at(-1)!.startX, `${spot.name}: the sentence moved under the pointer`).toBeLessThan(held[0].startX - 30);
    expect((await fades(page)) - before, `${spot.name}: one fade, no bounce`).toBe(1);
  }
  // Once open, the sentence's two new ends hold the pointer too: parked at its far right, then its far left, it stays open.
  const open = await boxOf(full(link));
  const { start } = await centres(page);
  for (const [name, x] of [["the open sentence's right end", open.x + open.width - 2], ["the open sentence's left end", start + 2]] as const) {
    const before = await fades(page);
    await page.mouse.move(x, box.y + box.height / 2, { steps: 8 });
    await page.waitForTimeout(600);
    expect(await opacityOf(full(link)), name).toBe(1);
    expect(await link.evaluate((el) => el.matches(":hover")), name).toBe(true);
    expect((await fades(page)) - before, `${name}: nothing replayed`).toBe(0);
  }
});

test("mvp unfurl: the Menu's MVP is a link on a line of its own between the settings and the contact row, named for the whole MVP", async ({ page }) => {
  const dialog = await openMenu(page);
  const link = dialog.getByRole("link", { name: quickCopy.menuLinkName, exact: true });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "/quick");
  // The chip row keeps the settings only.
  const chips = dialog.locator("[data-menu-freeze]").locator("xpath=..");
  await expect(chips.locator("[data-menu-mvp]")).toHaveCount(0);
  await expect(chips.locator(":scope > *")).toHaveCount(2);
  const email = dialog.getByRole("link", { name: M.email.label, exact: true });
  const [chipBox, lineBox, emailBox] = [await boxOf(chips), await boxOf(dialog.locator("[data-menu-mvp-line]")), await boxOf(email)];
  expect(lineBox.y, "under the chips").toBeGreaterThanOrEqual(chipBox.y + chipBox.height);
  expect(lineBox.y + lineBox.height, "over the contact row").toBeLessThanOrEqual(emailBox.y);
  // Set like the email link: the label face, in the accent.
  const look = (target: Locator) => target.evaluate((el) => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.fontWeight, s.color]; });
  expect(await look(link)).toEqual(await look(email));
  // On a fine pointer the note is not drawn: the link fades to the full name instead.
  await expect(dialog.locator("[data-menu-mvp-note]")).toBeHidden();
});

test("mvp unfurl: the Menu's MVP line fades in place on hover, over the empty line to its right, and nothing in the foot moves", async ({ page }) => {
  const dialog = await openMenu(page);
  const link = menuLink(page);
  const others = [
    dialog.getByRole("button", { name: M.themeAriaLabelToDark }),
    dialog.locator("[data-menu-freeze]"),
    dialog.locator("[data-menu-mvp-line]"),
    dialog.getByRole("link", { name: M.email.label, exact: true }),
    dialog.getByRole("link", { name: "LinkedIn" }),
  ];
  const before = { link: await boxOf(link), others: await Promise.all(others.map(boxOf)) };
  const panel = await boxOf(dialog.locator("#site-menu"));
  await watch(page);

  const rest = await restOf(link);
  await record(link, 1200);
  await link.hover();
  const over = await recorded(page);
  expectNoTravelAndAFade(over, rest, "hover");
  // Nothing glides here: the capital keeps its x on the page, not only in its sentence.
  for (const row of over) expect(Math.abs(row.shortCapX - rest.capX), `the capital at ${Math.round(row.t)}ms`).toBeLessThanOrEqual(0.5);
  expect(over.at(-1)!.full, "the full name's opacity").toBe(1);
  expect(await boxOf(link), "the link's own box").toEqual(before.link);
  expect(await Promise.all(others.map(boxOf)), "the chips, the line and the contact row").toEqual(before.others);
  const words = await boxOf(full(link));
  expect(words.x, "from the link's left edge").toBeCloseTo(before.link.x, 0);
  expect(words.x + words.width, "inside the panel").toBeLessThan(panel.x + panel.width);
  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(full(link))).toBe(0);
  expect(await shifts(page), "layout shift").toBe(0);
  expect((await props(page)).filter((name) => !ONLY_FADES.includes(name)), "anything but a fade that ran").toEqual([]);
});

test("mvp unfurl: keyboard focus on the Menu's MVP fades it in, and a blur fades it back", async ({ page }) => {
  await openMenu(page);
  const link = menuLink(page);
  await tabTo(page, link);
  await expect.poll(() => opacityOf(full(link))).toBe(1);
  await page.keyboard.press("Tab");
  await expect.poll(() => opacityOf(full(link))).toBe(0);
});

test("mvp unfurl: on the MVP page the way home holds the same line, so the Menu keeps one shape", async ({ page }) => {
  const parts = async (dialog: Locator) => ({
    chips: await boxOf(dialog.locator("[data-menu-freeze]").locator("xpath=..")),
    line: await boxOf(dialog.locator("[data-menu-mvp-line]")),
    email: await boxOf(dialog.getByRole("link", { name: M.email.label, exact: true })),
  });
  const home = await parts(await openMenu(page));
  const dialog = await openMenu(page, "/quick");
  await expect(dialog.locator("[data-menu-mvp]")).toHaveCount(0);
  const back = dialog.locator("[data-menu-mvp-line]").getByRole("link", { name: quickCopy.back, exact: true });
  await expect(back).toHaveAttribute("href", "/");
  expect(await parts(dialog)).toEqual(home);
});

test("mvp unfurl: the Menu does not start scrolling at the desktop sizes it fits today", async ({ page }) => {
  for (const [width, height] of [[1280, 800], [1440, 900], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    const dialog = await openMenu(page);
    const scroll = await dialog.locator("#site-menu").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(scroll.scroll, `${width}x${height}`).toBeLessThanOrEqual(scroll.client);
  }
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("mvp unfurl: under reduced motion the words switch at once, on page 1's line and the Menu's MVP line", async ({ page }) => {
    const twoFrames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const drawn = (link: Locator) =>
      link.evaluate((el) => [".mvp-full", ".mvp-short-rest", ".mvp-short-cap"].map((selector) => Number(getComputedStyle(el.querySelector(selector)!).opacity)));
    await page.goto("/");
    await settled(page);
    await scrollToFoot(page);
    await page.mouse.move(2, 2);
    await expect(line(page)).toBeVisible();
    await watch(page);
    await expect(full(line(page))).toHaveCSS("transition-duration", "0s");
    await expect(line(page).locator(".mvp-glide")).toHaveCSS("transition-duration", "0s");
    const rest = await restOf(line(page));
    const shift = await shiftOf(line(page));
    expect(shift).toBeLessThan(-30);
    await line(page).hover();
    // On the frame after the hover, not after a fade: the full name is in, the short word is gone, and the sentence has moved.
    await twoFrames();
    expect(await drawn(line(page))).toEqual([1, 0, 0]);
    expect((await restOf(line(page))).startX - rest.startX, "the glide, at once").toBeCloseTo(shift, 1);
    await page.mouse.move(2, 2);
    await twoFrames();
    expect(await drawn(line(page))).toEqual([0, 1, 1]);
    expect((await restOf(line(page))).startX).toBeCloseTo(rest.startX, 1);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.getByRole("button", { name: M.ariaLabelOpen }).click();
    await expect(menuLink(page)).toBeVisible();
    await page.waitForTimeout(800);
    await menuLink(page).hover();
    await twoFrames();
    expect(await drawn(menuLink(page)), "the Menu's line, on the frame after the hover").toEqual([1, 0, 0]);
    expect(await fades(page), "no fade ran").toBe(0);
    expect(await shifted(page)).toEqual([]);
  });
});
