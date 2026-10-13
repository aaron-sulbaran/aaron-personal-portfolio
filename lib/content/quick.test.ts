import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { walkStrings } from "@/lib/testing/walk";
import { cards } from "./cards";
import { quickClosing, quickCopy, quickEntries, quickRange, quickYears, squareMarks } from "./quick";

const EM_DASH = "\u2014";

describe("quick entries", () => {
  it("covers every card once, with a month and a first-person line", () => {
    const ids = quickEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(cards).sort());
    for (const entry of quickEntries) {
      expect(entry.start).toMatch(/^\d{4}-\d{2}$/);
      if (entry.end) expect(entry.end >= entry.start).toBe(true);
      expect(entry.line.startsWith("Aaron")).toBe(false);
      expect(entry.role.length).toBeGreaterThan(0);
    }
  });

  it("titles each tile as the book does", () => {
    for (const entry of quickEntries) expect(entry.title).toBe(cards[entry.id].book.title);
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

  it("gives every logo entry a square mark, its own logo unless a square mark stands in", () => {
    for (const entry of quickEntries) {
      expect(Boolean(entry.mark)).toBe(Boolean(entry.logo));
      if (entry.logo) expect(entry.mark).toEqual(squareMarks[entry.id] ?? entry.logo);
    }
  });

  it("points only at files that exist", () => {
    const files = quickEntries.flatMap((entry) => [entry.photo?.src, entry.logo?.src, entry.logo?.srcDark, entry.mark?.src, entry.mark?.srcDark]);
    for (const src of files) if (src) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
  });
});

describe("quick years", () => {
  it("run 2021 to 2026, once each, one sentence each", () => {
    expect(quickYears.map((row) => row.year)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    for (const { line } of quickYears) {
      expect(line.endsWith(".")).toBe(true);
      expect(line.slice(0, -1).includes(". ")).toBe(false);
      expect(line.startsWith("I ")).toBe(true);
    }
  });

  it("are the spec's drafts, word for word", () => {
    const spec = readFileSync(join(process.cwd(), "docs/superpowers/specs/2026-10-13-express-lane-design.md"), "utf8");
    for (const { year, line } of quickYears) expect(spec, year).toContain(`- ${year}: ${line}`);
    expect(spec).toContain(quickCopy.intro);
  });

  it("every year holds at least one card", () => {
    for (const { year } of quickYears) expect(quickEntries.some((entry) => entry.start.startsWith(year)), year).toBe(true);
  });
});

describe("quick copy", () => {
  it("has no em dashes, no third person, and no dated signs", () => {
    const strings = walkStrings({ quickCopy, quickEntries, quickYears, quickClosing }).map((leaf) => leaf.text);
    for (const text of strings) {
      expect(text.includes(EM_DASH), text).toBe(false);
      expect(/\bAaron (is|was|has)\b/.test(text), text).toBe(false);
    }
    expect(quickCopy.title).toBe("Express lane");
    expect(JSON.stringify(quickCopy)).not.toContain("30-second");
  });

  it("closes on one line and links Connect already has", () => {
    expect(quickClosing.line.split(". ").length).toBe(1);
    const keys = siteContent.connect.links.map((link) => link.key);
    for (const key of quickClosing.links) expect(keys).toContain(key);
  });
});
