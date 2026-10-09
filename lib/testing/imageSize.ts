import { readFileSync } from "node:fs";
import { jpegSize } from "./jpegSize";

// Width and height of an image file in the formats public/ holds: JPEG, PNG, AVIF and SVG.
// An SVG's size is its viewBox's width and height, else its width and height attributes.
export function imageSize(file: string): [number, number] {
  const lower = file.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return jpegSize(file);
  const bytes = readFileSync(file);
  if (lower.endsWith(".png")) {
    if (bytes.toString("latin1", 12, 16) !== "IHDR") throw new Error(`no IHDR in ${file}`);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (lower.endsWith(".avif")) {
    const at = bytes.indexOf("ispe", 0, "latin1");
    if (at < 0) throw new Error(`no ispe box in ${file}`);
    return [bytes.readUInt32BE(at + 8), bytes.readUInt32BE(at + 12)];
  }
  if (lower.endsWith(".svg")) {
    const root = bytes.toString("utf8").match(/<svg\b[^>]*>/)?.[0];
    if (!root) throw new Error(`no svg element in ${file}`);
    const viewBox = root.match(/\sviewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
    if (viewBox?.length === 4) return [viewBox[2], viewBox[3]];
    const width = root.match(/\swidth="([\d.]+)"/)?.[1];
    const height = root.match(/\sheight="([\d.]+)"/)?.[1];
    if (width && height) return [Number(width), Number(height)];
    throw new Error(`no viewBox or size on the svg element in ${file}`);
  }
  throw new Error(`unsupported image format: ${file}`);
}

// A JPEG that still carries Exif or XMP (APP1), an ICC profile (APP2), IPTC (APP13) or a comment.
export function jpegHasMetadata(file: string): boolean {
  const bytes = readFileSync(file);
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) return false;
    const length = bytes.readUInt16BE(i + 2);
    if (marker === 0xe1 || marker === 0xe2 || marker === 0xed || marker === 0xfe) return true;
    i += 2 + length;
  }
  return false;
}
