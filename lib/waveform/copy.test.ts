import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

const { listen, soundtrack } = siteContent;

describe("the soundtrack band's copy", () => {
  it("credits every playable track and its artist under CC BY 4.0", () => {
    for (const track of soundtrack.tracks) {
      expect(soundtrack.creditLead).toContain(`“${track.title}”`);
      expect(soundtrack.creditArtist).toBe(track.artist);
    }
    expect(soundtrack.creditLicense).toBe("CC BY 4.0");
    expect(soundtrack.creditLicenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("never promises a player the band does not show", () => {
    for (const note of [listen.acceptedNote, listen.pausedNote, listen.declinedNote]) {
      expect(note).not.toMatch(/bottom of your screen|menu up top/);
    }
  });

  it("uses sentence case and no em dash", () => {
    const strings = Object.values(listen).concat([soundtrack.creditLead, soundtrack.creditJoin]);
    for (const text of strings) {
      expect(text).not.toMatch(/—/);
      expect(text[0]).toBe(text[0].toUpperCase());
    }
  });
});
