import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

describe("the legacy shapes are gone", () => {
  it("leaves no work item, home tile, case page copy, strand pattern or legacy book row behind", () => {
    for (const key of ["workItems", "homeTiles", "work"]) expect(Object.keys(siteContent)).not.toContain(key);
    expect(Object.keys(siteContent.strand)).toEqual(["order"]);
    for (const key of ["workRows", "photoRows", "photosHeading"]) expect(Object.keys(siteContent.book)).not.toContain(key);
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
  it("writes the hero and the book's headings without an em dash", () => {
    const strings = [
      ...Object.values(siteContent.hero).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value))),
      siteContent.book.ariaLabel,
      siteContent.book.workHeading,
      siteContent.book.peopleHeading,
    ];
    for (const text of strings) expect(text).not.toMatch(/\u2014/);
  });
});

describe("menu", () => {
  it("includes Connect", () => {
    expect(siteContent.menu.items.map((item) => item.key)).toEqual(["home", "work", "about", "connect"]);
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
