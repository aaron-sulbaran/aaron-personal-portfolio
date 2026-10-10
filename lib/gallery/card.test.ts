import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { parseInlineLinks, visibleText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { galleryOf, headerMeta, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { slideWords } from "@/lib/gallery/plan";
import { employerSource } from "@/lib/gallery/timeline";

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
      "min-max": [],
      band: [{ photos: [0], words: [0] }, { photos: [2, 1], words: [1] }, { photos: [3], words: [2] }],
      talos: [],
      travel: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      "capital-one": [{ photos: [0], words: [1] }, { photos: [1], words: [2] }, { photos: [2], words: [3] }],
      hackathons: [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }],
      anthropic: [{ photos: [0], words: [0] }, { photos: [1, 2], words: [1] }],
      misuki: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      ieee: [{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }, { photos: [2], words: [4] }],
      jobs: [{ photos: [0, 1], words: [4, 5] }, { photos: [2], words: [6] }, { photos: [3], words: [7] }],
      "this-site": [],
      fsdatalink: [],
      "building-in-public": [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }],
    });
    expect(Object.fromEntries(keys.map((key) => [key, [galleryOf(key).plan.intro, galleryOf(key).plan.closing]]))).toMatchObject({
      "capital-one": [[0], [4]], hackathons: [[], [3]], jobs: [[0, 1, 2, 3], []], "min-max": [[0], []], talos: [[0, 1], []], "this-site": [[0], []], fsdatalink: [[0, 1], []], band: [[], []], travel: [[], []],
    });
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

  it("reads the jobs card's words as its three paragraphs, then its five entries", () => {
    expect(galleryOf("jobs").words).toEqual([
      { kind: "block", index: 0 }, { kind: "block", index: 1 }, { kind: "block", index: 2 },
      { kind: "entry", index: 0 }, { kind: "entry", index: 1 }, { kind: "entry", index: 2 }, { kind: "entry", index: 3 }, { kind: "entry", index: 4 },
    ]);
    expect(galleryOf("jobs").photos.map((photo) => photo.beside)).toEqual([4, 4, 6, 7]);
  });

  it("sizes each panel to its widest box: 918 all vertical, 1022 with a horizontal photo, 542 with none", () => {
    expect(Object.fromEntries(keys.map((key) => [key, galleryOf(key).panelWidth]))).toEqual({
      mentorship: 1022, "min-max": 542, band: 1022, talos: 542, travel: 918, "capital-one": 918, hackathons: 1022,
      anthropic: 1022, misuki: 1022, ieee: 1022, jobs: 918, "this-site": 542, fsdatalink: 542, "building-in-public": 1022,
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

describe("the timeline's employers", () => {
  it("are inline tips on their own words", () => {
    expect(siteContent.cards.jobs.timeline.map((_, i) => employerSource(i))).toEqual([
      "[Popeyes](tip:job-0)", "[MOD Pizza](tip:job-1)", "[Student mentor, UT Austin](tip:job-2)", "[Apple](tip:job-3)", "[Aritzia](tip:job-4)",
    ]);
    for (let i = 0; i < 5; i++) {
      expect(parseInlineLinks(employerSource(i), registerHas).unknown).toEqual([]);
      expect(visibleText(employerSource(i))).toBe(siteContent.cards.jobs.timeline[i].employer);
    }
  });
});
