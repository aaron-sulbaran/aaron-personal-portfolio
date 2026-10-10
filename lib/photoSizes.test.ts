import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { CARD_PICTURE_SIZES, coverScale, galleryRowSizes, PAGER_PHOTO_SIZES, photoSlotSizes } from "@/lib/photoSizes";
import { jpegSize } from "@/lib/testing/jpegSize";

describe("photo slot sizes", () => {
  it("records each photo's real source pixels", () => {
    for (const photo of siteContent.photos) {
      const file = join(process.cwd(), "public", photo.src);
      if (photo.src.endsWith(".svg")) {
        expect(readFileSync(file, "utf8")).toContain(`viewBox="0 0 ${photo.width} ${photo.height}"`);
      } else {
        expect(jpegSize(file)).toEqual([photo.width, photo.height]);
      }
    }
  });

  it("widens the request by the cover crop for sources wider than the 3:4 slot", () => {
    expect(coverScale(3 / 4)).toBe(1);
    expect(coverScale(0.6)).toBe(1);
    expect(coverScale(3 / 2)).toBe(2);
    expect(photoSlotSizes("/photos/hsf-speaking.jpeg")).toBe("(max-width: 767px) calc((100vw - 72px) * 1.996), 767px");
    expect(photoSlotSizes("/photos/drum-major.jpeg")).toBe("(max-width: 767px) calc((100vw - 72px) * 1.333), 512px");
  });

  it("asks for the slot width alone for portrait sources and unknown paths", () => {
    expect(photoSlotSizes("/photos/capital-one.jpeg")).toBe("(max-width: 767px) calc(100vw - 72px), 384px");
    expect(photoSlotSizes("/photos/not-listed.jpeg")).toBe("(max-width: 767px) calc(100vw - 72px), 384px");
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
