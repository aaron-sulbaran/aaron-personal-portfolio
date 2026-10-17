import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

const { listen, soundtrack } = siteContent;

describe("the soundtrack band's copy", () => {
  it("credits the songs to their artists and claims no license", () => {
    expect(soundtrack.creditLine).toBe("Songs I like, as instrumentals, credited to their artists in the player.");
    expect(soundtrack.creditLine).not.toMatch(/licen[sc]|\bCC\b|royalt|copyright|adapted/i);
    for (const track of soundtrack.tracks) expect(track.credit).toContain(`"${track.title}" by ${track.artist}`);
  });

  it("never promises a player the band does not show", () => {
    for (const note of [listen.acceptedNote, listen.pausedNote, listen.declinedNote]) {
      expect(note).not.toMatch(/bottom of your screen|menu up top/);
    }
  });

  it("uses sentence case and no em dash", () => {
    const strings: string[] = [...Object.values(listen), soundtrack.creditLine];
    for (const text of strings) {
      expect(text).not.toMatch(/\u2014/);
      expect(text[0]).toBe(text[0].toUpperCase());
    }
  });
});
