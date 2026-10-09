import type { CDPSession, Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { capsuleText } from "@/lib/waveform/dock";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { pointerTo } from "./support/input";

// The label face (docs/label-face-spec.md): every small non-body text is
// Profa Bold at one of three steps, 0.01em, weight 700, in the accent when
// clickable or beside a title and muted otherwise. Computed styles only.

const STEP = { "label-sm": 12.72, label: 14.84, "label-lg": 19.08 } as const;
type Step = keyof typeof STEP;
type Tone = "accent" | "muted" | "foreground";

async function expectLabel(locator: Locator, step: Step, tone: Tone) {
  const read = await locator.evaluate((el) => {
    const first = (list: string) => list.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const tone = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--color-${name})`;
      el.parentElement!.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const s = getComputedStyle(el);
    return {
      text: (el.textContent ?? "").trim().slice(0, 40),
      family: first(s.fontFamily),
      label: first(getComputedStyle(document.documentElement).getPropertyValue("--font-label")),
      weight: s.fontWeight,
      size: parseFloat(s.fontSize),
      tracking: parseFloat(s.letterSpacing),
      color: s.color,
      tones: { accent: tone("accent"), muted: tone("muted"), foreground: tone("foreground") },
    };
  });
  expect(read.label, "--font-label is set on <html>").not.toBe("");
  expect(read.family, `${read.text}: family`).toBe(read.label);
  expect(read.weight, `${read.text}: weight`).toBe("700");
  expect(read.size, `${read.text}: size`).toBeCloseTo(STEP[step], 1);
  expect(read.tracking, `${read.text}: tracking`).toBeCloseTo(STEP[step] * 0.01, 2);
  expect(read.color, `${read.text}: color`).toBe(read.tones[tone]);
}

// Opens a work card's modal the way a visitor does: hover the card until the
// scene picks it, then click (as flight.spec.ts does).
async function openWorkModal(page: Page, cdp: CDPSession) {
  await openHome(page, { debug: "flight" });
  const find = () =>
    page.evaluate(() => {
      const w = window as HookWindow;
      const slot = w.__coilFlight!.scene.slots().find(
        (s) =>
          s.kind === "work" && s.depth > 0.3 &&
          s.center.x > 80 && s.center.x < innerWidth - 80 && s.center.y > 80 && s.center.y < innerHeight * 0.75 &&
          w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot === s.slot,
      );
      return slot?.slot ?? null;
    });
  await expect.poll(find, { timeout: 20_000, message: "a work card on screen" }).not.toBeNull();
  const slot = (await find())!;
  await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.follow(n), slot);
  const center = await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.slot(n)!.center, slot);
  await pointerTo(cdp, center);
  await page.waitForFunction((n) => (window as HookWindow).__coil!.hovered() === n, slot);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...center, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...center, button: "left", clickCount: 1 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("label face: controls and links are Profa Bold in the accent", async ({ page, cdp }) => {
  await page.goto("/work/capital-one-pm");
  await expectLabel(page.locator("article a[href='/#work']"), "label", "accent");
  await expectLabel(page.getByRole("link", { name: siteContent.work.placeholderCta }), "label-lg", "accent");

  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator('#listen [data-control="on"]'), "label", "accent");
  await expectLabel(page.locator('#listen [data-control="paused"]'), "label", "accent");
  await expectLabel(page.locator("#listen button", { hasText: siteContent.listen.freeze }), "label-sm", "accent");
  await expectLabel(page.locator("#listen a", { hasText: siteContent.soundtrack.creditArtist }), "label-sm", "accent");

  await page.goto("/label-face-missing");
  await expectLabel(page.getByRole("link", { name: siteContent.notFound.cta }), "label", "accent");

  const dialog = await openWorkModal(page, cdp);
  await expectLabel(dialog.getByRole("link", { name: siteContent.work.cta }), "label-lg", "accent");
});

test("label face: meta beside a title is Profa Bold in the accent", async ({ page, cdp }) => {
  const item = siteContent.workItems.find((i) => i.slug === "capital-one-pm")!;
  await page.goto(`/work/${item.slug}`);
  await expectLabel(page.locator("article").getByText(`${item.role}, ${item.year}`, { exact: true }), "label-lg", "accent");

  const row = siteContent.book.workRows.find((r) => r.key === "capital-one-pm")!;
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("#work .book-row").getByText(row.meta, { exact: true }), "label", "accent");

  const dialog = await openWorkModal(page, cdp);
  const shownTitle = (await dialog.locator("h2").textContent())?.trim();
  const shown = siteContent.workItems.find((i) => i.title === shownTitle)!;
  await expectLabel(dialog.getByText(`${shown.role}, ${shown.year}`, { exact: true }), "label", "accent");
});

test("label face: hints and the credit prose are Profa Bold, muted", async ({ page, cdp }) => {
  const dialog = await openWorkModal(page, cdp);
  await expectLabel(dialog.getByText(siteContent.modals.closeHintKeyboard, { exact: true }), "label", "muted");
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(dialog).toBeHidden();

  await expectLabel(page.locator("#listen p", { hasText: siteContent.soundtrack.creditLead }), "label-sm", "muted");
  const row = page.locator("#work button.book-row", { hasText: "Public speaking" });
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  await page.keyboard.press("Enter");
  const photo = page.getByRole("dialog");
  await expectLabel(photo.getByText(siteContent.modals.closeHintKeyboard, { exact: true }), "label", "muted");
});

test("label face: Who I am's block kickers and the Connect labels are Profa Bold, muted, and no section draws a kicker over its heading", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  const { whoIAm } = siteContent;
  for (const id of ["#about", "#numbers", "#connect"]) {
    const first = await page.locator(`${id} [data-sections-block]`).first().evaluate((el) => `${el.tagName.toLowerCase()} ${el.getAttribute("data-sections-block")}`);
    expect(first, `${id}: the first block in the section is its big heading, no kicker over it`).toBe("h2 heading");
  }
  for (const block of whoIAm.blocks) {
    for (const label of [block.label, ...(block.sub ? [block.sub.label] : [])]) {
      await expectLabel(page.locator("#about").getByText(label, { exact: true }), "label", "muted");
    }
  }
  await expectLabel(page.locator("#connect li a [data-sections-rowinner] > span").first(), "label", "muted");
});

test("label face: the nav bar, the Menu pill and the panel are Profa Bold in the accent", async ({ page }) => {
  const m = siteContent.menu;
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("header nav a").first(), "label", "accent");
  const pill = page.locator(`button[aria-controls]`, { hasText: m.pillLabel });
  await expectLabel(pill.getByText(m.pillLabel, { exact: true }).first(), "label", "accent");
  await pill.click();
  await expectLabel(page.getByRole("button", { name: m.themeAriaLabelToDark }), "label", "accent");
  await expectLabel(page.getByRole("link", { name: m.email.label, exact: true }), "label", "accent");
  await expectLabel(page.getByRole("link", { name: m.socials[0].label, exact: true }).last(), "label", "accent");
});

test("label face: the footer copyright is Profa Bold, muted, at the small step", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("footer").getByText(siteContent.footer.copyright, { exact: true }), "label-sm", "muted");
});

test("label face: the pill and the player card are Profa Bold at the small step", async ({ page }) => {
  const S = siteContent.soundtrack;
  const track = S.tracks[0];
  await page.goto("/");
  await settled(page);
  const pill = page.locator("[data-pill]");
  await expect(pill).toBeAttached();
  await expectLabel(pill.getByText(S.prompt, { exact: true }), "label-sm", "muted");
  const capsule = pill.locator(".pill-hit");
  await expectLabel(capsule.getByText(capsuleText("before", track.title), { exact: true }).first(), "label-sm", "muted");
  await expectLabel(capsule.getByText(track.title, { exact: true }).first(), "label-sm", "foreground");
  await expectLabel(capsule.getByText(track.artist, { exact: true }).first(), "label-sm", "muted");
  const card = pill.locator('[role="group"]');
  await expectLabel(card.getByText(track.artist, { exact: true }), "label-sm", "muted");
  await expectLabel(card.getByText(S.statusReady, { exact: true }), "label-sm", "muted");
  const time = card.getByText("0:00").first();
  await expectLabel(time, "label-sm", "muted");
  await expectLabel(card.locator("button", { hasText: siteContent.listen.freeze }), "label-sm", "accent");
});

// The trial Profa Bold has no tnum, so tabular-nums alone lets a ticking time
// change width and wobble the seek bar between them. Each time sits in a box
// sized for its widest string; the narrowest ("1:11") and widest ("0:00")
// must render the same width, so the bar never moves.
test("label face: the player card's times keep one width as their digits change", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  const seek = page.locator("[data-pill] [role='group']").getByLabel(siteContent.soundtrack.ariaSeek);
  await expect(seek).toBeAttached();
  const read = await seek.evaluate((input) => {
    const measure = (el: Element) => {
      const original = el.textContent;
      const width = (text: string) => {
        el.textContent = text;
        return el.getBoundingClientRect().width;
      };
      const out = { narrow: width("1:11"), wide: width("0:00"), tabular: getComputedStyle(el).fontVariantNumeric };
      el.textContent = original;
      return out;
    };
    return { elapsed: measure(input.previousElementSibling!), remaining: measure(input.nextElementSibling!) };
  });
  for (const [name, box] of Object.entries(read)) {
    expect(box.wide, `${name}: rendered`).toBeGreaterThan(0);
    expect(box.narrow, `${name}: width for 1:11 against 0:00`).toBe(box.wide);
    expect(box.tabular, `${name}: tabular-nums kept for the full cut`).toBe("tabular-nums");
  }
});

test("label face: the band's answers sit on the question's baseline, 36px after it, 16px apart", async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const baseline = (el: Element) => {
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        el.append(probe);
        const y = probe.getBoundingClientRect().top;
        probe.remove();
        return y;
      };
      const text = (el: Element) => {
        const r = document.createRange();
        r.selectNodeContents(el.firstChild!);
        return r.getBoundingClientRect();
      };
      const q = document.querySelector("#listen h2")!;
      const play = document.querySelector('#listen [data-control="before"]')!;
      const not = play.nextElementSibling!;
      const s = getComputedStyle(not);
      return {
        drift: ["before", "on", "paused"].map((k) => Math.abs(baseline(document.querySelector(`#listen [data-control="${k}"]`)!) - baseline(q))),
        afterQuestion: text(play).left - text(q).right,
        inPair: text(not).left - text(play).right,
        line: s.textDecorationLine,
        offset: s.textUnderlineOffset,
        alpha: Number(s.textDecorationColor.match(/([\d.]+)\)$/)![1]),
      };
    });
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("#listen button", { hasText: siteContent.listen.decline }), "label", "muted");
  const light = await read();
  for (const d of light.drift) expect(d, "control baseline to the question's").toBeLessThanOrEqual(0.5);
  expect(light.afterQuestion).toBeCloseTo(36, 0);
  expect(light.inPair).toBeCloseTo(16, 0);
  expect({ line: light.line, offset: light.offset }).toEqual({ line: "underline", offset: "4px" });
  expect(light.alpha).toBeCloseTo(0.4, 2);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await settled(page);
  expect((await read()).alpha).toBeCloseTo(0.55, 2);
});

test("label face: the back link is a drawn 14px arrow, lifted 1px, then Work", async ({ page }) => {
  await page.goto("/work/capital-one-pm");
  const link = page.locator("article a[href='/#work']");
  await expect(link).toHaveText("Work");
  const icon = link.locator("svg");
  expect(await icon.evaluate((el) => ({
    w: el.getBoundingClientRect().width,
    stroke: el.getAttribute("stroke-width"),
    top: getComputedStyle(el).top,
    first: el.parentElement!.firstElementChild === el,
  }))).toEqual({ w: 14, stroke: "2.5", top: "-1px", first: true });
});

test("label face: role lines sit under their titles, 14px on the case page and 6px in the modal", async ({ page, cdp }) => {
  const gap = (title: Locator) =>
    title.evaluate((h) => {
      const p = h.nextElementSibling as HTMLElement | null;
      return p?.tagName === "P" ? p.getBoundingClientRect().top - h.getBoundingClientRect().bottom : null;
    });
  await page.goto("/work/capital-one-pm");
  expect(await gap(page.locator("article h1"))).toBeCloseTo(14, 0);
  const dialog = await openWorkModal(page, cdp);
  expect(await gap(dialog.locator("h2"))).toBeCloseTo(6, 0);
  const fit = await dialog.locator("[data-tile-slot='work']").evaluate((slot) => ({
    block: slot.nextElementSibling!.getBoundingClientRect().height,
    slot: slot.getBoundingClientRect().height,
  }));
  expect(fit.block, "title block within the logo slot's height").toBeLessThanOrEqual(fit.slot);
});

const rowLayout = (page: Page) =>
  page.locator("#work .book-row").evaluateAll((rows) =>
    rows.map((row) => {
      const [title, meta] = [row.children[0], row.children[1]].map((el) => el.getBoundingClientRect());
      const box = row.getBoundingClientRect();
      const s = getComputedStyle(row);
      const inner = box.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      return {
        text: row.textContent,
        wrap: s.flexWrap,
        wrapped: meta.top >= title.bottom - 1,
        fits: title.width + 14 + meta.width <= inner + 0.5,
      };
    }),
  );

test("label face: a row's meta wraps under its title only when the two do not fit, and a seen row dims it to 0.75", async ({ page }) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, JSON.stringify(["capital-one-pm"])), SEEN_STORAGE_KEY);
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settled(page);
    for (const row of await rowLayout(page)) {
      expect(row.wrap).toBe("wrap");
      expect(row.wrapped, `${viewport.width}: ${row.text}`).toBe(!row.fits);
    }
  }
  const meta = page.locator("#work .book-row").getByText(siteContent.book.workRows.find((r) => r.key === "capital-one-pm")!.meta, { exact: true });
  await page.mouse.move(1, 1);
  await expect.poll(() => meta.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.75, 2);
  await meta.hover();
  await expect.poll(() => meta.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});

test("label face: at 1440 every work row's meta sits beside its title", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  for (const row of await rowLayout(page)) expect(row.wrapped, row.text ?? "").toBe(false);
});
