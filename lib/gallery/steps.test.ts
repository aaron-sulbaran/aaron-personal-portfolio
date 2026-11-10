import { describe, expect, it } from "vitest";
import { galleryOf } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { cardSteps, maskStartMs, stingStartMs } from "@/lib/gallery/steps";

const ids = (steps: { id: string }[][]) => steps.map((step) => step.map((part) => part.id));

describe("a card's mask steps", () => {
  it("masks Mentorship's rows, its mentors and its link, and never the card picture a flown card covers", () => {
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", true))).toEqual([
      ["title"], ["meta"], ["caption-0", "words-0"], ["photo-1", "caption-1", "words-1", "rotator-1"], ["mentors"], ["links"],
    ]);
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", false))[2]).toEqual(["photo-0", "caption-0", "words-0"]);
  });
  it("masks the jobs card's rows together: each job's tag and photo with its paragraph, a tag beside the words with them, the post's link after its frame", () => {
    // Photos 0 to 2 are the Aritzia poster, the Apple badge and MOD's last clock-out, then tags 3 to 7 (Aritzia to Popeyes) and the post, 8.
    expect(ids(cardSteps(galleryOf("jobs"), "rows", false))).toEqual([
      ["title"], ["meta"],
      ["photo-3", "photo-0", "caption-0", "photo-5", "words-0"],
      ["photo-4", "photo-1", "caption-1", "words-1"],
      ["photo-6", "photo-2", "caption-2", "photo-7", "words-2"],
      // The post's frame, then View on LinkedIn under it where a photo's caption would be, then the paragraph.
      ["photo-8", "caption-8", "words-3"],
      ["links"],
    ]);
  });
  it("masks a phone's jobs card from its first page: the Aritzia poster, its caption, the first paragraph, then Aritzia's and UT Austin's tags under it", () => {
    expect(ids(cardSteps(galleryOf("jobs"), "pager", false))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0"], ["photo-3", "photo-5"], ["pager"]]);
  });
  it("masks a phone's header, its first page and the pager's controls, the card picture too when a flown card parks on the header's tile", () => {
    expect(ids(cardSteps(galleryOf("capital-one"), "pager", false))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0", "words-1"], ["pager"]]);
    expect(ids(cardSteps(galleryOf("mentorship"), "pager", true))[2]).toEqual(["photo-0", "caption-0"]);
  });
  it("masks a phone card with no photos as its words, This site's easter egg line and its links", () => {
    expect(ids(cardSteps(galleryOf("this-site"), "pager", false))).toEqual([["title"], ["meta"], ["words-0"], ["egg"], ["links"]]);
  });
  it("counts a split part's lines", () => {
    const steps = cardSteps(galleryOf("talos"), "rows", false, (id) => (id === "words-0" ? 4 : 1));
    expect(steps[2]).toEqual([{ id: "words-0", lines: 4 }]);
  });
  it("masks Talos's sting after its first paragraph, its Discord channel after its second and its team before its link", () => {
    expect(ids(cardSteps(galleryOf("talos"), "rows", false))).toEqual([["title"], ["meta"], ["words-0"], ["sting"], ["words-1"], ["discord"], ["talos"], ["links"]]);
    expect(ids(cardSteps(galleryOf("talos"), "pager", true)).slice(2, 4)).toEqual([["words-0"], ["sting"]]);
  });
  it("masks the Hackathons card's video as a photo, in its own row with the HackTX paragraph it sits beside", () => {
    expect(ids(cardSteps(galleryOf("hackathons"), "rows", false))).toEqual([
      ["title"], ["meta"], ["photo-0", "caption-0", "words-0"], ["photo-1", "caption-1", "words-1"], ["photo-4", "words-2"], ["photo-2", "caption-2", "words-3"], ["photo-3", "caption-3", "words-4"], ["links"],
    ]);
  });
  it("starts the sting once its stage has masked in", () => {
    const { staggerMs, lengthMs } = GALLERY.mask;
    expect(stingStartMs(false)).toBe(3 * staggerMs + lengthMs);
    expect(stingStartMs(true)).toBe(GALLERY.mask.landingMs + 3 * staggerMs + lengthMs);
  });
  it("starts at the landing after a flight, and at once when nothing lands", () => {
    expect([maskStartMs(true), maskStartMs(false)]).toEqual([GALLERY.mask.landingMs, 0]);
  });
});
