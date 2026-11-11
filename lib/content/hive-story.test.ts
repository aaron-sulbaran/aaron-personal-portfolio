import { describe, expect, it } from "vitest";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { CLOCK } from "@/lib/hive-story/flow";
import { walkStrings } from "@/lib/testing/walk";

// /hive-story is public: these pin the rules from its brief, not the wording.
const leaves = walkStrings(hiveStoryCopy);

describe("the Hive story's copy", () => {
  it("has no em or en dashes", () => {
    expect(leaves.filter((leaf) => /[–—]/.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
  });

  it("names no company and no AI vendor", () => {
    const banned = /\b(google|capital one|anthropic|claude|openai|chatgpt|apple|microsoft|amazon|meta)\b/i;
    expect(leaves.filter((leaf) => banned.test(leaf.text)).map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });

  it("says who built it, in the first person, up front", () => {
    expect(hiveStoryCopy.lede.startsWith("I built")).toBe(true);
    expect(hiveStoryCopy.framing).toContain("visualization");
  });

  it("only uses the numbers the Hive's own docs publish", () => {
    expect(hiveStoryCopy.numbers.items.map((item) => item.value)).toEqual(["675", "24", "0 of 15", "339", "$0"]);
  });

  it("has a caption for every moment on the clock", () => {
    for (const entry of CLOCK) expect(hiveStoryCopy.flow.captions[entry.caption]).toBeTruthy();
  });

  it("links within the site by path and out of it over https", () => {
    for (const link of hiveStoryCopy.more.links) {
      if (link.external) expect(link.href.startsWith("https://")).toBe(true);
      else expect(link.href.startsWith("/")).toBe(true);
    }
  });
});
