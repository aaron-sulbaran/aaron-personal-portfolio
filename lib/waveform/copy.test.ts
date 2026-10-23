import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

const { listen, soundtrack } = siteContent;

describe("the soundtrack band's copy", () => {
  it("credits each song to its artist", () => {
    for (const track of soundtrack.tracks) expect(track.credit).toContain(`"${track.title}" by ${track.artist}`);
  });

  it("says one line and one word per control: no sub-line, no note that could promise a player the band does not show", () => {
    expect(Object.keys(listen).sort()).toEqual(["accept", "ariaLabel", "decline", "freeze", "line", "pause", "resume", "unfreeze"]);
  });

  it("uses sentence case and no em dash", () => {
    for (const text of Object.values(listen)) {
      expect(text).not.toMatch(/\u2014/);
      expect(text[0]).toBe(text[0].toUpperCase());
    }
  });
});
