import { describe, expect, it } from "vitest";
import { DISCOVER_DWELL_MS, discoverableId, popPhotos } from "./discover";

describe("a word is discovered by looking at it", () => {
  it("takes a beat: a pass under the pointer is not a look, a look still feels immediate", () => {
    expect(DISCOVER_DWELL_MS).toBeGreaterThanOrEqual(500);
    expect(DISCOVER_DWELL_MS).toBeLessThanOrEqual(1000);
  });

  it("times a shown pop by its word, so moving onto its label and back keeps one clock", () => {
    const target = { kind: "pop", key: "leadership-award" } as const;
    expect(discoverableId({ target, via: "hover" })).toBe("pop:leadership-award");
    expect(discoverableId({ target, via: "grace" })).toBe("pop:leadership-award");
    expect(discoverableId({ target, via: "tap" })).toBe("pop:leadership-award");
  });

  it("never times a definition (opening it is the look), an idle label, or a word with nothing to show", () => {
    expect(discoverableId({ target: { kind: "def", key: "product" }, via: "hover" })).toBeNull();
    expect(discoverableId({ target: null, via: null })).toBeNull();
    expect(discoverableId({ target: { kind: "pop", key: "no-such-pop" }, via: "hover" })).toBeNull();
  });
});

describe("the photos a pop opens on", () => {
  it("is the one photo of a plain pop", () => {
    const photos = popPhotos("leadership-award");
    expect(photos).toHaveLength(1);
    expect(photos[0].src).toMatch(/^\//);
    expect(photos[0].sizes).toBeTruthy();
  });

  it("is every frame of a pop that cycles, since all of them render the moment it opens", () => {
    expect(popPhotos("thrill-seeker").length).toBeGreaterThan(1);
  });

  it("is nothing for a word that is not a pop", () => {
    expect(popPhotos("no-such-pop")).toEqual([]);
  });
});
