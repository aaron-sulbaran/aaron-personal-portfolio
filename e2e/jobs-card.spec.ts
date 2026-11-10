import { siteContent } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { jobTags } from "@/lib/content/jobTags";
import { GALLERY } from "@/lib/gallery/constants";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";

// The jobs modal (2026-10-29): Aaron's title and four paragraphs, the jobs newest first as employee name tags with their tips on
// the page, his LinkedIn post beside the last paragraph as LinkedIn's own short embed with View on LinkedIn under it (2026-11-09,
// after Jolie Zhou's site), and the whole modal staggered the way the others are.

const { modal, timeline, tag } = siteContent.cards.jobs;
const embed = modal.embed!;
const tagLabels = jobTags.map((job) => tag.label(job.employer));

type Piece = { kind: "tag" | "photo" | "post"; label: string; row: number; left: number; right: number; top: number; bottom: number };

// Every piece of media in the modal as drawn, in reading order (its row, then left to right).
async function pieces(dialog: import("@playwright/test").Locator): Promise<Piece[]> {
  return dialog.locator("[data-photo-frame]").evaluateAll((frames) => {
    const rows = [...document.querySelectorAll('[data-row="photo"]')];
    return frames
      .map((frame) => {
        const rect = frame.getBoundingClientRect();
        const kind = (frame.getAttribute("data-media") === "tag" ? "tag" : frame.getAttribute("data-media") === "post" ? "post" : "photo") as Piece["kind"];
        const label = kind === "tag" ? (frame.querySelector("[data-job-tag]")?.getAttribute("aria-label") ?? "") : kind === "post" ? (frame.querySelector("iframe")?.getAttribute("title") ?? "") : (frame.querySelector("img")?.getAttribute("alt") ?? "");
        return { kind, label, row: rows.findIndex((row) => row.contains(frame)), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })
      // Reading order: its row, then line by line (a 2 by 2 block's tags, then its photos), then left to right.
      .sort((a, b) => a.row - b.row || (Math.abs(a.top - b.top) > 2 ? a.top - b.top : a.left - b.left));
  });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test.describe(`at ${viewport.width}`, () => {
    test.use({ viewport });

    test("jobs modal: Aaron's title and four paragraphs, each job's tag with its photo", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
      await expect(dialog.getByRole("heading", { name: 'The "unflattering" jobs that shaped me', exact: true })).toBeVisible();
      await expect(dialog.locator('[data-text-column] p[data-mask^="words-"]')).toHaveText(modal.blocks.map((block) => visibleText(block)));
      // The tags, down the page in reading order (Aaron, 2026-11-09): Aritzia's with its poster and UT Austin's beside the words, Apple's,
      // then MOD's with its clock-out and Popeyes' beside the words.
      const tags = (await pieces(dialog)).filter((piece) => piece.kind === "tag").map((piece) => piece.label);
      expect(tags).toEqual(["Aritzia", "Student mentor, UT Austin", "Apple", "MOD Pizza", "Popeyes"].map((employer) => tag.label(employer)));
      expect([...tags].sort()).toEqual([...tagLabels].sort());
      // The photos sit with their own job's tag, side by side: the poster beside Aritzia's, the badge beside Apple's, the clock-out beside
      // MOD's. The Keep MOD Weird selfie is gone.
      const all = await pieces(dialog);
      const at = (label: string) => all.find((piece) => piece.label === label)!;
      expect(modal.photos).toHaveLength(3);
      for (const photo of modal.photos) {
        const job = at(tag.label(timeline[photo.timeline!].employer));
        expect(at(photo.alt).row, `${photo.alt} sits with ${job.label}`).toBe(job.row);
        expect(Math.abs(at(photo.alt).top - job.top), `${photo.alt} beside ${job.label}`).toBeLessThan(2);
      }
      await expect(dialog.getByRole("img", { name: /Keep MOD Weird/ })).toHaveCount(0);
    });

    test("jobs modal: every tag shows its logo, its role as the big text (never my name), when, and the labelled tip, legibly with no hover", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      await page.mouse.move(2, 2);
      for (const [job, view] of jobTags.entries()) {
        const card = dialog.locator(`[data-job-tag="${job}"]`);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();
        await expect(card.locator("[data-job-tag-logo] img:visible")).toHaveCount(1);
        await expect(card.locator("[data-job-tag-name]")).toHaveCount(0);
        await expect(card).not.toContainText("Aaron");
        await expect(card.locator("[data-job-tag-role]")).toHaveText(view.role!);
        expect(await card.locator("[data-job-tag-role]").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), "the role is the big text").toBeGreaterThanOrEqual(20);
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

    test("jobs modal: the clusters alternate sides down the modal, each beside its paragraph, the photo-less jobs' tags beside the words", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      const rows = dialog.locator('[data-row="photo"]');
      await expect(rows).toHaveCount(4);
      const layout = await rows.evaluateAll((els) =>
        els.map((row) => {
          const slot = row.querySelector("[data-cluster]")!.getBoundingClientRect();
          const text = row.querySelector("[data-text-column]")!;
          return { side: row.getAttribute("data-side"), slot: { left: slot.left, right: slot.right }, text: { left: text.getBoundingClientRect().left, right: text.getBoundingClientRect().right }, words: text.querySelectorAll('[data-mask^="words-"]').length };
        }),
      );
      expect(layout.map((row) => row.side)).toEqual(["left", "right", "left", "right"]);
      layout.forEach((row, i) => {
        if (row.side === "left") expect(row.text.left, `row ${i}: words right of their media`).toBeGreaterThan(row.slot.right);
        else expect(row.text.right, `row ${i}: words left of their media`).toBeLessThan(row.slot.left);
      });
      // The four rows pair with the four paragraphs, one each.
      expect(layout.map((row) => row.words)).toEqual([1, 1, 1, 1]);
      const all = await pieces(dialog);
      expect(all).toHaveLength(modal.photos.length + timeline.length + 1);
      // The clusters alternate: a row's cluster is all on its side of the panel's middle, the next row's on the other, a cluster's two side by side.
      const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
      const middle = panel.x + panel.width / 2;
      layout.forEach((row, i) => {
        const cluster = all.filter((piece) => piece.row === i && piece.left >= row.slot.left - 1 && piece.right <= row.slot.right + 1);
        expect(cluster.length, `row ${i}'s cluster`).toBe(i === 3 ? 1 : 2);
        for (const piece of cluster) expect(row.side === "left" ? piece.right <= middle + 1 : piece.left >= middle - 1, `${piece.label} on the ${row.side}`).toBe(true);
        if (cluster.length === 2) expect(Math.abs(cluster[0].top - cluster[1].top), `row ${i}: side by side`).toBeLessThan(2);
      });
      // UT Austin's tag is beside the first paragraph with Aritzia's, Popeyes' beside the third with MOD's, each in the words column under the
      // words; the post stands alone beside the last.
      await expect(rows.nth(0).locator("[data-text-column] [data-aside] [data-job-tag]")).toHaveAttribute("aria-label", tag.label("Student mentor, UT Austin"));
      await expect(rows.nth(2).locator("[data-text-column] [data-aside] [data-job-tag]")).toHaveAttribute("aria-label", tag.label("Popeyes"));
      await expect(rows.nth(1).locator("[data-aside]")).toHaveCount(0);
      await expect(rows.nth(3).locator("[data-aside]")).toHaveCount(0);
      await expect(rows.nth(3).locator("[data-cluster] [data-post-frame] iframe")).toHaveCount(1);
    });

    test("jobs modal: the LinkedIn post is LinkedIn's short embed, lazy and titled, in a short frame with View on LinkedIn under it", async ({ page, offsite }) => {
      await page.goto("/");
      await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
      // Nothing is asked of LinkedIn before the modal opens.
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(offsite.filter((url) => url.includes("linkedin.com"))).toEqual([]);
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true, home: false });
      const post = dialog.locator('[data-cluster] [data-media="post"]');
      await expect(post).toHaveCount(1);
      await post.scrollIntoViewIfNeeded();
      // One frame: the collapsed embed (the post's text stops at a line and "...more"), lazy, named in my words. It is asked for once near.
      const frame = post.locator("[data-post-frame]");
      const iframe = frame.locator("iframe");
      await expect(iframe).toHaveCount(1);
      await expect(iframe).toHaveAttribute("src", embed.src);
      expect(embed.src).toMatch(/[?&]collapsed=1$/);
      await expect(iframe).toHaveAttribute("loading", "lazy");
      await expect(iframe).toHaveAttribute("title", embed.title);
      await expect.poll(() => offsite.filter((url) => url.startsWith(embed.src)).length).toBeGreaterThan(0);
      // Short: the post's width with its hairlines, the row's height (nowhere near the full post's 1258), filled by the frame.
      const box = (await frame.boundingBox())!;
      expect(Math.round(box.width), "the post's width with its hairlines").toBe(embed.width + 2);
      expect(Math.round(box.height), "the row's height").toBe(GALLERY.post.rowHeight + 2);
      const inner = (await iframe.boundingBox())!;
      expect(Math.round(inner.width)).toBe(embed.width);
      expect(Math.round(inner.height)).toBe(GALLERY.post.rowHeight);
      // View on LinkedIn right under the frame: one link, to the post's own address, in a new tab.
      const link = post.locator("[data-post-link]");
      await expect(post.locator("a")).toHaveCount(1);
      await expect(link).toContainText(embed.cta);
      await expect(link).toHaveAttribute("href", embed.href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      const way = (await link.boundingBox())!;
      expect(way.y, "View on LinkedIn under the frame").toBeGreaterThanOrEqual(box.y + box.height - 1);
      expect(way.y - (box.y + box.height), "right under it").toBeLessThan(24);
      // The photos' frame: the same radius as a photo's, a hairline around it, flat.
      const around = await frame.evaluate((el) => {
        const css = getComputedStyle(el);
        return { radius: css.borderTopLeftRadius, border: css.borderTopWidth, color: css.borderTopColor, shadow: css.boxShadow };
      });
      const photo = await dialog.getByRole("img", { name: modal.photos[0].alt, exact: true }).evaluate((el) => ({ radius: getComputedStyle(el.closest("[data-mask]") as HTMLElement).borderTopLeftRadius }));
      expect(around.radius).toBe(photo.radius);
      expect(around.border).toBe("1px");
      expect(around.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(around.shadow).toBe("none");
    });

    test("jobs modal: over the post's frame the site's cursor hands off to the native one, and comes back on the way out", async ({ page }) => {
      const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
      const frame = dialog.locator("[data-post-frame]");
      await frame.scrollIntoViewIfNeeded();
      const words = (await dialog.locator('[data-text-column] p[data-mask="words-3"]').boundingBox())!;
      const dot = page.locator("[data-cursor-dot]");
      await page.mouse.move(words.x + 20, words.y + 8, { steps: 4 });
      await expect(dot).toHaveAttribute("data-visible", "");
      // Into the frame: the dot hides, and the frame and its hairline show the native cursor, not the site's none.
      const box = (await frame.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      await expect(dot).not.toHaveAttribute("data-visible", "");
      expect(await frame.evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
      expect(await frame.locator("iframe").evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
      // Back out onto the words: the dot is back, at the live pointer.
      await page.mouse.move(words.x + 30, words.y + 10, { steps: 8 });
      await expect(dot).toHaveAttribute("data-visible", "");
      const at = await dot.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform));
      // The pointer lands on a whole pixel, so within one of where it was sent.
      expect(Math.abs(at.m41 - (words.x + 30))).toBeLessThanOrEqual(1);
      expect(Math.abs(at.m42 - (words.y + 10))).toBeLessThanOrEqual(1);
    });
  });
}

// What a phone's pager page holds, read off its markup: its stage (a photo or the post's frame) and the name tags under its words.
async function readPages(page: import("@playwright/test").Page) {
  return page.evaluate((gap) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-card-modal="jobs"]')!;
    const viewport = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.getBoundingClientRect();
    const room = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.clientHeight;
    const pages = [...dialog.querySelectorAll<HTMLElement>("[data-pager-page]")].map((el) => {
      const stage = el.querySelector<HTMLElement>("[data-pager-stage]");
      const text = el.querySelector<HTMLElement>("[data-pager-text]");
      return {
        kind: el.querySelector("[data-pager-stage] [data-post-frame]") ? "post" : "photo",
        stage: stage ? stage.offsetHeight : null,
        stageTop: stage ? stage.getBoundingClientRect().top : null,
        stageBottom: stage ? stage.getBoundingClientRect().bottom : null,
        textTop: text ? text.getBoundingClientRect().top : null,
        textBottom: text ? text.getBoundingClientRect().bottom : null,
        // Scrollers other than the words area (which may scroll).
        scrolled: [...el.querySelectorAll<HTMLElement>("*")].filter((node) => !node.hasAttribute("data-pager-text") && /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).length,
        stageTags: el.querySelectorAll("[data-pager-stage] [data-job-tag]").length,
        tags: [...el.querySelectorAll<HTMLElement>("[data-pager-text] [data-job-tag]")].map((tag) => Number(tag.dataset.jobTag)),
        photos: [...el.querySelectorAll<HTMLElement>("[data-pager-stage] [data-photo-frame]")].filter((frame) => !frame.querySelector("[data-post-frame]")).map((frame) => Number(frame.dataset.photoFrame)),
        paragraphs: [...el.querySelectorAll<HTMLElement>('[data-pager-text] p[data-mask^="words-"]')].map((p) => ({ unit: Number(p.dataset.mask!.slice(6)), text: p.textContent ?? "" })),
        gap,
      };
    });
    return { room, viewportBottom: viewport.bottom, pages };
  }, GALLERY.pager.pageGapPx);
}

// The jobs, newest first: Aritzia 0, Apple 1, UT Austin 2, MOD 3, Popeyes 4.
const JOBS_ON_PAGES = [[0, 2], [1], [3, 4], []];

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("jobs modal: at 390, one page a job: its photo, its whole paragraph, then its slim tags, the words scrolling where they run long", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
    // Aaron, 2026-11-09: "I want Aritzia to be one, I want Apple to be one, I want Mod to be one", then the post. No photo twice.
    const read = await readPages(page);
    expect(read.pages.map((p) => p.kind)).toEqual(["photo", "photo", "photo", "post"]);
    expect(read.pages.map((p) => p.photos)).toEqual([[0], [1], [2], []]);
    expect(read.pages.map((p) => p.tags), "each page's tags, under its words").toEqual(JOBS_ON_PAGES);
    expect(read.pages.every((p) => p.stageTags === 0), "no tag is a page's stage").toBe(true);
    await expect(dialog.locator("iframe")).toHaveCount(1);
    // Every word, once and in order: the phone drops no sentence (Aaron, 2026-11-09).
    const shown = read.pages.flatMap((p) => p.paragraphs);
    expect(shown.map((p) => p.unit)).toEqual([0, 1, 2, 3]);
    expect(shown.map((p) => p.text)).toEqual(modal.blocks.map((block) => visibleText(block)));
    read.pages.forEach((p, i) => {
      expect(p.scrolled, `page ${i + 1}: nothing but its words scrolls`).toBe(0);
      if (p.stageBottom !== null) expect(p.stageBottom, `page ${i + 1}: its stage ends inside the pages`).toBeLessThanOrEqual(read.viewportBottom + 1);
      if (p.textBottom !== null) expect(p.textBottom, `page ${i + 1}: its words area ends inside the pages`).toBeLessThanOrEqual(read.viewportBottom + 1);
    });
    // The post's page: its paragraph first, the post under it.
    const post = read.pages[3];
    expect(post.stageTop!, "the post under its paragraph").toBeGreaterThanOrEqual(post.textBottom! - 1);
    // The title is three lines or fewer: it stepped down from four.
    const title = await dialog.locator("[data-pager] h2").evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
    expect(Math.round(title.height / title.line), "lines in the title").toBeLessThanOrEqual(3);
  });

  test("jobs modal: at 390 a slim tag is the logo, the role big, the years and Hear more about this one, which opens the tip in place", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
    const next = dialog.getByRole("button", { name: siteContent.modals.gallery.nextPage, exact: true });
    await next.click();
    await page.waitForTimeout(450);
    const apple = dialog.locator('[data-pager-page="1"] [data-job-tag="1"]');
    await expect(apple).toHaveAttribute("data-job-tag-fold", "");
    await expect(apple.locator("[data-job-tag-logo] img:visible")).toHaveCount(1);
    await expect(apple.locator("[data-job-tag-role]")).toHaveText(jobTags[1].role!);
    await expect(apple.locator("[data-job-tag-when]")).toHaveText(jobTags[1].when);
    await expect(apple).not.toContainText("Aaron");
    // Slim: the logo's band is shorter than a desktop tag's, and the whole closed tag is short.
    const band = (await apple.locator("[data-job-tag-logo]").boundingBox())!;
    expect(band.height).toBeLessThanOrEqual(36);
    // The dropdown: closed, then open on a tap, the tip under the tag and in view in the page's words; then closed again.
    const more = apple.locator("[data-job-tag-more]");
    await expect(more).toHaveText(tag.more);
    await expect(more).toHaveAttribute("aria-expanded", "false");
    const tip = dialog.locator('[data-pager-page="1"] [data-job-tag-tip]');
    await expect(tip).toBeHidden();
    await more.scrollIntoViewIfNeeded();
    await more.tap();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(jobTags[1].tip);
    const area = (await dialog.locator('[data-pager-page="1"] [data-pager-text]').boundingBox())!;
    await expect.poll(async () => (await tip.boundingBox())!.y + (await tip.boundingBox())!.height, { message: "the tip scrolled into view" }).toBeLessThanOrEqual(area.y + area.height + 1);
    expect((await tip.boundingBox())!.y, "under its tag").toBeGreaterThanOrEqual((await apple.boundingBox())!.y + (await apple.boundingBox())!.height - 1);
    await more.tap();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(tip).toBeHidden();
  });

  test("jobs modal: at 390 every page is within the panel, the controls too, and the post's frame fits its column with View on LinkedIn under it", async ({ page }) => {
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
      const controls = (await dialog.locator("[data-pager-controls]").boundingBox())!;
      const panelBox = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
      expect(controls.x + controls.width, `page ${i + 1}: controls inside the panel`).toBeLessThanOrEqual(panelBox.x + panelBox.width);
      if (i < count - 1) {
        await next.click();
        await page.waitForTimeout(450);
      }
    }
    // The post's page (the last): LinkedIn's short embed under its paragraph, as wide as the column at most, pageMin with its photos whole at
    // 844, with the photos' radius and a hairline, then View on LinkedIn under it, the post's only link on the page.
    const post = dialog.locator('[data-pager-page="3"] [data-media="post"]');
    const frame = post.locator("[data-post-frame]");
    await expect(frame.locator("iframe")).toHaveAttribute("src", modal.embed!.src);
    const column = (await dialog.locator("[data-pager-viewport]").boundingBox())!;
    const box = (await frame.boundingBox())!;
    expect(box.x, "inside the column").toBeGreaterThanOrEqual(column.x - 1);
    expect(box.x + box.width, "inside the column").toBeLessThanOrEqual(column.x + column.width + 1);
    expect(Math.round((await post.boundingBox())!.height), "the post at pageMin, its photos whole").toBe(GALLERY.post.pageMin);
    const words = (await dialog.locator('[data-pager-page="3"] [data-pager-text]').boundingBox())!;
    expect(box.y, "the post under its paragraph").toBeGreaterThanOrEqual(words.y + words.height - 1);
    const link = post.locator("[data-post-link]");
    await expect(link).toHaveAttribute("href", modal.links[0].href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toContainText(modal.embed!.cta);
    expect((await link.boundingBox())!.y, "under the frame").toBeGreaterThanOrEqual(box.y + box.height - 1);
    await expect(dialog.getByRole("link", { name: /The LinkedIn post/ }), "the link under the frame is the way in: the label link is not drawn beside it").toHaveCount(0);
    const look = await frame.evaluate((el) => {
      const style = getComputedStyle(el);
      return { radius: parseFloat(style.borderTopLeftRadius), border: parseFloat(style.borderTopWidth), shadow: style.boxShadow };
    });
    expect(look.radius, "the photos' radius").toBeGreaterThan(8);
    expect(look.border).toBe(1);
    expect(look.shadow, "flat: no shadow").toBe("none");
  });

  // Safari's 664px tall window: still one page a job, every word kept (the words scroll), and the post shows only its head and line, never
  // a frame that cuts through its photos.
  test.describe("at 664 tall", () => {
    test.use({ viewport: { width: 390, height: 664 } });
    test("jobs modal: on a short phone, still one page a job with every word, and the post as its head and line", async ({ page }) => {
      await openCardFromBook(page, "jobs", { settled: true });
      const read = await readPages(page);
      expect(read.room, "the pages' room is short").toBeLessThan(440);
      expect(read.pages.map((p) => p.tags)).toEqual(JOBS_ON_PAGES);
      read.pages.forEach((p, i) => {
        expect(p.scrolled, `page ${i + 1}: nothing but its words scrolls`).toBe(0);
        if (p.stage !== null) expect(p.stage, `page ${i + 1}: its stage fits the room`).toBeLessThanOrEqual(read.room + 1);
      });
      expect(read.pages.flatMap((p) => p.paragraphs).map((p) => p.text)).toEqual(modal.blocks.map((block) => visibleText(block)));
      expect(read.pages[3].stage, "the post's teaser").toBe(GALLERY.post.teaser);
    });
  });
});

test("jobs modal: the pager's page size does not change what the desktop keeps: nine pieces of media, four paragraphs, one link", async () => {
  expect(GALLERY.cluster.itemWidth * 2 + GALLERY.cluster.gap, "a pair is as wide as the post").toBe(modal.embed!.width);
  expect(modal.photos.length + timeline.length + 1).toBe(9);
  expect(modal.blocks).toHaveLength(4);
  expect(modal.links).toHaveLength(1);
});
