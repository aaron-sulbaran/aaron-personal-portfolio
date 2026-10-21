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
    const strings: string[] = Object.values(listen);
    for (const text of strings) {
      expect(text).not.toMatch(/\u2014/);
      expect(text[0]).toBe(text[0].toUpperCase());
    }
  });
});
