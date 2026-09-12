import { describe, expect, it } from "vitest";
import { parseSiteMode } from "./holding";
import { siteContent } from "./content";

describe("parseSiteMode", () => {
  it("holds by default; only the exact 'full' value opts into the full site", () => {
    expect(parseSiteMode(undefined)).toBe("holding");
    expect(parseSiteMode("")).toBe("holding");
    expect(parseSiteMode("holding")).toBe("holding");
    expect(parseSiteMode("Full")).toBe("holding");
    expect(parseSiteMode("full")).toBe("full");
  });
});

describe("holding page socials", () => {
  it("every rendered link has an absolute https or mailto href", () => {
    for (const social of siteContent.holding.socials) {
      if (social.href === null) continue;
      expect(social.href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  it("never ships a placeholder handle", () => {
    for (const social of siteContent.holding.socials) {
      expect(social.href ?? "").not.toMatch(/todo|placeholder|your-handle/i);
    }
  });
});
