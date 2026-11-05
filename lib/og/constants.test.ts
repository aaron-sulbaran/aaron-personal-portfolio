import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OG_COLORS, OG_SIZE } from "./constants";

const css = readFileSync("app/globals.css", "utf8");
const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));

function darkToken(name: string): string {
  const match = darkBlock.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`dark token ${name} not found`);
  return match[1].toUpperCase();
}

describe("social card constants", () => {
  it("mirrors the dark palette tokens", () => {
    expect(OG_COLORS.background).toBe(darkToken("color-background"));
    expect(OG_COLORS.foreground).toBe(darkToken("color-foreground"));
  });

  it("is the 1200 by 630 share size", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("ships a designed card at exactly that size", () => {
    const png = readFileSync("public/coil/og-share.png");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(OG_SIZE);
  });
});
