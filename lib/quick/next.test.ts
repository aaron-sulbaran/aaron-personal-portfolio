import { describe, expect, it } from "vitest";
import { quickNextVariants } from "@/lib/content/quick";
import { DEFAULT_CUSTOM_NEXT, NEXT_CHOICES, nextLines, parseNextChoice } from "./next";

describe("what's next", () => {
  it("ships the two-tracks variant, and offers the four named ones then custom", () => {
    expect(parseNextChoice(undefined)).toBe("two-tracks");
    expect(parseNextChoice("nonsense")).toBe("two-tracks");
    expect(NEXT_CHOICES).toEqual(["two-tracks", "either-way", "builder", "original", "custom"]);
  });

  it("keeps the exact words of each variant", () => {
    expect(nextLines("two-tracks")).toEqual({
      short: "product and Applied AI engineering roles",
      full: "I want to build in one of two ways: as a product manager at a company that ships at scale, or as an engineer building Applied AI at a startup or frontier lab.",
    });
    expect(nextLines("either-way")).toEqual({
      short: "product or Applied AI engineering roles",
      full: "A product role, or a technical one building Applied AI. Either way, I want to bring people together around one goal.",
    });
    expect(nextLines("builder")).toEqual({
      short: "builder roles in product and Applied AI",
      full: "I'm looking for a builder role: product management at scale, or product and Applied AI engineering where the frontier is being built.",
    });
    expect(nextLines("original")).toEqual({
      short: "product and builder roles",
      full: "I'm looking for a product or builder role where I can bring people together and leverage different skillsets to build towards one goal.",
    });
  });

  it("takes the custom fields, trimmed, and starts them on the shipped variant", () => {
    expect(nextLines("custom", { customShort: "  a short one ", customFull: "A long one.\n" })).toEqual({ short: "a short one", full: "A long one." });
    expect(DEFAULT_CUSTOM_NEXT).toEqual({ customShort: nextLines("two-tracks").short, customFull: nextLines("two-tracks").full });
  });

  it("never starts A with Next, which the heading above it already says, and always writes Applied AI in capitals", () => {
    for (const variant of quickNextVariants) {
      expect(variant.full.startsWith("Next"), variant.id).toBe(false);
      expect(`${variant.short} ${variant.full}`.includes("applied AI"), variant.id).toBe(false);
    }
  });

  it("makes B a teaser of A, never a copy", () => {
    for (const variant of quickNextVariants) {
      expect(variant.full.includes(variant.short), variant.id).toBe(false);
      expect(variant.short.length, variant.id).toBeLessThan(variant.full.length / 2);
    }
  });
});
