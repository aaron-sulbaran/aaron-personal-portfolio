import { describe, expect, it } from "vitest";
import { homeTileByKey, isPlaceholderPhoto, photoBySrc, siteContent, strandTiles, workItemBySlug } from "@/lib/content";

const { book, strand } = siteContent;

describe("the Coil strand", () => {
  it("is real tiles only, one per pattern slot, in the pattern's order", () => {
    expect(strandTiles.length).toBe(strand.pattern.length);
    expect(strandTiles.length).toBe(14);
    const kinds = strandTiles.map((tile) => (tile.kind === "photo" ? "P" : "W")).join("");
    expect(kinds).toBe(strand.pattern);
    expect(strand.photos.length).toBe([...strand.pattern].filter((c) => c === "P").length);
    expect(strand.work.length).toBe([...strand.pattern].filter((c) => c === "W").length);
    for (const tile of strandTiles) {
      if (tile.kind === "photo") expect(isPlaceholderPhoto(tile.src)).toBe(false);
    }
    expect(new Set(strandTiles.map((tile) => tile.key)).size).toBe(strandTiles.length);
  });
});

describe("the book", () => {
  it("links every case row to a real case study and keeps soon rows link-free", () => {
    for (const row of book.workRows) {
      if (row.target.kind === "case") expect(workItemBySlug.has(row.target.slug as never)).toBe(true);
    }
    expect(book.workRows.map((row) => row.key).slice(0, 2)).toEqual(["talos", "min-max"]);
  });

  it("lists only real photos, each resolvable for the modal", () => {
    for (const row of book.photoRows) {
      expect(isPlaceholderPhoto(row.src)).toBe(false);
      expect(photoBySrc.has(row.src)).toBe(true);
    }
  });

  it("shares keys with the cards so seen state carries across", () => {
    const keys = [...book.workRows, ...book.photoRows].map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const tile of strandTiles) expect(keys).toContain(tile.key);
    for (const row of book.photoRows) expect(homeTileByKey.get(row.key)?.kind).toBe("photo");
  });

  it("writes titles in sentence case and never uses an em dash", () => {
    const strings = [
      ...Object.values(siteContent.hero).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value))),
      book.ariaLabel,
      book.workHeading,
      book.photosHeading,
      ...book.workRows.flatMap((row) => [row.title, row.meta]),
      ...book.photoRows.flatMap((row) => [row.title, row.meta]),
    ];
    for (const text of strings) expect(text).not.toMatch(/\u2014/);
    // Sentence case: after the first word, only proper nouns may be capitalized.
    const proper = new Set(["I'm", "Aaron.", "Aaron", "One", "UT", "Austin", "Fuji", "Scholars", "Maracaibo", "Japan", "Claude", "IEEE", "HSF", "Mt.", "Capital"]);
    for (const row of [...book.workRows, ...book.photoRows]) {
      for (const word of row.title.split(" ").slice(1)) {
        if (/^[A-Z]/.test(word)) expect(proper.has(word)).toBe(true);
      }
    }
  });

  it("reads the ambassador meta as Claude ambassador, 2025", () => {
    expect(book.workRows.find((row) => row.key === "claude-ambassador")?.meta).toBe("Claude ambassador, 2025");
  });
});

describe("menu", () => {
  it("includes Connect", () => {
    expect(siteContent.menu.items.map((item) => item.key)).toEqual(["home", "work", "about", "connect"]);
  });
});

describe("the case page", () => {
  it("labels the back link with the word alone; the page draws the arrow", () => {
    expect(siteContent.work.backLabel).toBe("Work");
  });
});
