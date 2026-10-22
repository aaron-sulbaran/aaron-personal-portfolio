import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

const { listen, soundtrack } = siteContent;

describe("the soundtrack band's copy", () => {
  it("credits each song to its artist", () => {
    for (const track of soundtrack.tracks) expect(track.credit).toContain(`"${track.title}" by ${track.artist}`);
  });

  it("never promises a player the band does not show", () => {
    for (const note of [listen.acceptedNote, listen.pausedNote, listen.declinedNote]) {
      expect(note).not.toMatch(/bottom of your screen|menu up top/);
    }
  });

  it("uses sentence case and no em dash", () => {
    // The prompt's line is three pieces around one button ("It moves with you, or ", "freeze it", "."): only the first starts a sentence.
    const { subline, ...whole } = listen;
    const strings: string[] = [...Object.values(whole), subline.moves];
    for (const text of strings) {
      expect(text).not.toMatch(/\u2014/);
      expect(text[0]).toBe(text[0].toUpperCase());
    }
    for (const text of Object.values(subline)) expect(text).not.toMatch(/\u2014/);
    expect(subline.moves + subline.freeze + subline.end).toBe("It moves with you, or freeze it.");
  });
});
