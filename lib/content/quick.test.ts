import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { walkStrings } from "@/lib/testing/walk";
import { cards } from "./cards";
import { quickClosing, quickCopy, quickEntries, quickRange, quickSubtitle, quickYears, squareMarks } from "./quick";

const EM_DASH = "\u2014";

describe("quick entries", () => {
  it("covers every card, and repeats only Capital One and the jobs", () => {
    const ids = quickEntries.map((entry) => entry.id);
    expect(new Set(quickEntries.map((entry) => entry.slot)).size).toBe(ids.length);
    expect([...new Set(ids)].sort()).toEqual(Object.keys(cards).sort());
    expect(ids.filter((id) => id === "capital-one")).toHaveLength(3);
    expect(ids.filter((id) => id === "jobs")).toHaveLength(5);
    for (const entry of quickEntries) {
      expect(entry.start).toMatch(/^\d{4}-\d{2}$/);
      if (entry.end) expect(entry.end >= entry.start).toBe(true);
      expect(entry.line.startsWith("Aaron")).toBe(false);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.line.includes("…")).toBe(false);
    }
  });

  it("titles a repeated job by its employer and every other tile as the book does", () => {
    expect(quickEntries.filter((entry) => entry.id === "jobs").map((entry) => entry.title).sort()).toEqual(["Apple", "Aritzia", "MOD Pizza", "Popeyes", "UT Austin"]);
    for (const entry of quickEntries) if (entry.id !== "jobs") expect(entry.title).toBe(cards[entry.id].book.title);
  });

  it("names a year's role in full, and appends the range only when the role does not", () => {
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "capital-one-2024")!)).toBe("Business Analyst Intern, 2024");
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "apple")!)).toBe("From Specialist to Genius Bar, 2024");
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "capital-one-2026")!)).toBe("Applied AI (PM) Intern, 2026");
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "fsdatalink")!)).toBe("Assistant manager and software engineer, 2022 to now");
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "hackathons")!)).toBe("Builder, 2025 to now");
    expect(quickSubtitle(quickEntries.find((entry) => entry.slot === "misuki")!)).toBe("2001 Mazda Miata, five-speed, 2022 to now");
  });

  it("joins a role and its year with a comma, never a hyphen", () => {
    for (const entry of quickEntries) expect(quickSubtitle(entry), entry.slot).not.toMatch(/ - /);
    for (const slot of ["popeyes", "mod", "apple", "ut-austin", "aritzia", "capital-one-2024", "capital-one-2025", "capital-one-2026"]) {
      const entry = quickEntries.find((e) => e.slot === slot)!;
      expect(quickSubtitle(entry), slot).toBe(entry.role);
      expect(entry.role, slot).toMatch(/, 20(1\d|2\d)$/);
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
    expect(quickEntries.filter((entry) => entry.logo).map((entry) => entry.slot).sort()).toEqual([
      "anthropic", "capital-one-2024", "capital-one-2025", "capital-one-2026", "fsdatalink", "ieee", "min-max", "talos",
    ]);
    expect(quickEntries.find((entry) => entry.slot === "anthropic")!.tileLogo).toEqual(squareMarks.anthropic);
    expect(quickEntries.filter((entry) => entry.id === "jobs").every((entry) => entry.tileLogo && !entry.logo)).toBe(true);
  });

  it("gives every logo entry a square mark, its own logo unless a square mark stands in", () => {
    for (const entry of quickEntries) {
      expect(Boolean(entry.mark)).toBe(Boolean(entry.logo));
      if (entry.logo) expect(entry.mark).toEqual(squareMarks[entry.id] ?? entry.logo);
    }
  });

  it("points only at files that exist", () => {
    const files = quickEntries.flatMap((entry) => [entry.photo?.src, entry.logo?.src, entry.logo?.srcDark, entry.mark?.src, entry.mark?.srcDark, entry.tileLogo?.src, entry.tileLogo?.srcDark]);
    for (const src of files) if (src) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
  });
});

describe("quick years", () => {
  it("run 2021 to 2026, once each, in my words", () => {
    expect(quickYears.map((row) => row.year)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    for (const { line } of quickYears) {
      expect(line.endsWith(".")).toBe(true);
      expect(line.startsWith("I ")).toBe(true);
    }
    expect(quickYears.find((row) => row.year === "2025")!.line).toContain("started showing up to hackathons");
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
    expect(quickCopy.title).toBe("My Lean Portfolio");
    expect(quickCopy.hint).toBe("(Click each experience card to learn more)");
    expect(JSON.stringify(quickCopy)).not.toContain("30-second");
    expect(JSON.stringify(quickCopy)).not.toContain("Express lane");
  });

  it("closes on the two lines I wrote and links Connect already has", () => {
    expect(quickClosing.line.split("\n\n")).toHaveLength(2);
    const keys = siteContent.connect.links.map((link) => link.key);
    for (const key of quickClosing.links) expect(keys).toContain(key);
  });
});
