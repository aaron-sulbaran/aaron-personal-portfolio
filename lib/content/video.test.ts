import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { imageSize, jpegHasMetadata } from "@/lib/testing/imageSize";

const PUBLIC = join(process.cwd(), "public");
const keys = Object.keys(siteContent.cards) as CardKey[];
const withVideo = keys.filter((key) => siteContent.cards[key].modal.video);

// An MP4's top-level boxes in order, and whether any track is sound.
function boxes(bytes: Buffer): string[] {
  const names: string[] = [];
  for (let at = 0; at + 8 <= bytes.length; ) {
    const size = bytes.readUInt32BE(at);
    names.push(bytes.toString("latin1", at + 4, at + 8));
    if (size < 8) break;
    at += size;
  }
  return names;
}
const hasSound = (bytes: Buffer) => bytes.includes(Buffer.from("soun", "latin1"));

describe("a card's demo video", () => {
  it("is on the Hackathons card alone, beside its HackTX paragraph, labelled in my words", () => {
    expect(withVideo).toEqual(["hackathons"]);
    const { video, blocks } = siteContent.cards.hackathons.modal;
    expect(blocks[video!.beside].startsWith("**HackTX, fall 2026.**")).toBe(true);
    expect(video!.label).toBe("A 38-second demo of Muse Friends, the feature I built at HackTX.");
  });

  it("is a web copy: an MP4 that streams from its first bytes (the moov box before the media), no sound, under 3 MB", () => {
    for (const key of withVideo) {
      const { src } = siteContent.cards[key].modal.video!;
      const file = join(PUBLIC, src);
      const bytes = readFileSync(file);
      const order = boxes(bytes);
      expect(order[0], src).toBe("ftyp");
      expect(order.indexOf("moov"), src).toBeGreaterThan(-1);
      expect(order.indexOf("moov"), src).toBeLessThan(order.indexOf("mdat"));
      expect(hasSound(bytes), src).toBe(false);
      expect(statSync(file).size, src).toBeLessThan(3_000_000);
    }
  });

  it("is served from a path no redirect takes (next.config.mjs sends /work/* to #work, all but /work/logos)", () => {
    for (const key of withVideo) {
      const { src, poster } = siteContent.cards[key].modal.video!;
      for (const path of [src, poster]) expect(path.startsWith("/work/") && !path.startsWith("/work/logos/"), path).toBe(false);
    }
  });

  it("has a poster at the video's own size, with no metadata", () => {
    for (const key of withVideo) {
      const { poster, width, height } = siteContent.cards[key].modal.video!;
      expect(imageSize(join(PUBLIC, poster)), poster).toEqual([width, height]);
      expect(jpegHasMetadata(join(PUBLIC, poster)), poster).toBe(false);
    }
  });
});
