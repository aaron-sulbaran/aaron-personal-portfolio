import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { OG_COLORS, OG_SIZE, firstSentence } from "./constants";

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
    expect(OG_COLORS.accent).toBe(darkToken("color-accent"));
  });

  it("is the 1200 by 630 share size", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("takes the card's line from the meta description, whole sentence only", () => {
    const line = firstSentence(siteContent.meta.description);
    expect(siteContent.meta.description.startsWith(line)).toBe(true);
    expect(line.endsWith(".")).toBe(true);
    expect(firstSentence("No stop here")).toBe("No stop here");
  });
});
