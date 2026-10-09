import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { imageSize, jpegHasMetadata } from "./imageSize";

const dir = mkdtempSync(join(tmpdir(), "image-size-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function file(name: string, bytes: Buffer | string): string {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

// SOI, an optional APP segment, a baseline SOF0 for 1200 by 1600, then SOS.
function jpeg(app?: number): Buffer {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (app) parts.push(Buffer.from([0xff, app, 0x00, 0x04, 0x00, 0x00]));
  parts.push(Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x06, 0x40, 0x04, 0xb0, 0x01, 0x01, 0x11, 0x00]));
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x02]));
  return Buffer.concat(parts);
}

describe("imageSize", () => {
  it("reads a JPEG's frame header", () => {
    expect(imageSize(file("a.jpg", jpeg()))).toEqual([1200, 1600]);
  });
  it("reads a PNG's IHDR", () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.write("IHDR", 12, "latin1");
    png.writeUInt32BE(681, 16);
    png.writeUInt32BE(517, 20);
    expect(imageSize(file("a.png", png))).toEqual([681, 517]);
  });
  it("reads an AVIF's ispe box", () => {
    const avif = Buffer.alloc(40);
    avif.write("ispe", 20, "latin1");
    avif.writeUInt32BE(512, 28);
    avif.writeUInt32BE(129, 32);
    expect(imageSize(file("a.avif", avif))).toEqual([512, 129]);
  });
  it("reads an SVG's viewBox first, then its size attributes, never stroke-width", () => {
    expect(imageSize(file("a.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="109 100 548 497" width="70.57" height="64" stroke-width="64">'))).toEqual([548, 497]);
    expect(imageSize(file("b.svg", '<?xml version="1.0"?>\n<svg version="1.1" stroke-width="9" width="1600" height="1046">'))).toEqual([1600, 1046]);
    expect(() => imageSize(file("c.svg", "<svg>"))).toThrow(/no viewBox/);
  });
});

describe("jpegHasMetadata", () => {
  it("finds an Exif or ICC segment and passes a clean file", () => {
    expect(jpegHasMetadata(file("clean.jpg", jpeg()))).toBe(false);
    expect(jpegHasMetadata(file("exif.jpg", jpeg(0xe1)))).toBe(true);
    expect(jpegHasMetadata(file("icc.jpg", jpeg(0xe2)))).toBe(true);
    expect(jpegHasMetadata(file("jfif.jpg", jpeg(0xe0)))).toBe(false);
  });
  it("throws on a file that is not a well-formed marker sequence", () => {
    const truncated = jpeg(0xe0).subarray(0, 8);
    expect(() => jpegHasMetadata(file("truncated.jpg", truncated))).toThrow(/malformed JPEG/);
    const notAMarker = Buffer.from(jpeg());
    notAMarker[2] = 0x00;
    expect(() => jpegHasMetadata(file("not-a-marker.jpg", notAMarker))).toThrow(/malformed JPEG/);
    expect(() => jpegHasMetadata(file("no-soi.jpg", Buffer.from([0x00, 0x01, 0x02])))).toThrow(/malformed JPEG/);
    expect(() => jpegHasMetadata(file("no-sos.jpg", jpeg().subarray(0, 2 + 13)))).toThrow(/malformed JPEG/);
    expect(() => jpegHasMetadata(file("short-length.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00])))).toThrow(/malformed JPEG/);
  });
});
