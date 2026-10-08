import { readFileSync } from "node:fs";

// Width and height from a JPEG's start-of-frame segment.
export function jpegSize(file: string): [number, number] {
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
