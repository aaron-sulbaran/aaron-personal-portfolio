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
      .sort((a, b) => a.row - b.row || a.left - b.left);
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
      // The photos follow their own job: the Aritzia poster beside Aritzia's tag, the badge beside Apple's, the MOD pair after MOD's tag.
      const all = await pieces(dialog);
      const rowOf = (label: string) => all.find((piece) => piece.label === label)!.row;
      for (const photo of modal.photos) {
        const job = tag.label(timeline[photo.timeline!].employer);
        if (photo.timeline === 3) expect(rowOf(photo.alt), `${photo.alt} follows MOD's tag`).toBe(rowOf(job) + 1);
        else expect(rowOf(photo.alt), `${photo.alt} sits with ${job}`).toBe(rowOf(job));
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
      await expect(rows).toHaveCount(5);
      const layout = await rows.evaluateAll((els) =>
        els.map((row) => {
          const media = [...row.querySelectorAll("[data-photo-frame]")].map((frame) => frame.getBoundingClientRect());
          const slot = row.querySelector("[data-cluster]")!.getBoundingClientRect();
          const text = row.querySelector("[data-text-column]")!;
          return { side: row.getAttribute("data-side"), slot: { left: slot.left, right: slot.right }, text: { left: text.getBoundingClientRect().left, right: text.getBoundingClientRect().right }, words: text.querySelectorAll('[data-mask^="words-"]').length, media: media.length };
        }),
      );
      expect(layout.map((row) => row.side)).toEqual(["left", "right", "left", "right", "left"]);
      layout.forEach((row, i) => {
        if (row.side === "left") expect(row.text.left, `row ${i}: words right of their media`).toBeGreaterThan(row.slot.right);
        else expect(row.text.right, `row ${i}: words left of their media`).toBeLessThan(row.slot.left);
      });
      // Paragraphs one to four beside the clusters of rows one, two, three and five; row four (MOD's two photos) has none.
      expect(layout.map((row) => row.words)).toEqual([1, 1, 1, 0, 1]);
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
      const last = rows.nth(4);
      await expect(last.locator("[data-text-column] [data-aside] [data-job-tag]")).toHaveAttribute("aria-label", tag.label("Popeyes"));
      await expect(last.locator("[data-cluster] iframe")).toHaveCount(1);
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

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("jobs modal: at 390 the pager gives each tag, photo and the post a page, with no sideways overflow anywhere", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
    const pages = dialog.locator("[data-pager-page]");
    await expect(pages).toHaveCount(10);
    // Tags flow in the pager like photos: Aritzia's tag with the first paragraph, then its poster, and so on; the post's page, then Popeyes' tag.
    const kinds = await pages.evaluateAll((els) => els.map((el) => (el.querySelector("[data-job-tag]") ? "tag" : el.querySelector("iframe") ? "embed" : "photo")));
    expect(kinds).toEqual(["tag", "photo", "tag", "photo", "tag", "tag", "photo", "photo", "embed", "tag"]);
    const next = dialog.getByRole("button", { name: siteContent.modals.gallery.nextPage, exact: true });
    for (let i = 0; i < 10; i++) {
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
      if (i < 9) {
        await next.click();
        await page.waitForTimeout(450);
      }
    }
    // On the post's page the frame fills the column and keeps its native height inside a stage that scrolls; it is never shrunk.
    await dialog.locator('[data-pager-dot="8"]').click();
    await page.waitForTimeout(450);
    const frame = dialog.locator('[data-pager-page="8"] iframe');
    const stage = dialog.locator('[data-pager-page="8"] [data-embed-stage]');
    const column = (await stage.boundingBox())!;
    const drawn = (await frame.boundingBox())!;
    expect(drawn.width, "fills the column, no wider").toBeLessThanOrEqual(column.width + 0.5);
    expect(drawn.width, "fills the column").toBeGreaterThan(column.width - 4);
    expect(Math.round(drawn.height), "its native height").toBe(1258);
    expect(await stage.evaluate((el) => el.scrollHeight > el.clientHeight + 100), "the stage scrolls it").toBe(true);
    await expect(dialog.locator('[data-pager-page="8"]')).toContainText("I wrote about my work experience outside of class on LinkedIn");
    await expect(dialog.locator('[data-pager-page="8"]').getByRole("link", { name: /The LinkedIn post/ })).toBeVisible();
  });
});

test("jobs modal: the pager's page size does not change what the desktop keeps: ten pieces of media, four paragraphs, one link", async () => {
  expect(GALLERY.cluster.itemWidth * 2 + GALLERY.cluster.gap, "a pair is as wide as the post").toBe(embed.width);
  expect(modal.photos.length + timeline.length + 1).toBe(10);
  expect(modal.blocks).toHaveLength(4);
  expect(modal.links).toHaveLength(1);
});
