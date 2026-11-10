import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { phoneFocus } from "@/lib/content/media";
import { galleryOf, headerMeta, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages, slideWords } from "@/lib/gallery/plan";

const keys = Object.keys(siteContent.cards) as CardKey[];
const rows = (key: CardKey) => galleryOf(key).plan.slides.map((slide) => ({ photos: slide.photos, words: slideWords(slide) }));

describe("each card's gallery", () => {
  it("leads a photo card with its captioned card picture", () => {
    expect(keys.filter((key) => galleryOf(key).lead === 0)).toEqual(["mentorship", "band", "travel", "hackathons", "misuki", "building-in-public"]);
    const mentorship = galleryOf("mentorship");
    expect(mentorship.photos[0]).toMatchObject({ src: "/photos/cards/mentorship-picture.jpg", width: 1200, height: 1600, caption: "Me speaking at my first HSF STEM Summit." });
    expect(mentorship.photos.map((photo) => photo.caption)).toEqual([
      "Me speaking at my first HSF STEM Summit.",
      "Me at my second HSF, this time as a mentor.",
      "Me at HSF my first year, as a scholar.",
      "Me at my first SHPE national convention, 2023. I've been to every one since.",
    ]);
    expect(galleryOf("misuki").photos[3].captionShort).toBe("The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima.");
  });

  it("sits every photo beside the words Aaron's rule gives it, and the band's and Travel's the same, the card picture holding the first word", () => {
    expect(Object.fromEntries(keys.map((key) => [key, rows(key)]))).toEqual({
      mentorship: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      "min-max": [{ photos: [0], words: [0] }],
      band: [{ photos: [0], words: [0] }, { photos: [2, 1], words: [1] }, { photos: [3], words: [2] }],
      talos: [],
      travel: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      "capital-one": [{ photos: [0], words: [1] }, { photos: [1], words: [2] }, { photos: [2], words: [3] }],
      hackathons: [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [4], words: [2] }, { photos: [2], words: [3] }, { photos: [3], words: [4] }],
      anthropic: [{ photos: [0], words: [0] }, { photos: [1, 2], words: [1] }],
      misuki: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      ieee: [{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }, { photos: [2], words: [4] }],
      // Photos 0 to 2 (Aritzia, Apple, MOD), tags 3 to 7 (Aritzia to Popeyes), the post 8: a job's tag and photo a row, one row a paragraph,
      // UT Austin's and Popeyes' tags beside the words (lib/gallery/jobs).
      jobs: [{ photos: [3, 0], words: [0] }, { photos: [4, 1], words: [1] }, { photos: [6, 2], words: [2] }, { photos: [8], words: [3] }],
      "this-site": [],
      fsdatalink: [],
      "building-in-public": [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }],
    });
    expect(Object.fromEntries(keys.map((key) => [key, [galleryOf(key).plan.intro, galleryOf(key).plan.closing]]))).toMatchObject({
      "capital-one": [[0], [4]], hackathons: [[], []], jobs: [[], []], "min-max": [[], []], talos: [[0, 1], []], "this-site": [[0], []], fsdatalink: [[0, 1], []], band: [[], []], travel: [[], []],
    });
  });

  it("draws the Hackathons card's demo video as media in the photos' 4:3 frame, beside its own paragraph, each piece of media a row of its own", () => {
    const { photos, plan, words, aspects } = galleryOf("hackathons");
    const video = siteContent.cards.hackathons.modal.video!;
    const index = photos.findIndex((photo) => photo.video);
    expect(index, "the video is the last of the card's media").toBe(photos.length - 1);
    expect(photos[index]).toMatchObject({ alt: video.label, caption: null, beside: video.beside, video: { src: video.src, poster: video.poster, width: video.width, height: video.height } });
    expect(aspects[index], "in the 4:3 frame, whatever the file's own shape").toBeCloseTo(4 / 3, 6);
    expect(photos.filter((photo) => photo.video)).toHaveLength(1);
    // One media a row, in the order of the paragraphs they sit beside: UFCU picture, AWS photo, HackTX video, Hook 'Em photo, Vercel photo.
    expect(plan.slides.map((slide) => slide.photos)).toEqual([[0], [1], [index], [2], [3]]);
    expect(plan.slides.map((slide) => slide.own)).toEqual(words.map((_, unit) => unit));
    expect(plan.slides[2].own, "beside the HackTX paragraph").toBe(video.beside);
    // Every row alternates sides from the left (components/card/CardRows), so no two consecutive media share one.
    expect(plan.slides.map((_, i) => (i % 2 === 0 ? "left" : "right"))).toEqual(["left", "right", "left", "right", "left"]);
  });

  it("draws the min/Max card's answer clip as its one piece of media, beside its paragraph, captioned, on a phone's page and a desktop row alike", () => {
    const { photos, plan, pages } = galleryOf("min-max");
    const video = siteContent.cards["min-max"].modal.video!;
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ alt: video.label, caption: video.caption, beside: 0, video: { src: video.src, poster: video.poster, width: 1280, height: 720, playOnce: true } });
    expect(plan.slides.map((slide) => ({ photos: slide.photos, own: slide.own }))).toEqual([{ photos: [0], own: 0 }]);
    // One page: the clip and the paragraph together (the pager's photo-and-words rule), the card's link after them.
    expect(pages).toEqual([{ photo: 0, photos: [0], own: 0, before: [], after: [], links: true }]);
  });

  it("plays only the min/Max clip by itself, once: the Hackathons demo stays on demand", () => {
    expect(galleryOf("min-max").photos[0].video?.playOnce).toBe(true);
    expect(galleryOf("hackathons").photos.find((photo) => photo.video)?.video).not.toHaveProperty("playOnce");
  });

  it("gives every photo row of every card a word, the card picture never taking turns, unless the card has no word to give", () => {
    for (const key of keys) {
      const { plan, words, lead } = galleryOf(key);
      for (const slide of plan.slides) {
        if (words.length > 0) expect(slideWords(slide).length, `${key}: row of photo ${slide.photo}`).toBeGreaterThan(0);
        if (lead !== undefined && slide.photos.includes(lead)) expect(slide.photos, `${key}: the card picture`).toEqual([lead]);
      }
    }
  });

  it("reads the jobs card's words as its four paragraphs alone, the tips being name tags among its media", () => {
    expect(galleryOf("jobs").words).toEqual([{ kind: "block", index: 0 }, { kind: "block", index: 1 }, { kind: "block", index: 2 }, { kind: "block", index: 3 }]);
  });

  it("lays the jobs card out as clusters beside its paragraphs, newest first, every photo and tag once and the post beside the last paragraph", () => {
    const { photos, plan, boxes } = galleryOf("jobs");
    const { modal, timeline } = siteContent.cards.jobs;
    // Media in order: the three photos, one tag a job (Aritzia to Popeyes), then the post.
    expect(photos).toHaveLength(modal.photos.length + timeline.length + 1);
    expect(photos.slice(0, 3).map((photo) => photo.caption)).toEqual(modal.photos.map((photo) => photo.caption));
    expect(photos.slice(3, 8).map((photo) => photo.tag)).toEqual([0, 1, 2, 3, 4]);
    expect(photos[8].embed).toEqual({ src: modal.embed!.src, width: 504, height: GALLERY.post.rowHeight, title: "My LinkedIn post about unflattering jobs", href: modal.embed!.href, cta: "View on LinkedIn" });
    expect(photos[8].src, "the post's own address").toBe(modal.embed!.href);
    expect(photos.filter((photo) => photo.tag !== undefined || photo.embed).every((photo) => photo.caption === null)).toBe(true);
    // Every piece is in exactly one place, in a cluster or beside the words.
    const placed = plan.slides.flatMap((slide) => [...slide.photos, ...(slide.aside ?? [])]);
    expect([...placed].sort((a, b) => a - b)).toEqual(photos.map((_, i) => i));
    expect(plan.slides.every((slide) => slide.together)).toBe(true);
    // The four rows pair with the four paragraphs in order, newest first (Aaron, 2026-11-09): each job with a photo is its tag and that
    // photo, the two with none ride beside the words (UT Austin with Aritzia, Popeyes with MOD), and the post is on its own.
    expect(plan.slides.map((slide) => slide.own)).toEqual([0, 1, 2, 3]);
    const tagged = (list: readonly number[] | undefined) => (list ?? []).map((photo) => photos[photo].tag ?? `photo ${photo}`);
    expect(plan.slides.map((slide) => tagged(slide.photos))).toEqual([[0, "photo 0"], [1, "photo 1"], [3, "photo 2"], ["photo 8"]]);
    expect(plan.slides.map((slide) => tagged(slide.aside))).toEqual([[2], [], [4], []]);
    expect(plan.slides[2].photos[1], "MOD's last clock-out").toBe(modal.photos.findIndex((photo) => photo.timeline === 3));
    expect(photos[plan.slides[3].photos[0]].embed, "the post").toBeDefined();
    expect(plan.slides[3].own).toBe(modal.embed!.beside);
    // A cluster is a pair at the clusters' width; the post is at its native width plus its frame's hairline.
    expect(plan.slides.map((slide) => slide.photos.length)).toEqual([2, 2, 2, 1]);
    expect(boxes![3]).toEqual({ width: GALLERY.cluster.itemWidth, height: GALLERY.cluster.tagHeight });
    // Every photo is whole in a box of its own shape at the cluster's width: the 3:4 ones come to 3:4, the poster (998 by 1600) is taller.
    modal.photos.forEach((photo, i) => {
      expect(boxes![i].width).toBe(GALLERY.cluster.itemWidth);
      expect(boxes![i].height / boxes![i].width).toBeCloseTo(photo.height / photo.width, 6);
    });
    expect(boxes![1]).toEqual({ width: GALLERY.cluster.itemWidth, height: (GALLERY.cluster.itemWidth * 4) / 3 });
    // The post's frame and its hairlines.
    expect(boxes![8]).toEqual({ width: 506, height: GALLERY.post.rowHeight + 2 });
    // The rows alternate sides from the left (components/card/CardRows), so no cluster sits under another.
    expect(plan.slides.map((_, i) => (i % 2 === 0 ? "left" : "right"))).toEqual(["left", "right", "left", "right"]);
  });

  it("sets the jobs card's phone pages as photo, paragraph, then that job's name tags under it: no tag a page of its own", () => {
    const gallery = galleryOf("jobs");
    expect(gallery.grouping).toBe("paragraph");
    const { pages, photos } = gallery;
    // One page a job (Aaron, 2026-11-09): the poster, the first paragraph, Aritzia's and UT Austin's tags; the badge, the second, Apple's tag;
    // MOD's last clock-out, the third, MOD's and Popeyes' tags; the last paragraph and the post. A page's words scroll when they do not fit.
    expect(pages.map((page) => page.photos)).toEqual([[0], [1], [2], [8]]);
    expect(pages.map((page) => slideWords(page))).toEqual([[0], [1], [2], [3]]);
    expect(pages.map((page) => page.tags)).toEqual([[3, 5], [4], [6, 7], undefined]);
    expect(pages.some((page) => page.wordless), "no page without words").toBe(false);
    expect(pages.map((page) => page.links)).toEqual([false, false, false, true]);
    expect(pages.every((page) => !page.together && !page.aside)).toBe(true);
    // Every piece of media once, on a stage or as a tag.
    expect(pages.flatMap((page) => [...page.photos, ...(page.tags ?? [])]).sort((a, b) => a - b)).toEqual(photos.map((_, i) => i));
    for (const key of keys) expect(galleryOf(key).grouping, key).toBe(PHONE_GROUPING);
    for (const key of keys.filter((candidate) => candidate !== "jobs")) expect(galleryOf(key).pages, key).toEqual(phonePages(galleryOf(key).plan, PHONE_GROUPING));
  });

  it("knows where each tall photo's subject is, so a phone page that crops it keeps the subject in view", () => {
    const focused = keys.flatMap((key) => galleryOf(key).photos.filter((photo) => photo.focus !== undefined));
    expect(focused.length).toBeGreaterThan(15);
    for (const photo of focused) expect(photo.focus!, photo.src).toBeGreaterThanOrEqual(0);
    for (const photo of focused) expect(photo.focus!, photo.src).toBeLessThanOrEqual(1);
    expect(galleryOf("capital-one").photos[0].focus).toBe(0.4);
    const sources = new Set(keys.flatMap((key) => galleryOf(key).photos.map((photo) => photo.src)));
    expect(Object.keys(phoneFocus).filter((src) => !sources.has(src)), "every focus names a photo the modals show").toEqual([]);
  });

  it("sizes each panel to its widest box: 918 all vertical, 1022 with a horizontal photo, 542 with none, 1104 for the jobs card's clusters and post", () => {
    expect(Object.fromEntries(keys.map((key) => [key, galleryOf(key).panelWidth]))).toEqual({
      mentorship: 1022, "min-max": 1022, band: 1022, talos: 542, travel: 918, "capital-one": 918, hackathons: 1022,
      anthropic: 1022, misuki: 1022, ieee: 1022, jobs: 1104, "this-site": 542, fsdatalink: 542, "building-in-public": 1022,
    });
  });

  it("holds the lab's round six values", () => {
    expect(GALLERY).toMatchObject({ wideQuery: "(min-width: 1024px)", verticalWidth: 320, horizontalWidth: 424, wideFrom: 1, textWidth: 460, rowGap: 64, columnGap: 56 });
    expect(GALLERY.rotate).toMatchObject({ intervalMs: 3000, changeMs: 640, delayMs: 1200, captionOut: 0.5, captionInAt: 0.25, marksInsetPx: 8, tapPx: 10, holdMs: 500 });
    expect(GALLERY.mask).toEqual({ landingMs: 520, lengthMs: 480, staggerMs: 110, lineStaggerMs: 45, settle: 1.02 });
    expect(GALLERY.pager).toMatchObject({ stageMax: 0.4, slideMs: 360, flickPx: 96, sheetInsetPx: 48 });
    expect([GALLERY.direction, GALLERY.headerTile, GALLERY.headerTileCompact]).toEqual(["ltr", { width: 60, height: 80 }, { width: 42, height: 56 }]);
    expect([GALLERY.talosTileCompact, GALLERY.talosMarkMinPx]).toEqual([{ width: 51, height: 68 }, 20]);
    expect(PHONE_GROUPING).toBe("paragraph");
  });

  it("gives the header a 3:4 tile, and Talos's on a phone room for its kit's 20px mark", () => {
    for (const key of keys) for (const compact of [false, true]) expect(headerTileOf(key, compact).width / headerTileOf(key, compact).height, key).toBeCloseTo(0.75, 9);
    expect([headerTileOf("talos", false), headerTileOf("talos", true), headerTileOf("capital-one", true)]).toEqual([{ width: 60, height: 80 }, { width: 51, height: 68 }, { width: 42, height: 56 }]);
  });

  it("keeps IEEE's AO tip in the modal beside the rows, and the shorter meta on a phone", () => {
    expect(headerMeta("ieee", false)).toBe("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026");
    expect(headerMeta("ieee", true)).toBe("President, 2023 to 2026");
    expect(keys.filter((key) => headerMeta(key, false) !== headerMeta(key, true))).toEqual(["ieee"]);
    expect([headerMeta("band", false), headerMeta("this-site", false), headerMeta("anthropic", true)]).toEqual(["Drum major, 2021 to 2023", "Portfolio, 2026", "Claude Campus Ambassador, 2026"]);
  });
});
