import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { CARD_PICTURE_SIZES, coverScale, galleryRowSizes, PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { jpegSize } from "@/lib/testing/jpegSize";

describe("photo sizes", () => {
  it("records each photo's real source pixels", () => {
    for (const photo of siteContent.photos) {
      const file = join(process.cwd(), "public", photo.src);
      expect(jpegSize(file)).toEqual([photo.width, photo.height]);
    }
  });

  it("widens the request by the cover crop for sources wider than the 3:4 slot", () => {
    expect(coverScale(3 / 4)).toBe(1);
    expect(coverScale(0.6)).toBe(1);
    expect(coverScale(3 / 2)).toBe(2);
  });
});

describe("the card modal's image sizes", () => {
  it("asks for the card picture at its 320px box, and a pager photo at the panel's inner width", () => {
    expect(CARD_PICTURE_SIZES).toBe("320px");
    expect(PAGER_PHOTO_SIZES).toBe("calc(100vw - 74px)");
  });
  it("covers a box's drawn width when the photo is wider than the box", () => {
    const vertical = { width: 320, height: (320 * 4) / 3 };
    const horizontal = { width: 424, height: 318 };
    expect(galleryRowSizes(0.75, vertical)).toBe("320px");
    expect(galleryRowSizes(998 / 1600, vertical)).toBe("320px");
    expect(galleryRowSizes(1600 / 1205, horizontal)).toBe("424px");
    expect(galleryRowSizes(1600 / 858, horizontal)).toBe("594px");
  });
});
