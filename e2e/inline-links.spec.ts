import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { openHome } from "./support/coil";
import { test, expect } from "./support/fixtures";
import { barScale, bubble, CALENDAR, DEF, fillOf, MATCHA, MATCHA_HREF, openFixture, POP, productLink, rest, tipLink, tabTo, TIP } from "./support/inline";
// The copy's inline links (components/inline) by mouse and keyboard, each on a
// lines-split Block; touch is e2e/inline-links-touch.spec.ts (the touch project).
const { register } = siteContent;
const shift = (page: Page) => bubble(page).evaluate((el) => (({ m41: x, m42: y }) => ({ x, y }))(new DOMMatrixReadOnly(getComputedStyle(el).transform)));
test("inline links: a tip follows a mouse with no render per move, leaves with it, and Escape hides it", async ({ page }) => {
  await openFixture(page, TIP);
  const box = (await tipLink(page).boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await expect(bubble(page)).toHaveAttribute("data-mode", "hover");
  await expect(bubble(page)).toHaveText(tipText("killer-drones")!);
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("transform"); // the trail
  const before = await shift(page);
  await page.evaluate(() => {
    const w = Object.assign(window, { __tipMutations: 0 });
    new MutationObserver((records) => void (w.__tipMutations += records.length)).observe(document.querySelector("[data-inline-tip]")!, { childList: true, subtree: true, characterData: true });
  });
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 6 });
  // The label trails the pointer (an 80ms transform transition), so poll until it settles.
  await expect.poll(async () => Math.abs((await shift(page)).x - before.x - (box.width - 8))).toBeLessThanOrEqual(1);
  expect((await shift(page)).y).toBe(before.y);
  expect(await page.evaluate(() => (window as Window & { __tipMutations?: number }).__tipMutations)).toBe(0); // style writes are not child mutations
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 160);
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await tipLink(page).hover();
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: keyboard focus anchors a tip under its link; Escape, Enter and Tab drive it", async ({ page }) => {
  await openFixture(page, TIP);
  await expect(tipLink(page)).toHaveAccessibleDescription(tipText("killer-drones")!);
  await tabTo(page, tipLink(page));
  await expect(bubble(page)).toHaveAttribute("data-mode", "focus");
  await page.waitForTimeout(250);
  const link = (await tipLink(page).boundingBox())!;
  const tip = (await bubble(page).boundingBox())!;
  expect(tip.y).toBeGreaterThanOrEqual(link.y + link.height);
  expect(Math.abs(tip.x + tip.width / 2 - (link.x + link.width / 2))).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await expect(tipLink(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Tab");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: a photo pop holds its photo, or its caption until the photo lands", async ({ page }) => {
  await openFixture(page, POP);
  const entry = register.pop["contrabass-clarinet"];
  const link = page.locator('[data-inline="pop"][data-inline-key="contrabass-clarinet"]');
  await expect(link).toHaveAccessibleDescription([entry.alt, entry.caption].filter(Boolean).join(". "));
  await link.hover();
  await expect(bubble(page)).toContainText(entry.caption!);
  if (entry.file) await expect(bubble(page).locator("img")).toHaveAttribute("alt", entry.alt);
  else await expect(bubble(page).locator("img")).toHaveCount(0);
});
test("inline links: the matcha shows its pop on hover and opens the Maps pin in a new tab on click", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  const link = page.getByRole("link", { name: "or matcha" });
  await expect(link).toHaveAttribute("href", MATCHA_HREF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.hover();
  await expect(bubble(page)).toContainText(register.pop.matcha.caption!);
  await expect(bubble(page).getByText(register.pop.matcha.hrefLabel!)).toHaveCount(0);
  const popup = page.waitForEvent("popup");
  await link.click();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
});
test("inline links: every link is a named button or link, the footnote included; the label stays out of the tree", async ({ page }) => {
  await openFixture(page, MATCHA, CALENDAR, TIP, DEF);
  await expect(page.getByRole("button", { name: siteContent.inline.symbolLabel })).toHaveAccessibleDescription(tipText("killer-drones")!);
  await expect(page.getByRole("link", { name: "grab a time on my calendar" })).toHaveAttribute("rel", "noopener noreferrer");
  const tags = await page.locator("main [data-inline]").evaluateAll((els) => els.map((el) => el.tagName));
  expect(tags).toHaveLength(5);
  expect(tags.every((tag) => tag === "A" || tag === "BUTTON")).toBe(true);
  await expect(bubble(page)).toHaveAttribute("aria-hidden", "true");
});
test("inline links: a link never wraps away from the text glued to it", async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 800 });
  await openFixture(page, DEF, MATCHA);
  const glued = await page.locator("main .inline-glue").evaluateAll((spans) => spans.map((span) => {
    const link = span.querySelector<HTMLElement>("[data-inline]")!.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    return { text: span.textContent, height: box.height, linkHeight: link.height, holdsLink: box.top <= link.top + 1 && box.bottom >= link.bottom - 1 };
  }));
  expect(glued.map((item) => item.text)).toEqual(["product-focused", "(or matcha).", "building*."]);
  for (const item of glued) {
    expect(item.height).toBeLessThan(item.linkHeight * 1.5);
    expect(item.holdsLink).toBe(true);
  }
});
test("inline links: a definition opens the house text modal by mouse; Escape closes it and focus returns", async ({ page }) => {
  const link = await productLink(page);
  await expect(link).toHaveAttribute("aria-haspopup", "dialog");
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toContainText(register.def.product.body);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: a definition opens from the keyboard, holds focus inside, and returns it", async ({ page }) => {
  const link = await productLink(page);
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  const close = dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: focus returns to the product link even when its line was rebuilt", async ({ page }) => {
  const link = await productLink(page);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const old = document.querySelector('[data-inline="def"][data-inline-key="product"]')!;
    old.replaceWith(old.cloneNode(true)); // what a SplitText revert does to the node
  });
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-inline="def"][data-inline-key="product"]').first()).toBeFocused();
});
test("inline links: focus comes home when the line is rebuilt after the definition closes", async ({ page }) => {
  const link = await productLink(page);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const old = document.querySelector('[data-inline="def"][data-inline-key="product"]')!;
    old.replaceWith(old.cloneNode(true)); // a font landing late re-splits the line like this
  });
  await expect(page.locator('[data-inline="def"][data-inline-key="product"]').first()).toBeFocused();
});

test("inline links (reduced motion): the label and the definition only fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, DEF, TIP);
  await tipLink(page).hover();
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).scale)).toBe("none");
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).transitionProperty)).not.toContain("transform"); // no trail
  await page.mouse.move(2, 700);
  await page.locator('[data-inline="def"]').click();
  const panel = page.locator("[data-definition-panel]");
  await panel.waitFor();
  // Read at once: the rise would still be moving the panel; the fade never writes a transform.
  expect(await panel.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

const LINE_CASES = [
  ["definition", DEF, '[data-inline="def"]'],
  ["tip", TIP, '[data-inline="tip"]'],
  ["pop", POP, '[data-inline="pop"]'],
  ["external link", CALENDAR, '[data-inline="external"]'],
] as const;

for (const colorScheme of ["light", "dark"] as const) {
  test(`inline links: every kind rests as its paragraph's ink with a quiet line and fills with the accent in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await openFixture(page, ...LINE_CASES.map(([, copy]) => copy));
    for (const [kind, , selector] of LINE_CASES) {
      const link = page.locator(selector).first();
      const read = await link.evaluate((el) => {
        const probe = (css: string) => {
          const node = (el.parentElement as HTMLElement).appendChild(Object.assign(document.createElement("span"), { style: css }));
          const style = getComputedStyle(node);
          const out = { color: style.color, background: style.backgroundColor };
          node.remove();
          return out;
        };
        const own = getComputedStyle(el);
        const before = getComputedStyle(el, "::before");
        const after = getComputedStyle(el, "::after");
        const paragraph = getComputedStyle(el.parentElement as HTMLElement);
        return {
          ink: own.color,
          paragraphInk: paragraph.color,
          line: before.backgroundColor,
          restingLine: probe("background: color-mix(in srgb, currentColor var(--inline-line-rest), transparent)").background,
          fill: after.backgroundColor,
          accent: probe("color: var(--color-accent)").color,
          decoration: own.textDecorationLine,
          barHeight: before.height,
          fillHeight: after.height,
          barBottom: before.bottom === after.bottom,
        };
      });
      expect(read.ink, `${kind}: the word is its paragraph's ink at rest`).toBe(read.paragraphInk);
      expect(read.line, `${kind}: a quiet line in that ink`).toBe(read.restingLine);
      expect(read.fill, `${kind}: filled from the accent token`).toBe(read.accent);
      expect(read.decoration, `${kind}: a bar, not text-decoration`).toBe("none");
      expect([read.barHeight === read.fillHeight, read.barBottom], `${kind}: the fill is the line's size and place`).toEqual([true, true]);
      await rest(page);
      expect(await fillOf(link), `${kind}: empty at rest`).toBe(0);
      expect(await barScale(link)).toBe(0);
    }
    await tipLink(page).hover();
    await expect(bubble(page)).toHaveAttribute("data-shown", "true");
    const ratio = await bubble(page).locator("span").first().evaluate((el) => {
      const lum = (c: string) => {
        const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [hi, lo] = [lum(getComputedStyle(el).color), lum(getComputedStyle(el).backgroundColor)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test("inline links: hover fills the word and its line together from the centre, on the same 350ms curve, and hover out empties them", async ({ page }) => {
  await openFixture(page, ...LINE_CASES.map(([, copy]) => copy));
  for (const [kind, , selector] of LINE_CASES) {
    const link = page.locator(selector).first();
    const timing = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.transitionProperty, style.transitionDuration, style.transitionTimingFunction, getComputedStyle(el, "::after").transformOrigin, style.backgroundPosition];
    });
    expect(timing, `${kind}: one tween for the word and the line`).toEqual(["--inline-p", "0.35s", "cubic-bezier(0.65, 0, 0.35, 1)", expect.stringMatching(/^[\d.]+px 0\.?\d*px$/), "50% 50%, 50% 50%"]);
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => fillOf(link), { message: `${kind}: fills` }).toBe(1);
    expect(await barScale(link)).toBe(1);
    await rest(page);
    await expect.poll(() => fillOf(link), { message: `${kind}: empties` }).toBe(0);
    expect(await barScale(link)).toBe(0);
  }
});

test("inline links: the word and its line pass through the same fraction at every moment of the tween", async ({ page }) => {
  await openFixture(page, TIP);
  const link = tipLink(page);
  const box = (await link.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const samples = await link.evaluate((el) => new Promise<number[][]>((resolve) => {
    const out: number[][] = [];
    const tick = () => {
      out.push([Number(getComputedStyle(el).getPropertyValue("--inline-p")), new DOMMatrixReadOnly(getComputedStyle(el, "::after").transform).a]);
      if (out.length < 40) requestAnimationFrame(tick);
      else resolve(out);
    };
    requestAnimationFrame(tick);
  }));
  expect(samples.some(([p]) => p > 0 && p < 1), "the tween shows in between").toBe(true);
  for (const [p, scale] of samples) expect(scale).toBeCloseTo(p, 5);
});

test("inline links: keyboard focus fills a link while its ring shows, and the ring still fits", async ({ page }) => {
  await openFixture(page, TIP);
  await tabTo(page, tipLink(page));
  await expect.poll(() => fillOf(tipLink(page))).toBe(1);
  expect(await tipLink(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("Tab");
  await expect.poll(() => fillOf(tipLink(page))).toBe(0);
});

test("inline links: a link stays filled while its tip is open, hovered or focused, and neither marks it clicked; Enter does", async ({ page }) => {
  await openFixture(page, TIP);
  const link = tipLink(page);
  await tabTo(page, link);
  await expect(link).toHaveAttribute("data-inline-open", "");
  await page.keyboard.press("Escape");
  await expect(link).not.toHaveAttribute("data-inline-open", "");
  await expect.poll(() => fillOf(link)).toBe(1); // still focused with a ring
  await page.keyboard.press("Tab");
  await expect.poll(() => fillOf(link)).toBe(0);
  await link.hover();
  await expect(link).toHaveAttribute("data-inline-open", "");
  await rest(page);
  await expect(link).not.toHaveAttribute("data-inline-open", "");
  await expect.poll(() => fillOf(link)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("aaron-inline-visited"))).toBeNull();
  await tabTo(page, tipLink(page));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(link).toHaveAttribute("data-inline-open", "");
  expect(await page.evaluate(() => localStorage.getItem("aaron-inline-visited"))).toBe(JSON.stringify(["tip:killer-drones"]));
  await page.keyboard.press("Tab");
  await rest(page);
  await expect.poll(() => fillOf(link)).toBe(1); // clicked: stays filled
});

test("inline links (reduced motion): the word and its line switch with no tween", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, TIP);
  const link = tipLink(page);
  // The global reduced-motion rule leaves 0.001ms, a switch.
  expect(await link.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.00001);
  const box = (await link.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => fillOf(link), { timeout: 1000 }).toBe(1); // within a frame, never a 350ms tween
  expect(await barScale(link)).toBe(1);
  await rest(page);
  await expect.poll(() => fillOf(link), { timeout: 1000 }).toBe(0);
  expect(await barScale(link)).toBe(0);
});

// Descenders everywhere: g, p, y, j and a comma.
const DESCENDERS = "Gypsy [jumpy pygmy](tip:killer-drones), [grab a quip](def:product) (and [pop quiz](pop:contrabass-clarinet)), [py gy](https://example.com/).";
test("inline links: the line sits below every descender with a clear gap, inside its box's text area and its line's mask", async ({ page }) => {
  await openFixture(page, DESCENDERS, "No [marker](tip:killer-drones) here.");
  const report = await page.evaluate(() => {
    const canvas = document.createElement("canvas").getContext("2d")!;
    return [...document.querySelectorAll<HTMLElement>(".inline-link")].map((link) => {
      const style = getComputedStyle(link);
      const rect = link.getBoundingClientRect();
      const before = getComputedStyle(link, "::before");
      const barBottom = rect.bottom - parseFloat(before.bottom);
      const barTop = barBottom - parseFloat(before.height);
      const probe = link.appendChild(Object.assign(document.createElement("span"), { style: "display:inline-block;width:0;height:0;vertical-align:baseline" }));
      const baseline = probe.getBoundingClientRect().bottom;
      probe.remove();
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const ink = canvas.measureText(link.textContent!);
      const mask = link.closest(".sections-line-mask")!.getBoundingClientRect();
      return {
        text: link.textContent,
        clearGap: barTop - (baseline + ink.actualBoundingBoxDescent),
        fromBox: barTop - rect.bottom,
        inkInsideBox: baseline + ink.actualBoundingBoxDescent <= rect.bottom && baseline - ink.actualBoundingBoxAscent >= rect.top,
        maskSlack: mask.bottom - barBottom,
      };
    });
  });
  expect(report).toHaveLength(5);
  for (const item of report) {
    expect(item.clearGap, `${item.text}: clear of the descenders`).toBeGreaterThanOrEqual(1.25);
    expect(item.fromBox, `${item.text}: still attached to the word`).toBeLessThanOrEqual(2);
    expect(item.inkInsideBox, `${item.text}: the text-clipped fill reaches every glyph`).toBe(true);
    expect(item.maskSlack, `${item.text}: not clipped by its mask`).toBeGreaterThanOrEqual(0.5);
  }
});

test("inline links: a clicked definition stays filled once its modal closes and after a reload, with no flash on load", async ({ page }) => {
  const link = await productLink(page);
  await rest(page);
  await expect.poll(() => fillOf(link)).toBe(0);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await rest(page);
  await expect.poll(() => fillOf(link)).toBe(1);
  expect(await barScale(link)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("aaron-inline-visited"))).toBe(JSON.stringify(["def:product"]));
  await page.reload({ waitUntil: "domcontentloaded" });
  // Before React has hydrated: the head script already wrote the rule.
  expect(await page.evaluate(() => document.getElementById("inline-visited")?.textContent ?? "")).toContain('data-inline-key="product"');
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-inline="def"][data-inline-key="product"]')!).getPropertyValue("--inline-p")))).toBe(1);
  await page.waitForSelector("html[data-inline-links='ready']", { state: "attached" });
  const again = page.locator('[data-inline="def"][data-inline-key="product"]').first();
  expect(await fillOf(again)).toBe(1);
  expect(await again.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
});

test("inline links: an external link followed stays filled, and links never clicked stay empty", async ({ page, offsite }) => {
  await openFixture(page, TIP, CALENDAR);
  const calendar = page.getByRole("link", { name: "grab a time on my calendar" });
  const popup = page.waitForEvent("popup");
  await calendar.click();
  await (await popup).close();
  await expect.poll(() => offsite).toContain("https://cal.com/aaron-sulbaran");
  await rest(page);
  await expect.poll(() => fillOf(calendar)).toBe(1);
  await expect.poll(() => fillOf(tipLink(page))).toBe(0);
  await page.reload();
  await page.waitForSelector("html[data-inline-links='ready']", { state: "attached" });
  expect(await fillOf(page.getByRole("link", { name: "grab a time on my calendar" }))).toBe(1);
  expect(await fillOf(tipLink(page))).toBe(0);
});

test("inline links: storage that throws does not break clicking; the link fills for this page view", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
  });
  const link = await productLink(page);
  await link.click();
  await page.keyboard.press("Escape");
  await rest(page);
  await expect.poll(() => fillOf(link)).toBe(1);
});

// "Anything" opens this paragraph, so it sits at the left edge of its line's mask.
const LEAD = "[Anything](tip:killer-drones) leads this line.";
test("inline links: a focused link's ring is not clipped by its line's mask, mid-line or at a line's start", async ({ page }) => {
  await openFixture(page, TIP, LEAD, CALENDAR);
  expect(await page.locator("main .sections-line-mask").count()).toBeGreaterThan(0);
  for (const link of [tipLink(page).first(), tipLink(page).nth(1), page.getByRole("link", { name: "grab a time on my calendar" })]) {
    await tabTo(page, link);
    const clipped = await link.evaluate((el) => {
      const ring = el.getBoundingClientRect();
      const reach = 3 - parseFloat(getComputedStyle(el).paddingBottom); // a 2px outline at a 1px offset from the text box; the padding is part of the border box
      const mask = el.closest(".sections-line-mask");
      const clipNode = (axis: "overflowX" | "overflowY") => {
        let node = el.parentElement;
        while (node && getComputedStyle(node)[axis] === "visible") node = node.parentElement;
        return node;
      };
      const [x, y] = [clipNode("overflowX")?.getBoundingClientRect() ?? null, clipNode("overflowY")?.getBoundingClientRect() ?? null];
      return {
        inMask: !!mask,
        maskClipsY: !!mask && clipNode("overflowY") === mask,
        left: !!x && ring.left - reach < x.left, right: !!x && ring.right + reach > x.right, top: !!y && ring.top - reach < y.top, bottom: !!y && ring.bottom + reach > y.bottom,
      };
    });
    expect(clipped).toEqual({ inMask: true, maskClipsY: true, left: false, right: false, top: false, bottom: false });
  }
});

test("inline links: no markup leaks onto the home as text", async ({ page }) => {
  await openHome(page);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/\]\((?:def|tip|pop):|\]\(https:|\*\*/);
});
