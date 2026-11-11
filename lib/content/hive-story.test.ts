import { describe, expect, it } from "vitest";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { CLOCK } from "@/lib/hive-story/flow";
import { walkStrings } from "@/lib/testing/walk";

// /hive-visual is public: these pin the rules from its brief, not the wording.
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
    expect(hiveStoryCopy.numbers.items.map((item) => item.value)).toEqual(["675", "24", "339", "$0"]);
    expect(hiveStoryCopy.steps.proof).toContain("15 random facts found none wrong");
  });

  it("says the team page screenshots use a made-up team, and stays private", () => {
    expect(hiveStoryCopy.team.note).toMatch(/made-up team and made-up facts/);
    expect(hiveStoryCopy.team.note).toMatch(/private/);
    for (const shot of Object.values(hiveStoryCopy.team.shots)) expect(shot.src.startsWith("/hive-story/")).toBe(true);
  });

  it("has a caption for every moment on the clock", () => {
    for (const entry of CLOCK) expect(hiveStoryCopy.flow.captions[entry.caption]).toBeTruthy();
  });

  it("links back to every part of the portfolio by path, and out over https", () => {
    expect(hiveStoryCopy.more.site.map((link) => link.href)).toEqual(["/#about", "/#work", "/#numbers", "/#connect", "/quick"]);
    expect(hiveStoryCopy.backLink.href).toBe("/");
    for (const link of hiveStoryCopy.more.products) expect(link.href.startsWith("https://")).toBe(true);
  });
});
