import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { coverScale, photoSlotSizes } from "@/lib/photoSizes";

// Width and height from a JPEG's start-of-frame segment.
function jpegSize(file: string): [number, number] {
  const b = readFileSync(file);
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1];
    const length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    i += 2 + length;
  }
  throw new Error(`no frame header in ${file}`);
}

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
