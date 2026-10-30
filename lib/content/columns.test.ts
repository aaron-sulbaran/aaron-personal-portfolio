import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { cardColumns, columnSpecs, columnView } from "@/lib/content/columns";

const { cards, strand } = siteContent;

describe("the cards section's columns", () => {
  it("are Work, then Builds with a small Off the clock group under it", () => {
    expect(cardColumns.map((column) => [column.key, column.heading, column.groups.map((group) => group.heading)])).toEqual([
      ["work", "Work", [null]],
      ["builds", "Builds", [null, "Off the clock"]],
    ]);
  });

  it("order the titles as I asked", () => {
    const keys = (column: number, group: number) => cardColumns[column].groups[group].titles.map((title) => title.key);
    expect(keys(0, 0)).toEqual(["capital-one", "anthropic", "ieee", "fsdatalink", "jobs", "mentorship"]);
    expect(keys(1, 0)).toEqual(["min-max", "talos", "this-site", "hackathons", "building-in-public"]);
    expect(keys(1, 1)).toEqual(["band", "misuki", "travel"]);
  });

  it("hold every card exactly once", () => {
    const all = cardColumns.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key)));
    expect(all).toHaveLength(14);
    expect([...all].sort()).toEqual([...strand.order].sort());
  });

  it("show a short title for every card, one to three words", () => {
    for (const key of Object.keys(cards) as CardKey[]) {
      expect(cards[key].short.trim(), key).not.toBe("");
      expect(cards[key].short.split(" ").length, key).toBeLessThanOrEqual(3);
      expect(cards[key].short, key).not.toMatch(/\u2014/);
    }
    expect(Object.fromEntries((Object.keys(cards) as CardKey[]).map((key) => [key, cards[key].short]))).toEqual({
      mentorship: "Mentorship", "min-max": "min/Max", band: "Band", talos: "Talos", travel: "Travel", "capital-one": "Capital One",
      hackathons: "Hackathons", anthropic: "Anthropic", misuki: "Misuki", ieee: "IEEE", jobs: "Jobs", "this-site": "This site",
      fsdatalink: "Family business", "building-in-public": "Building in public",
    });
  });

  it("set \"(part-time)\" after the jobs title as a qualifier of the one title, and no other card has one", () => {
    const titles = cardColumns.flatMap((column) => column.groups.flatMap((group) => group.titles));
    expect(titles.filter((title) => title.qualifier).map((title) => [title.key, title.short, title.qualifier])).toEqual([["jobs", "Jobs", "(part-time)"]]);
    // Only the Work column reads it: the card's short title stays "Jobs" wherever else a short title is used.
    expect(cards.jobs.short).toBe("Jobs");
    expect(cardColumns[0].groups[0].titles.find((title) => title.key === "jobs")?.qualifier).toBe("(part-time)");
    for (const key of Object.keys(cards) as CardKey[]) if (key !== "jobs") expect(cards[key].qualifier, key).toBeUndefined();
  });

  it("keep each card's full book title, as a visitor reads it, for assistive tech", () => {
    const titles = Object.fromEntries(cardColumns.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => [title.key, title.full]))));
    expect(titles.ieee).toBe("IEEE UT Austin");
    expect(titles.fsdatalink).toBe("The family business");
    expect(titles.jobs).toBe("\"unflattering\" jobs that paid for school");
  });

  it("build a view from a spec", () => {
    const view = columnView({ key: "work", heading: "Work", groups: [{ heading: null, keys: ["travel"] }] });
    expect(view.groups[0].titles).toEqual([{ key: "travel", short: "Travel", qualifier: null, full: "Travel" }]);
    expect(columnSpecs).toHaveLength(2);
  });
});
