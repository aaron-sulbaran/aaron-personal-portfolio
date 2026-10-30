import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

describe("the legacy shapes are gone", () => {
  it("leaves no work item, home tile, case page copy, strand pattern or legacy book row behind", () => {
    for (const key of ["workItems", "homeTiles", "work"]) expect(Object.keys(siteContent)).not.toContain(key);
    expect(Object.keys(siteContent.strand)).toEqual(["order"]);
    expect(Object.keys(siteContent)).not.toContain("book");
  });
  it("keeps the holding deck's five photos in order", () => {
    expect(siteContent.photos.map((photo) => photo.src)).toEqual([
      "/photos/cards/mentorship-picture.jpg",
      "/photos/cards/band-picture.jpg",
      "/photos/cards/capital-one-1-2024.jpg",
      "/photos/cards/travel-picture.jpg",
      "/photos/uncs-grad.jpeg",
    ]);
  });
  it("writes the hero, the columns and the intro without an em dash", () => {
    const strings = [
      ...Object.values(siteContent.hero).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value))),
      siteContent.columns.ariaLabel,
      ...siteContent.columns.order.flatMap((column) => [column.heading, ...column.groups.flatMap((group) => [group.heading ?? "", ...group.titles.map((title) => title.short)])]),
      ...siteContent.intro.blocks.flatMap((block) => block.sentences),
      ...Object.values(siteContent.intro.teaser),
      siteContent.loader.progressLabel,
    ];
    for (const text of strings) expect(text).not.toMatch(/\u2014/);
  });
});

describe("the four page titles", () => {
  it("are lowercase, only the name Aaron keeping its capital, in the apostrophe style the source already uses", () => {
    const { hero, columns, metrics, connect } = siteContent;
    expect([hero.heading, hero.greeting, hero.name]).toEqual(["hi, i'm Aaron.", "hi, i'm", "Aaron"]);
    expect(hero.heading, "the h1 reads as the two lines the scene draws").toBe(`${hero.greeting} ${hero.name}.`);
    expect([columns.title, metrics.title, connect.heading]).toEqual(["here's what i've been up to.", "proof of work", "wanna chat?"]);
    for (const title of [hero.heading, columns.title, metrics.title, connect.heading]) {
      expect(title.replace(/\bAaron\b/g, ""), title).toBe(title.replace(/\bAaron\b/g, "").toLowerCase());
      expect(title, "straight apostrophes only").not.toMatch(/[\u2018\u2019]/);
    }
  });
});

describe("menu", () => {
  it("lists the four pages, in the page's order", () => {
    expect(siteContent.menu.items.map((item) => item.key)).toEqual(["home", "work", "numbers", "connect"]);
    expect(siteContent.menu.items.map((item) => item.href)).toEqual(["#main", "#work", "#numbers", "#connect"]);
  });
});

describe("the mark card", () => {
  it("is Aaron's copy: four short paragraphs, no em dash, sentence case except the subtitle he typed lowercase", () => {
    const { mark } = siteContent;
    const strings = [mark.dialogLabel, mark.title, mark.subtitle, ...mark.lines, mark.button];
    for (const text of strings) expect(text).not.toMatch(/\u2014/);
    for (const text of [mark.dialogLabel, mark.title, ...mark.lines, mark.button]) expect(text[0]).toBe(text[0].toUpperCase());
    expect(mark.subtitle[0]).toBe(mark.subtitle[0].toLowerCase());
    expect(mark.lines).toHaveLength(4);
  });
});
