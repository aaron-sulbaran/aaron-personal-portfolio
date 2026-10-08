import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { headingParts } from "@/lib/home/heading";

describe("the hero heading's parts", () => {
  it("splits the heading into the greeting, the gap, the name and what follows", () => {
    const parts = headingParts(siteContent.hero);
    expect(parts).toEqual({ greeting: "Hi, I'm", between: " ", name: "Aaron", after: "." });
    expect(parts.greeting + parts.between + parts.name + parts.after).toBe(siteContent.hero.heading);
  });

  it("refuses copy whose heading is not the greeting then the name", () => {
    expect(() => headingParts({ heading: "Hello there.", greeting: "Hi, I'm", name: "Aaron" })).toThrow();
    expect(() => headingParts({ heading: "Hi, I'm Sam.", greeting: "Hi, I'm", name: "Aaron" })).toThrow();
  });
});
