import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { CARD_PICTURE_SIZES, coverScale, galleryRowSizes, PAGER_PHOTO_SIZES, POP_PHOTO, POP_SIZE_VARS, popPhotoBox, popSquareSizes } from "@/lib/photoSizes";
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

describe("the photo pop's size", () => {
  it("is one height on desktop and one on a phone, kept in this one place", () => {
    expect(POP_PHOTO.height).toEqual({ desktop: 360, phone: 320 });
    expect(POP_PHOTO.maxWidth).toBe(558);
    expect(POP_SIZE_VARS).toEqual({ "--pop-h-desktop": "360px", "--pop-h-phone": "320px", "--pop-w-max": "558px", "--pop-edge": "40px" });
    // No cap below today's pop (373 tall), and none above the Fuji pop's.
    expect(POP_PHOTO.height.desktop).toBeLessThanOrEqual(373);
    expect(POP_PHOTO.height.phone).toBeGreaterThanOrEqual(300);
  });
  it("draws a portrait narrow and a landscape wide at the same height, so a 4:3 photo is not cropped on desktop", () => {
    expect(popPhotoBox(600, 800)).toEqual({ fit: "cover", width: 270, height: 360 });
    expect(popPhotoBox(800, 600)).toEqual({ fit: "cover", width: 480, height: 360 });
    expect(popPhotoBox(800, 800)).toEqual({ fit: "cover", width: 360, height: 360 });
    expect(popPhotoBox(1200, 1600)).toEqual(popPhotoBox(600, 800));
  });
  it("shows a very wide photo whole at the widest width, its height following, so a meme's words and a logo are never cut", () => {
    expect(popPhotoBox(800, 484)).toEqual({ fit: "whole", width: 558, height: 338 });
    expect(popPhotoBox(800, 243)).toEqual({ fit: "whole", width: 558, height: 169 });
    // 3:2 (the iPhone photo is a hair over) still takes the pop height, and never reaches the cap.
    expect(popPhotoBox(1500, 1000)).toEqual({ fit: "cover", width: 540, height: 360 });
    expect(popPhotoBox(800, 533)).toEqual({ fit: "cover", width: 540, height: 360 });
  });
  it("crops a cycling pop's photos into a square one pop height a side, asking for a landscape photo wider than the square", () => {
    expect(popSquareSizes(3 / 4)).toBe("360px");
    expect(popSquareSizes(1)).toBe("360px");
    expect(popSquareSizes(4 / 3)).toBe("480px");
  });
  it("fades a cycling pop's photos in over the one they replace, and swaps them instantly under reduced motion", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("/* ---- photo pops"), css.indexOf("/* ---- end photo pops ---- */")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block).toContain('.pop-card[data-fit="whole"] .pop-frame, .pop-card[data-fit="square"] .pop-frame { height: auto; aspect-ratio: var(--pop-aspect); }');
    expect(block).toMatch(/\.pop-cycle-photo \{[^}]*opacity: 0; transition: opacity 450ms/);
    expect(block).toContain('.pop-cycle-photo[data-state="active"] { z-index: 2; opacity: 1; }');
    expect(block).toContain('.pop-cycle-photo[data-state="previous"] { z-index: 1; opacity: 1; transition: none; }');
    expect(block).toContain("@media (prefers-reduced-motion: reduce) { .pop-cycle-photo, .pop-captions > span { transition: none; } }");
  });
  it("leaves its numbers to this file: the stylesheet's photo pops block holds no pixel size of its own but the phone breakpoint", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("/* ---- photo pops"), css.indexOf("/* ---- end photo pops ---- */")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("--pop-h: var(--pop-h-desktop);");
    expect(block).toContain("@media (max-width: 767px) { .pop-card { --pop-h: var(--pop-h-phone); } }");
    expect(block).toContain("calc(100vw - var(--pop-edge))");
    expect(block.replace("max-width: 767px", "").match(/\b\d+(?:\.\d+)?px\b/g)).toBeNull();
  });
});
