import { describe, expect, it } from "vitest";
import { parseSiteMode } from "./holding";
import { siteContent } from "./content";

describe("parseSiteMode", () => {
  it("only the exact 'holding' value selects the holding page", () => {
    expect(parseSiteMode("holding")).toBe("holding");
    expect(parseSiteMode("full")).toBe("full");
    expect(parseSiteMode("Holding")).toBe("full");
    expect(parseSiteMode("")).toBe("full");
    expect(parseSiteMode(undefined)).toBe("full");
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
