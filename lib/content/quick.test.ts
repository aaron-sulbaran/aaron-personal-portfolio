import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { walkStrings } from "@/lib/testing/walk";
import { cards } from "./cards";
import { quickClosing, quickCopy, quickEntries, quickRange, quickSigns, quickSorted, squareMarks } from "./quick";

const EM_DASH = "\u2014";
const siteCopy = [...walkStrings(cards), ...walkStrings(siteContent.whoIAm)].map((leaf) => leaf.text);

describe("quick entries", () => {
  it("covers every card once, with a month and a first-person line", () => {
    const ids = quickEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(cards).sort());
    for (const entry of quickEntries) {
      expect(entry.start).toMatch(/^\d{4}-\d{2}$/);
      if (entry.end) expect(entry.end >= entry.start).toBe(true);
      expect(entry.line.startsWith("Aaron")).toBe(false);
      expect(entry.outcomes.length).toBeGreaterThan(0);
      expect(entry.outcomes.length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps its years visible", () => {
    for (const entry of quickEntries) expect(quickRange(entry)).toMatch(/^\d{4}( to (\d{4}|now))?$/);
  });

  it("carries the card's picture or logo, and nothing a card does not have", () => {
    for (const entry of quickEntries) {
      const { visual } = cards[entry.id];
      expect(entry.photo).toEqual(visual.kind === "photo" ? visual.photo : null);
      expect(entry.logo).toEqual(visual.kind === "logo" ? visual.logo : null);
      expect(Boolean(entry.photo && entry.logo)).toBe(false);
    }
    expect(quickEntries.filter((entry) => entry.photo).length).toBe(6);
    expect(quickEntries.filter((entry) => entry.logo).length).toBe(6);
  });

  it("gives every logo entry a node mark, its own logo unless a square mark stands in", () => {
    for (const entry of quickEntries) {
      expect(Boolean(entry.mark)).toBe(Boolean(entry.logo));
      if (entry.logo) expect(entry.mark).toEqual(squareMarks[entry.id] ?? entry.logo);
    }
  });

  it("points only at files that exist", () => {
    const files = quickEntries.flatMap((entry) => [entry.photo?.src, entry.logo?.src, entry.logo?.srcDark, entry.mark?.src, entry.mark?.srcDark]);
    for (const src of files) if (src) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
  });

  it("sorts newest first", () => {
    const sorted = quickSorted();
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1].start >= sorted[i].start).toBe(true);
    }
  });
});

describe("quick signs", () => {
  it("are dated, keyed once, and never collide with an entry", () => {
    const keys = quickSigns.map((sign) => sign.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const sign of quickSigns) {
      expect(sign.at).toMatch(/^\d{4}-\d{2}$/);
      expect(keys.filter((key) => (Object.keys(cards) as string[]).includes(key))).toEqual([]);
    }
  });

  it("only say what the site already says, with the year in the copy or flagged", () => {
    for (const sign of quickSigns) {
      for (const words of sign.evidence) expect(siteCopy.some((text) => text.includes(words)), `${sign.key}: ${words}`).toBe(true);
      const year = sign.at.slice(0, 4);
      if (!sign.yearFrom) expect(sign.evidence.some((words) => words.includes(year)), sign.key).toBe(true);
    }
  });
});

describe("quick copy", () => {
  it("has no em dashes and no third person", () => {
    const strings = walkStrings({ quickCopy, quickEntries, quickSigns, quickClosing }).map((leaf) => leaf.text);
    for (const text of strings) {
      expect(text.includes(EM_DASH), text).toBe(false);
      expect(/\bAaron (is|was|has)\b/.test(text), text).toBe(false);
    }
  });

  it("closes on one line and links Connect already has", () => {
    expect(quickClosing.line.split(". ").length).toBe(1);
    const keys = siteContent.connect.links.map((link) => link.key);
    for (const key of quickClosing.links) expect(keys).toContain(key);
  });
});
