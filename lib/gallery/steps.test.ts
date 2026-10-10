import { describe, expect, it } from "vitest";
import { galleryOf } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";

const ids = (steps: { id: string }[][]) => steps.map((step) => step.map((part) => part.id));

describe("a card's mask steps", () => {
  it("masks Mentorship's rows, its mentors and its link, and never the card picture a flown card covers", () => {
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", true))).toEqual([
      ["title"], ["meta"], ["caption-0", "words-0"], ["photo-1", "caption-1", "words-1", "rotator-1"], ["mentors"], ["links"],
    ]);
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", false))[2]).toEqual(["photo-0", "caption-0", "words-0"]);
  });
  it("masks the jobs card's opening words and entries one by one before its rows", () => {
    expect(ids(cardSteps(galleryOf("jobs"), "rows", false))).toEqual([
      ["title"], ["meta"], ["words-0"], ["words-1"], ["words-2"], ["words-3"],
      ["photo-0", "caption-0", "words-4", "words-5", "rotator-0"], ["photo-2", "caption-2", "words-6"], ["photo-3", "caption-3", "words-7"], ["links"],
    ]);
  });
  it("masks a phone's header, its first page and the pager's controls, the card picture too when a flown card parks on the header's tile", () => {
    expect(ids(cardSteps(galleryOf("capital-one"), "pager", false))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0", "words-1"], ["pager"]]);
    expect(ids(cardSteps(galleryOf("mentorship"), "pager", true))[2]).toEqual(["photo-0", "caption-0"]);
  });
  it("masks a phone card with no photos as its words and its links", () => {
    expect(ids(cardSteps(galleryOf("this-site"), "pager", false))).toEqual([["title"], ["meta"], ["words-0"], ["links"]]);
  });
  it("counts a split part's lines", () => {
    const steps = cardSteps(galleryOf("talos"), "rows", false, (id) => (id === "words-0" ? 4 : 1));
    expect(steps[2]).toEqual([{ id: "words-0", lines: 4 }]);
  });
  it("starts at the landing after a flight, and at once when nothing lands", () => {
    expect([maskStartMs(true), maskStartMs(false)]).toEqual([GALLERY.mask.landingMs, 0]);
  });
});
