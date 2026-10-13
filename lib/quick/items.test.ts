import { describe, expect, it } from "vitest";
import { quickEntries, quickSigns } from "@/lib/content/quick";
import { quickItems, yearMarks } from "./items";

const all = (order: "newest" | "oldest") => quickItems(quickEntries, quickSigns, { order, filter: "all" });

describe("quickItems", () => {
  it("puts every entry and sign in date order, newest first like a résumé", () => {
    const items = all("newest");
    expect(items.length).toBe(quickEntries.length + quickSigns.length);
    for (let i = 1; i < items.length; i += 1) expect(items[i - 1].at >= items[i].at).toBe(true);
  });

  it("mirrors the two orders exactly", () => {
    expect(all("oldest").map((item) => item.key)).toEqual(all("newest").map((item) => item.key).reverse());
  });

  it("places a sign before an entry of the same month when oldest first", () => {
    const keys = all("oldest").map((item) => item.key);
    expect(keys.indexOf("started-ece")).toBeLessThan(keys.indexOf("ieee"));
  });

  it("places signs between the entries they fall between", () => {
    const keys = all("oldest").map((item) => item.key);
    expect(keys.indexOf("first-pm")).toBeGreaterThan(keys.indexOf("capital-one"));
    expect(keys.indexOf("first-pm")).toBeLessThan(keys.indexOf("min-max"));
    expect(keys.indexOf("hsf-mentor")).toBe(keys.length - 1);
  });

  it("filters entries and signs by their group", () => {
    const work = quickItems(quickEntries, quickSigns, { order: "newest", filter: "work" });
    expect(work.length).toBe(quickEntries.filter((e) => e.group === "work").length + quickSigns.filter((s) => s.group === "work").length);
    for (const item of work) expect(item.kind === "entry" ? item.entry.group : item.sign.group).toBe("work");
  });

  it("dates an entry by its start year", () => {
    const talos = all("newest").find((item) => item.key === "talos");
    expect(talos?.year).toBe("2026");
  });
});

describe("yearMarks", () => {
  it("marks the first item of each year once, in the order shown", () => {
    const newest = yearMarks(all("newest"));
    expect(newest.map((mark) => mark.year)).toEqual(["2026", "2025", "2024", "2023", "2022", "2021"]);
    const oldest = yearMarks(all("oldest"));
    expect(oldest.map((mark) => mark.year)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(oldest[0].key).toBe(all("oldest")[0].key);
  });

  it("is empty for an empty list", () => {
    expect(yearMarks([])).toEqual([]);
  });
});
