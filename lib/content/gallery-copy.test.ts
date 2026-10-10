import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

describe("the card modal's own words", () => {
  const g = siteContent.modals.gallery;
  it("names the pager, its pages and its buttons", () => {
    expect(g.pagerLabel(3)).toBe("Photos and their stories, 3");
    expect(g.pageLabel(2, 3)).toBe("2 of 3");
    expect([g.previousPage, g.nextPage]).toEqual(["Previous page", "Next page"]);
    expect(g.pageNumber(2, 3)).toBe("Page 2 of 3");
  });
  it("names the rotator, its dots, its pause button and what it announces", () => {
    expect(g.rotatorLabel(3)).toBe("Photos taking turns, 3");
    expect(g.photoOf(1, 3)).toBe("Photo 1 of 3");
    expect(g.announce(2, 3, "Me with my section, the low reeds.")).toBe("Photo 2 of 3: Me with my section, the low reeds.");
    expect(g.announce(2, 3, "")).toBe("Photo 2 of 3");
    expect([g.pausePhotos, g.playPhotos]).toEqual(["Pause the photos", "Play the photos"]);
    expect(g.groupStep(1, 3)).toBe("Photo 1 of 3. Show the next photo");
  });
  it("describes the turning groups and the pager's pages to assistive tech", () => {
    expect([g.roleCarousel, g.roleSlide]).toEqual(["carousel", "slide"]);
  });
  it("labels the book for both of its columns", () => {
    expect(siteContent.book.ariaLabel).toBe("Work and people");
  });
});
