import { siteContent } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { jobTags } from "@/lib/content/jobTags";
import { GALLERY } from "@/lib/gallery/constants";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";

// The jobs modal (2026-10-29): Aaron's title and four paragraphs, the jobs newest first as employee name tags with their tips on
// the page, his LinkedIn post embedded beside the last paragraph, and the whole modal staggered the way the others are.

const { modal, timeline, tag } = siteContent.cards.jobs;
const embed = modal.embed!;
const tagLabels = jobTags.map((job) => tag.label(job.employer));

type Piece = { kind: "tag" | "photo" | "embed"; label: string; row: number; left: number; right: number; top: number; bottom: number };

// Every piece of media in the modal as drawn, in reading order (its row, then left to right).
async function pieces(dialog: import("@playwright/test").Locator): Promise<Piece[]> {
  return dialog.locator("[data-photo-frame]").evaluateAll((frames) => {
    const rows = [...document.querySelectorAll('[data-row="photo"]')];
    return frames
      .map((frame) => {
        const rect = frame.getBoundingClientRect();
        const kind = (frame.getAttribute("data-media") === "tag" ? "tag" : frame.getAttribute("data-media") === "embed" ? "embed" : "photo") as Piece["kind"];
        const label = kind === "tag" ? (frame.querySelector("[data-job-tag]")?.getAttribute("aria-label") ?? "") : kind === "embed" ? (frame.querySelector("iframe")?.getAttribute("title") ?? "") : (frame.querySelector("img")?.getAttribute("alt") ?? "");
        return { kind, label, row: rows.findIndex((row) => row.contains(frame)), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })
      // Reading order: its row, then line by line (a 2 by 2 block's tags, then its photos), then left to right.
      .sort((a, b) => a.row - b.row || (Math.abs(a.top - b.top) > 2 ? a.top - b.top : a.left - b.left));
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test.describe(`at ${viewport.width}`, () => {
    test.use({ viewport });

    test("jobs modal: Aaron's title and four paragraphs, then the name tags newest first", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
      await expect(dialog.getByRole("heading", { name: 'The "unflattering" jobs that shaped me', exact: true })).toBeVisible();
      await expect(dialog.locator('[data-text-column] p[data-mask^="words-"]')).toHaveText(modal.blocks.map((block) => visibleText(block)));
      // The tags, down the page in reading order: Aritzia, Apple, UT Austin, MOD, Popeyes.
      const tags = (await pieces(dialog)).filter((piece) => piece.kind === "tag").map((piece) => piece.label);
      expect(tags).toEqual(["Aritzia", "Apple", "Student mentor, UT Austin", "MOD Pizza", "Popeyes"].map((employer) => tag.label(employer)));
      expect(tags).toEqual(tagLabels);
      // The photos sit with their own job's tag: the Aritzia poster beside Aritzia's, the badge beside Apple's, MOD's pair under MOD's.
      const all = await pieces(dialog);
      const at = (label: string) => all.find((piece) => piece.label === label)!;
      for (const photo of modal.photos) {
        const job = at(tag.label(timeline[photo.timeline!].employer));
        expect(at(photo.alt).row, `${photo.alt} sits with ${job.label}`).toBe(job.row);
        if (photo.timeline === 3) {
          expect(at(photo.alt).top, `${photo.alt} is under MOD's tag`).toBeGreaterThan(job.bottom - 1);
        }
      }
    });

    test("jobs modal: every tag shows its logo, my name, role and when, and the labelled tip, legibly with no hover", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      await page.mouse.move(2, 2);
      for (const [job, view] of jobTags.entries()) {
        const card = dialog.locator(`[data-job-tag="${job}"]`);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();
        await expect(card.locator("[data-job-tag-logo] img:visible")).toHaveCount(1);
        await expect(card.locator("[data-job-tag-name]")).toHaveText("Aaron");
        await expect(card.locator("[data-job-tag-role]")).toHaveText(view.role!);
        await expect(card.locator("[data-job-tag-when]")).toHaveText(view.when);
        await expect(card.locator("[data-job-tag-tip]")).toContainText(tag.tipLabel);
        await expect(card.locator("[data-job-tag-tip]")).toContainText(view.tip);
        // Legible: the tip is body-sized, whole inside its tag, and the tag has a hairline and the photos' radius.
        const read = await card.evaluate((el) => {
          const tip = el.querySelector("[data-job-tag-tip] p:last-child") as HTMLElement;
          const box = el.getBoundingClientRect();
          const tipBox = tip.getBoundingClientRect();
          const style = getComputedStyle(el);
          return { font: parseFloat(getComputedStyle(tip).fontSize), clipped: tip.scrollHeight > tip.clientHeight + 1, inside: tipBox.bottom <= box.bottom + 1 && tipBox.right <= box.right + 1, radius: parseFloat(style.borderTopLeftRadius), border: parseFloat(style.borderTopWidth), shadow: style.boxShadow, text: getComputedStyle(tip).color, ground: style.backgroundColor };
        });
        expect(read.font, `${view.employer}: the tip's size`).toBeGreaterThanOrEqual(14);
        expect(read.clipped, `${view.employer}: the tip is not clipped`).toBe(false);
        expect(read.inside).toBe(true);
        expect(read.radius, "the photos' radius").toBeGreaterThan(8);
        expect(read.border).toBe(1);
        expect(read.shadow, "flat: no shadow").toBe("none");
        expect(read.text).not.toBe(read.ground);
      }
      // The tips are not behind a hover any more: no employer name is an inline tip.
      await expect(dialog.locator('[data-inline="tip"]')).toHaveCount(0);
    });

    test("jobs modal: the media alternate sides down the modal, each cluster beside its paragraph, none stacked under another", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      const rows = dialog.locator('[data-row="photo"]');
      await expect(rows).toHaveCount(4);
      const layout = await rows.evaluateAll((els) =>
        els.map((row) => {
          const media = [...row.querySelectorAll("[data-photo-frame]")].map((frame) => frame.getBoundingClientRect());
          const slot = row.querySelector("[data-cluster]")!.getBoundingClientRect();
          const text = row.querySelector("[data-text-column]")!;
          return { side: row.getAttribute("data-side"), slot: { left: slot.left, right: slot.right }, text: { left: text.getBoundingClientRect().left, right: text.getBoundingClientRect().right }, words: text.querySelectorAll('[data-mask^="words-"]').length, media: media.length };
        }),
      );
      expect(layout.map((row) => row.side)).toEqual(["left", "right", "left", "right"]);
      layout.forEach((row, i) => {
        if (row.side === "left") expect(row.text.left, `row ${i}: words right of their media`).toBeGreaterThan(row.slot.right);
        else expect(row.text.right, `row ${i}: words left of their media`).toBeLessThan(row.slot.left);
      });
      // The four rows pair with the four paragraphs, one each.
      expect(layout.map((row) => row.words)).toEqual([1, 1, 1, 1]);
      // In reading order no two consecutive media share a column (a cluster's two sit side by side), and each is no higher than the one before.
      const all = await pieces(dialog);
      expect(all).toHaveLength(modal.photos.length + timeline.length + 1);
      for (let i = 1; i < all.length; i++) {
        const [above, below] = [all[i - 1], all[i]];
        const overlap = Math.min(above.right, below.right) - Math.max(above.left, below.left);
        expect(overlap, `${above.label} and ${below.label} share no column`).toBeLessThanOrEqual(0);
        expect(below.top, `${below.label} is no higher than ${above.label}`).toBeGreaterThanOrEqual(above.top - 1);
      }
      // And the clusters alternate: a row's media are all on its side of the panel's middle, the next row's on the other.
      const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
      const middle = panel.x + panel.width / 2;
      const byRow = new Map<number, Piece[]>();
      for (const piece of all) byRow.set(piece.row, [...(byRow.get(piece.row) ?? []), piece]);
      layout.forEach((row, i) => {
        const cluster = (byRow.get(i) ?? []).filter((piece) => piece.left >= row.slot.left - 1 && piece.right <= row.slot.right + 1);
        expect(cluster.length, `row ${i}'s cluster`).toBeGreaterThan(0);
        for (const piece of cluster) expect(row.side === "left" ? piece.right <= middle + 1 : piece.left >= middle - 1, `${piece.label} on the ${row.side}`).toBe(true);
      });
      // Popeyes' tag is beside the post's paragraph, in its words column, under the words.
      const last = rows.nth(3);
      await expect(last.locator("[data-text-column] [data-aside] [data-job-tag]")).toHaveAttribute("aria-label", tag.label("Popeyes"));
      await expect(last.locator("[data-cluster] iframe")).toHaveCount(1);
      // Paragraph 3's row is a 2 by 2 block: UT Austin's and MOD's tags on top, MOD's selfie and sign under them, in the same two columns.
      const block = all.filter((piece) => piece.row === 2);
      expect(block.map((piece) => piece.label)).toEqual([tag.label("Student mentor, UT Austin"), tag.label("MOD Pizza"), modal.photos[2].alt, modal.photos[3].alt]);
      const [ut, mod, selfie, sign] = block;
      expect(Math.abs(ut.top - mod.top), "the tags share a line").toBeLessThan(2);
      expect(Math.abs(selfie.top - sign.top), "the photos share a line").toBeLessThan(2);
      expect(selfie.top, "the photos are under the tags").toBeGreaterThanOrEqual(Math.max(ut.bottom, mod.bottom) - 1);
      expect(Math.abs(selfie.left - ut.left) < 2 && Math.abs(sign.left - mod.left) < 2, "in the tags' columns").toBe(true);
      expect(Math.abs(ut.right - mod.left), "a gap, not an overlap, between columns").toBeLessThanOrEqual(GALLERY.cluster.gap + 1);
    });

    test("jobs modal: Aaron's LinkedIn post is embedded as he wrote it, lazy and titled, at its native 504 by 1258 in the photos' radius and border", async ({ page, offsite }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
      // Mounted only while the modal is open: nowhere on the page before it, and nothing asked of LinkedIn.
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(offsite.filter((url) => url.includes("linkedin.com"))).toEqual([]);
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true, home: false });
      const frame = dialog.locator("iframe");
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute("src", "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7463750786611630080");
      await expect(frame).toHaveAttribute("loading", "lazy");
      await expect(frame).toHaveAttribute("title", embed.title);
      await expect(frame).toHaveAttribute("width", "504");
      await expect(frame).toHaveAttribute("height", "1258");
      await expect(frame).toHaveAttribute("frameborder", "0");
      await expect(frame).toHaveAttribute("allowfullscreen", "");
      await expect(frame).not.toHaveAttribute("title", "Embedded post");
      // Reached by scrolling, it loads (the suite refuses any host but its own, so the request is recorded and aborted).
      await frame.scrollIntoViewIfNeeded();
      await expect.poll(() => offsite.filter((url) => url.startsWith(embed.src)).length).toBeGreaterThan(0);
      // Native size, and the photos' frame: the same radius as a photo's, a hairline around it.
      const size = (await frame.boundingBox())!;
      expect(Math.round(size.width), "native width").toBe(504);
      expect(Math.round(size.height), "native height").toBe(1258);
      const mask = (el: Element) => {
        const frameEl = el.closest("[data-mask]") as HTMLElement;
        const css = getComputedStyle(frameEl);
        return { radius: css.borderTopLeftRadius, border: css.borderTopWidth, color: css.borderTopColor, shadow: css.boxShadow };
      };
      const around = await frame.evaluate(mask);
      const photo = await dialog.getByRole("img", { name: modal.photos[0].alt, exact: true }).evaluate((el) => (el.closest("[data-mask]") as HTMLElement && { radius: getComputedStyle(el.closest("[data-mask]") as HTMLElement).borderTopLeftRadius }));
      expect(around.radius).toBe(photo.radius);
      expect(around.border).toBe("1px");
      expect(around.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(around.shadow).toBe("none");
      // The link stays for a reader whose blockers stop the frame.
      await expect(dialog.getByRole("link", { name: /The LinkedIn post/ })).toHaveAttribute("href", "https://lnkd.in/p/g3mXFGcY");
      // Closing the modal takes the frame with it.
      await page.keyboard.press("Escape");
      await expect(page.locator("iframe")).toHaveCount(0);
    });
  });
}

// What a phone's pager page holds, read off its markup: the media on it (a name tag, a photo or the post's link card), or "words" for a
// paragraph on a page of its own.
type Kind = "tag" | "photo" | "card" | "words";
const kindsOf = (pages: import("@playwright/test").Locator) =>
  pages.evaluateAll((els) => els.map((el): Kind => (el.hasAttribute("data-words-only") ? "words" : el.querySelector("[data-job-tag]") ? "tag" : el.querySelector("[data-post-card]") ? "card" : "photo")));

// The page's whole read at once: nothing on it is scrolled, clipped or wider than the panel, in the pager's pages as laid out.
async function readPages(page: import("@playwright/test").Page) {
  return page.evaluate((gap) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-card-modal="jobs"]')!;
    const viewport = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.getBoundingClientRect();
    const room = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.clientHeight;
    const pages = [...dialog.querySelectorAll<HTMLElement>("[data-pager-page]")].map((el) => {
      const stage = el.querySelector<HTMLElement>("[data-pager-stage]");
      const text = el.querySelector<HTMLElement>("[data-pager-text]");
      const inner = text?.firstElementChild as HTMLElement | undefined;
      // Anything inside the page that scrolls, or has more to show than it draws.
      const scrolled = [...el.querySelectorAll<HTMLElement>("*")].filter((node) => /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).length;
      const tip = el.querySelector<HTMLElement>("[data-job-tag-tip]");
      return {
        unit: Number(el.dataset.unit),
        stage: stage ? stage.offsetHeight : null,
        stageBottom: stage ? stage.getBoundingClientRect().bottom : null,
        words: inner ? inner.offsetHeight : null,
        wordsBottom: inner?.lastElementChild ? inner.lastElementChild.getBoundingClientRect().bottom : null,
        textBottom: text ? text.getBoundingClientRect().bottom : null,
        scrolled,
        scrollsFlag: !!text?.hasAttribute("data-scrolls"),
        tipInside: tip ? tip.getBoundingClientRect().bottom <= viewport.bottom + 1 : true,
        paragraphs: [...el.querySelectorAll<HTMLElement>('[data-pager-text] p[data-mask^="words-"]')].map((p) => ({ unit: Number(p.dataset.mask!.slice(6)), text: p.textContent ?? "" })),
        iframes: el.querySelectorAll("iframe").length,
        gap,
      };
    });
    return { room, viewportBottom: viewport.bottom, pages };
  }, GALLERY.pager.pageGapPx);
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("jobs modal: at 390 each tag, photo and the post's card has a page, a paragraph that does not fit under its tag has a page of its own, and nothing scrolls inside a page", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
    const pages = dialog.locator("[data-pager-page]");
    const kinds = await kindsOf(pages);
    // The media, newest first, in the order they always had (a tag, then its photo; the post's card, then Popeyes' tag) with a page of words
    // wherever a paragraph did not fit; no frame of the post anywhere on a phone.
    expect(kinds.filter((kind) => kind !== "words")).toEqual(["tag", "photo", "tag", "photo", "tag", "tag", "photo", "photo", "card", "tag"]);
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await expect(dialog.locator("[data-embed-stage]")).toHaveCount(0);
    expect(kinds.filter((kind) => kind === "words").length, "the paragraphs that did not fit").toBeGreaterThan(0);

    const read = await readPages(page);
    expect(read.pages).toHaveLength(kinds.length);
    // Every word shows, once and in order: the four paragraphs, whole.
    const shown = read.pages.flatMap((p) => p.paragraphs);
    expect(shown.map((p) => p.unit)).toEqual([0, 1, 2, 3]);
    expect(shown.map((p) => p.text)).toEqual(modal.blocks.map((block) => visibleText(block)));
    read.pages.forEach((p, i) => {
      expect(p.scrolled, `page ${i + 1}: nothing in it scrolls`).toBe(0);
      expect(p.scrollsFlag, `page ${i + 1}: its words are not in a scroll window`).toBe(false);
      expect(p.tipInside, `page ${i + 1}: the tip is not cut off at the foot`).toBe(true);
      if (p.stageBottom !== null) expect(p.stageBottom, `page ${i + 1}: its stage ends inside the pages`).toBeLessThanOrEqual(read.viewportBottom + 1);
      if (p.wordsBottom !== null) expect(p.wordsBottom, `page ${i + 1}: its words end inside their area`).toBeLessThanOrEqual(p.textBottom! + 1);
    });
    // A paragraph has a page to itself only when it would not have fitted under its stage; one that fits stays with it.
    const stages = new Map(read.pages.flatMap((p) => (p.stage !== null ? [[p.unit, p.stage] as const] : [])));
    kinds.forEach((kind, i) => {
      const p = read.pages[i];
      const words = p.words;
      if (kind === "words") expect(stages.get(p.unit)! + p.gap + words!, `page ${i + 1}: stage, gap and words together`).toBeGreaterThan(read.room + 1);
      else if (words !== null && p.stage !== null) expect(p.stage + p.gap + words, `page ${i + 1}: stage, gap and words together`).toBeLessThanOrEqual(read.room + 1);
    });
    // A page of words follows the media its paragraph sat beside: the first tag's, the second's, the third's, and the post's card.
    const anchorOf = (unit: number) => {
      const at = read.pages.findIndex((p) => p.paragraphs.some((q) => q.unit === unit));
      return kinds[at] === "words" ? at - 1 : at;
    };
    expect([0, 1, 2, 3].map((unit) => kinds[anchorOf(unit)])).toEqual(["tag", "tag", "tag", "card"]);
    expect([0, 1, 2].map((unit) => read.pages[anchorOf(unit)].unit), "the tags of Aritzia, Apple and UT Austin").toEqual([4, 5, 6]);
    // The title is three lines or fewer: it stepped down from four.
    const title = await dialog.locator("[data-pager] h2").evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
    expect(Math.round(title.height / title.line), "lines in the title").toBeLessThanOrEqual(3);
  });

  test("jobs modal: at 390 every page is within the panel, the controls too, and the post is one link card to the post", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
    const pages = dialog.locator("[data-pager-page]");
    const count = await pages.count();
    const next = dialog.getByRole("button", { name: siteContent.modals.gallery.nextPage, exact: true });
    for (let i = 0; i < count; i++) {
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const dialogEl = document.querySelector<HTMLElement>('[role="dialog"][data-card-modal="jobs"]')!;
        const panel = dialogEl.querySelector<HTMLElement>("[data-gallery-panel]")!;
        const bounds = panel.getBoundingClientRect();
        const wide = [...panel.querySelectorAll<HTMLElement>("*")].filter((el) => !el.closest("[inert]") && el.getBoundingClientRect().width > 0).filter((el) => el.getBoundingClientRect().right > bounds.right + 1 && !el.closest("[data-pager-track]")).length;
        return { page: root.scrollWidth - root.clientWidth, dialog: dialogEl.scrollWidth - dialogEl.clientWidth, panel: panel.scrollWidth - panel.clientWidth, wide };
      });
      expect(overflow, `page ${i + 1}`).toEqual({ page: 0, dialog: 0, panel: 0, wide: 0 });
      // The dots and arrows stay inside the panel, however many pages there are.
      const controls = (await dialog.locator("[data-pager-controls]").boundingBox())!;
      const panelBox = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
      expect(controls.x + controls.width, `page ${i + 1}: controls inside the panel`).toBeLessThanOrEqual(panelBox.x + panelBox.width);
      if (i < count - 1) {
        await next.click();
        await page.waitForTimeout(450);
      }
    }
    // The post's page: one link card, in the site's card language, to the post's own link, with Aaron's name, its hook line and the way in.
    const card = dialog.locator("[data-post-card]");
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("href", modal.links[0].href);
    await expect(card).toHaveAttribute("target", "_blank");
    await expect(card).toHaveAttribute("rel", /noopener/);
    await expect(card).toContainText(modal.postCard!.byline);
    await expect(card).toContainText(modal.postCard!.hook);
    await expect(card).toContainText(modal.postCard!.cta);
    await expect(dialog.getByRole("link", { name: /The LinkedIn post/ }), "the card is the link: the label link is not drawn beside it").toHaveCount(0);
    const frame = await card.evaluate((el) => {
      const style = getComputedStyle(el);
      const mask = el.closest("[data-mask]") as HTMLElement;
      return { radius: parseFloat(getComputedStyle(mask).borderTopLeftRadius), border: parseFloat(style.borderTopWidth), shadow: style.boxShadow };
    });
    expect(frame.radius, "the photos' radius").toBeGreaterThan(8);
    expect(frame.border).toBe(1);
    expect(frame.shadow, "flat: no shadow").toBe("none");
  });

  // A short phone: Safari's 664px tall window, where a page has under 370px: the tags shrink to fit it and no tip is cut off.
  test.describe("at 664 tall", () => {
    test.use({ viewport: { width: 390, height: 664 } });
    test("jobs modal: on a short phone a tag shrinks to the page's room, never past 80 percent, and still nothing scrolls or is cut off", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      const read = await readPages(page);
      expect(read.room, "the pages' room is short").toBeLessThan(400);
      read.pages.forEach((p, i) => {
        expect(p.scrolled, `page ${i + 1}: nothing in it scrolls`).toBe(0);
        expect(p.tipInside, `page ${i + 1}: the tip is not cut off at the foot`).toBe(true);
        if (p.stage !== null) expect(p.stage, `page ${i + 1}: its stage fits the room`).toBeLessThanOrEqual(read.room + 1);
      });
      const scales = await dialog.locator("[data-fit-scale]").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-fit-scale"))));
      expect(scales.length, "tags taller than the room are shrunk").toBeGreaterThan(0);
      for (const scale of scales) expect(scale).toBeGreaterThanOrEqual(GALLERY.pager.fitFloor);
      // Every paragraph is still whole.
      expect(read.pages.flatMap((p) => p.paragraphs).map((p) => p.text)).toEqual(modal.blocks.map((block) => visibleText(block)));
    });
  });
});

test("jobs modal: the pager's page size does not change what the desktop keeps: ten pieces of media, four paragraphs, one link", async () => {
  expect(GALLERY.cluster.itemWidth * 2 + GALLERY.cluster.gap, "a pair is as wide as the post").toBe(embed.width);
  expect(modal.photos.length + timeline.length + 1).toBe(10);
  expect(modal.blocks).toHaveLength(4);
  expect(modal.links).toHaveLength(1);
});
