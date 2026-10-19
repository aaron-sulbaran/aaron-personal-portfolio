import { describe, expect, it } from "vitest";
import { quickEntries, quickYears } from "@/lib/content/quick";
import { tripStops, unfiled, yearKey, yearRows } from "./years";

describe("year rows", () => {
  const rows = yearRows(quickEntries);

  it("read newest first and file every tile exactly once", () => {
    expect(rows.map((row) => row.year)).toEqual([...quickYears].reverse().map((row) => row.year));
    expect(unfiled(quickEntries, rows)).toEqual([]);
    expect(rows.flatMap((row) => row.entries).length).toBe(quickEntries.length);
    expect(new Set(rows.flatMap((row) => row.entries.map((entry) => entry.slot))).size).toBe(quickEntries.length);
  });

  it("file a tile under its start year, by month then title", () => {
    for (const row of rows) {
      for (const entry of row.entries) expect(entry.start.slice(0, 4)).toBe(row.year);
      for (let i = 1; i < row.entries.length; i += 1) {
        const [a, b] = [row.entries[i - 1], row.entries[i]];
        expect(a.start < b.start || (a.start === b.start && a.title.localeCompare(b.title) <= 0)).toBe(true);
      }
    }
    expect(rows.find((row) => row.year === "2026")!.entries.map((entry) => entry.slot)).toEqual(["anthropic", "building-in-public", "this-site", "capital-one-2026", "talos"]);
    expect(rows.find((row) => row.year === "2025")!.entries.map((entry) => entry.slot)).toEqual(["hackathons", "min-max", "capital-one-2025", "aritzia"]);
    expect(rows.find((row) => row.year === "2022")!.entries.map((entry) => entry.slot)).toEqual(["fsdatalink", "popeyes", "misuki"]);
  });

  it("take edited lines without touching the cards", () => {
    const edited = yearRows(quickEntries, [{ year: "2021", line: "Edited." }]);
    expect(edited).toHaveLength(1);
    expect(edited[0].line).toBe("Edited.");
    expect(edited[0].key).toBe(yearKey("2021"));
  });

  it("report a card filed under no year", () => {
    const rowsWithout2026 = yearRows(quickEntries, quickYears.slice(0, 5));
    expect(unfiled(quickEntries, rowsWithout2026).map((entry) => entry.slot).sort()).toEqual(["anthropic", "building-in-public", "capital-one-2026", "talos", "this-site"]);
  });
});

describe("trip stops", () => {
  it("are every year, newest first, and nothing else", () => {
    const stops = tripStops(yearRows(quickEntries));
    expect(stops.map((stop) => stop.label)).toEqual([...quickYears].reverse().map((row) => row.year));
    expect(stops.every((stop) => stop.key.startsWith("year-"))).toBe(true);
    expect(new Set(stops.map((stop) => stop.key)).size).toBe(stops.length);
  });
});
