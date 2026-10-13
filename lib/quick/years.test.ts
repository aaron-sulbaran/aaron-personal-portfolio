import { describe, expect, it } from "vitest";
import { quickClosing, quickEntries, quickYears } from "@/lib/content/quick";
import { CLOSE_KEY, tripStops, unfiled, yearKey, yearRows } from "./years";

describe("year rows", () => {
  const rows = yearRows(quickEntries);

  it("keep the years' order and files every card exactly once", () => {
    expect(rows.map((row) => row.year)).toEqual(quickYears.map((row) => row.year));
    expect(unfiled(quickEntries, rows)).toEqual([]);
    expect(rows.flatMap((row) => row.entries).length).toBe(quickEntries.length);
  });

  it("file a card under its start year, by month then title", () => {
    for (const row of rows) {
      for (const entry of row.entries) expect(entry.start.slice(0, 4)).toBe(row.year);
      for (let i = 1; i < row.entries.length; i += 1) {
        const [a, b] = [row.entries[i - 1], row.entries[i]];
        expect(a.start < b.start || (a.start === b.start && a.title.localeCompare(b.title) <= 0)).toBe(true);
      }
    }
    expect(rows.find((row) => row.year === "2022")!.entries.map((entry) => entry.id)).toEqual(["fsdatalink", "misuki"]);
  });

  it("take edited lines without touching the cards", () => {
    const edited = yearRows(quickEntries, [{ year: "2021", line: "Edited." }]);
    expect(edited).toHaveLength(1);
    expect(edited[0].line).toBe("Edited.");
    expect(edited[0].key).toBe(yearKey("2021"));
  });

  it("report a card filed under no year", () => {
    const rowsWithout2026 = yearRows(quickEntries, quickYears.slice(0, 5));
    expect(unfiled(quickEntries, rowsWithout2026).map((entry) => entry.id).sort()).toEqual(["anthropic", "building-in-public", "hackathons", "talos", "this-site"]);
  });
});

describe("trip stops", () => {
  it("are every year, then what's next", () => {
    const stops = tripStops(yearRows(quickEntries));
    expect(stops.map((stop) => stop.label)).toEqual([...quickYears.map((row) => row.year), quickClosing.label]);
    expect(stops.at(-1)!.key).toBe(CLOSE_KEY);
    expect(new Set(stops.map((stop) => stop.key)).size).toBe(stops.length);
  });
});
