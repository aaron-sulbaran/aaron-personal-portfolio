import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { arcAtY, sampleSpine } from "./geometry";
import { bandLineY, runLength } from "./head";
import { BAND_CLEAR_EXTRA, RUN_START, SAMPLE_STEP } from "./constants";
import { dotReach } from "./columns";
import { amplitudeFor } from "./visible";
import { SIGNATURE_ON, SIGNATURE_PHONE, composePoints, resolveSpine, signatureFor, type Anchors } from "./spine";

// The fixture is measured from the real page (measureAnchors at 1440x900,
// 1024x768 and 390x844).
const a1440 = pages["1440x900"].anchors as Anchors;

describe("the line", () => {
  it("is the always-on Signature line, its gutters keeping clear of the words beside them", () => {
    expect(SIGNATURE_ON).toEqual([
      { at: "band", y: 0.35, x: 1.06, box: true }, { at: "band", y: 0.75, x: 1.06, box: true },
      { at: "gap0", y: 0.2, x: 0.955, keep: "right" }, { at: "gap0", y: 0.8, x: 0.955, keep: "right" },
      { at: "cards", y: 0.05, x: 0.75 }, { at: "cards", y: 0.95, x: 0.45 },
      { at: "numbers", y: 0.1, x: 0.955, keep: "right" }, { at: "numbers", y: 1, x: 0.955, keep: "right" },
      { at: "connect", y: 0.2, x: 0.955, keep: "right" }, { at: "connect", y: 0.8, x: 0.955, keep: "right" },
      { at: "footer", y: 0.4, x: 1.12, box: true }, { at: "footer", y: 0.8, x: 1.12, box: true },
    ]);
  });
  it("is the same line on a phone but for two bays across the clear air: between the numbers and Connect, and under Connect's links", () => {
    expect(signatureFor(390)).toBe(SIGNATURE_PHONE);
    expect(signatureFor(768)).toBe(SIGNATURE_ON);
    expect(SIGNATURE_PHONE.filter((p) => p.at === "gap2")).toEqual([
      { at: "gap2", y: 0.15, x: 1.2 }, { at: "gap2", y: 0.5, x: 0.3 }, { at: "gap2", y: 0.85, x: 1.2 },
    ]);
    expect(SIGNATURE_PHONE.filter((p) => p.at === "gap3")).toEqual([
      { at: "gap3", y: 0.35, x: 1.2 }, { at: "gap3", y: 0.5, x: 0.4 }, { at: "gap3", y: 0.65, x: 1.2 },
    ]);
    expect(SIGNATURE_PHONE.filter((p) => p.at !== "gap2" && p.at !== "gap3")).toEqual(SIGNATURE_ON);
  });
  it("starts as a level run on the band's measured line, from 24px past the left edge", () => {
    const points = resolveSpine({ points: SIGNATURE_ON }, { ...a1440, line: 135 }, { bandRun: true, viewport: 900 });
    expect(points[0]).toEqual({ x: RUN_START, y: 135 });
    const samples = sampleSpine(points, SAMPLE_STEP);
    const run = runLength(samples, 1440);
    expect(Math.abs(run - (1440 - 1 - RUN_START))).toBeLessThanOrEqual(SAMPLE_STEP);
    for (let i = 0; i * SAMPLE_STEP < run; i++) expect(Math.abs(samples.y[i] - 135)).toBeLessThan(0.5);
  });
  it("reads the measured band line, else the lab's formula", () => {
    expect(bandLineY({ ...a1440, line: 200 }, 900)).toBe(200);
    expect(bandLineY(a1440, 900)).toBe(a1440.words.band.top - 20 + 270 / 2);
  });
  it("arc length never goes back as the page goes down", () => {
    const samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, a1440, { bandRun: true, viewport: 900 }), SAMPLE_STEP);
    let last = 0;
    for (let y = 0; y < a1440.box.footer.bottom; y += 37) {
      const s = arcAtY(samples, y);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});

describe("the route through the new page", () => {
  const sizes = Object.keys(pages) as (keyof typeof pages)[];
  const samplesFor = (size: keyof typeof pages) => {
    const { anchors, viewport } = pages[size] as { anchors: Anchors; viewport: number };
    const clearBand = dotReach(amplitudeFor(anchors.width)) + BAND_CLEAR_EXTRA;
    return { anchors, samples: sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport, clearBand }), SAMPLE_STEP) };
  };
  const between = (samples: ReturnType<typeof samplesFor>["samples"], from: number, to: number) => {
    const xs: number[] = [];
    for (let i = 0; i < samples.count; i++) if (samples.y[i] > from && samples.y[i] < to) xs.push(samples.x[i]);
    return xs;
  };

  it.each(sizes)("stays beside the fork, down the right side of the page, after the band at %s", (size) => {
    const { anchors, samples } = samplesFor(size);
    const xs = between(samples, anchors.box.band.bottom + 120, anchors.box.cards.top - 40);
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) expect(x).toBeGreaterThan(anchors.width * 0.8);
  });

  it.each(sizes)("dives into the cards section on the right and comes out of its bottom edge heading left at %s", (size) => {
    const { anchors, samples } = samplesFor(size);
    const inside = between(samples, anchors.box.cards.top + 40, anchors.box.cards.bottom - 40);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside[0]).toBeGreaterThan(anchors.width * 0.6);
    expect(inside.at(-1)!).toBeLessThan(anchors.width * 0.6);
    expect(inside.at(-1)!).toBeGreaterThan(anchors.width * 0.2);
  });

  it.each(sizes)("keeps the cards section free of words, so its box is its span at %s", (size) => {
    const { anchors } = samplesFor(size);
    expect(anchors.words.cards).toEqual(anchors.box.cards);
  });
});

describe("a gutter keeps clear of the words and links beside it", () => {
  // A page 400 wide: one section's words down the page, so the gutter's stretch (gap0, from the band's words to the cards') passes them.
  const page = (right: number, links: Anchors["links"] = []): Anchors => ({
    width: 400,
    box: { band: { top: 0, bottom: 100 }, cards: { top: 600, bottom: 700 }, numbers: { top: 700, bottom: 800 }, connect: { top: 800, bottom: 900 }, footer: { top: 900, bottom: 1000 } },
    words: { band: { top: 0, bottom: 100 }, cards: { top: 600, bottom: 700 }, numbers: { top: 700, bottom: 800 }, connect: { top: 800, bottom: 900 }, footer: { top: 900, bottom: 1000 } },
    blocks: [{ left: 20, right: right, top: 150, bottom: 550 }], headings: [], links, hairlines: [],
  });
  const gutter = [{ at: "gap0" as const, y: 0.2, x: 0.955, keep: "right" as const }, { at: "gap0" as const, y: 0.8, x: 0.955, keep: "right" as const }];
  const xs = (anchors: Anchors, keep?: number) => resolveSpine({ points: gutter }, anchors, { bandRun: false, viewport: 800, keep }).map((p) => p.x);

  it("sits where it says when the words stop short of it", () => {
    expect(xs(page(300), 40)).toEqual([0.955 * 400, 0.955 * 400]);
  });
  it("is pushed out past the words by the clearance when they run toward it, both points together", () => {
    expect(xs(page(380), 40)).toEqual([420, 420]);
  });
  it("keeps clear of a link too, which can reach farther than the words", () => {
    expect(xs(page(300, [{ left: 8, right: 392, top: 300, bottom: 360 }]), 40)).toEqual([432, 432]);
  });
  it("ignores words the stretch does not pass", () => {
    expect(xs({ ...page(380), blocks: [{ left: 20, right: 380, top: 650, bottom: 690 }] }, 40)).toEqual([0.955 * 400, 0.955 * 400]);
  });
  it("is left as it was with no clearance asked for", () => {
    expect(xs(page(380))).toEqual([0.955 * 400, 0.955 * 400]);
  });
  it("composes a bay as a way in from past the edge, across to its reach and back out", () => {
    expect(composePoints([{ at: "gap2", kind: "bay", side: "left", reach: 0.6, slope: 0.5, centre: 0.4 }])).toEqual([
      { at: "gap2", y: 0.15, x: -0.2 }, { at: "gap2", y: 0.4, x: 0.6 }, { at: "gap2", y: 0.65, x: -0.2 },
    ]);
  });
});
