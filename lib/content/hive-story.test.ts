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

  it("lists the team page under Running now, and its diagram part says nothing about next, since it is live", () => {
    const titles = (items: readonly { title: string }[]) => items.map((item) => item.title);
    expect(titles(hiveStoryCopy.status.now.items)).toContain("The team page");
    expect(titles(hiveStoryCopy.status.next.items)).not.toContain("The team page");
    const { page } = hiveStoryCopy.flow.nodes;
    expect(`${page.sub} ${page.subShort}`).not.toMatch(/next/i);
  });

  it("states the author's check, the fast lane and who decides as plain facts, with no tagline shape", () => {
    const { flow, status, scenarios } = hiveStoryCopy;
    const body = (title: string) => status.next.items.find((item) => item.title === title)?.body ?? "";
    const beekeeper = [flow.captions[4], body("Beekeeper asks the author")];
    const lane = body("The fast lane");
    for (const old of ["A tap confirms", "a reply corrects", "the correction wins", "not overnight", "pays off"]) {
      expect(leaves.filter((leaf) => leaf.text.includes(old)).map((leaf) => leaf.path), old).toEqual([]);
    }
    // The author confirms a note with one reaction, or replies to correct it; the demo's steps say it too.
    for (const line of beekeeper) expect(line).toMatch(/one reaction/);
    const steps = hiveStoryCopy.calls.loop.steps;
    expect(steps[3]).toMatch(/one reaction/);
    expect(steps[4]).toMatch(/replies to correct/);
    // The Hive lead's fact check: the hourly read covers Discord and Drive only, so an AI session's
    // notes get in when someone posts them there; sending them straight, in minutes, is next.
    expect(lane).toBe("Today the Hive reads the team's Discord and Drive folder every hour, so an AI session's notes get in only when someone posts them there. Sending notes straight from an AI session, checked within minutes, is designed and next to build.");
    expect(leaves.filter((leaf) => /copies session notes/.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
    // Teammates have the final say on what goes into the Hive.
    expect(scenarios.intro).toMatch(/final say/);
    // No "X, not Y" contrast in any of them.
    expect([...beekeeper, lane, scenarios.intro].filter((line) => /, not /.test(line))).toEqual([]);
  });

  it("marks the Beekeeper demo as planned, since the connector and the author's confirm and correct posts are not built", () => {
    const { loop } = hiveStoryCopy.calls;
    expect(loop.tag.startsWith("Next")).toBe(true);
    expect(loop.note).toMatch(/planned/);
    expect(loop.note).toMatch(/next to build/);
    expect(loop.note).toMatch(/made up/);
    // The AI sessions part stays next too.
    expect(hiveStoryCopy.flow.nodes.notes.sub).toMatch(/next/);
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
