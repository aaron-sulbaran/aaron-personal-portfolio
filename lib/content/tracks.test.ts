import { describe, expect, it } from "vitest";
import { siteContent, tipText, type SoundtrackTrack } from "@/lib/content";
import { creditProblems, hasAdaptedTrack, hasFullyLicensedTrack, liveTracks } from "@/lib/content/tracks";

const live: readonly SoundtrackTrack[] = siteContent.soundtrack.tracks;

// music.md's approved track 1; its record and file land together in C7.
const sunsetPier: SoundtrackTrack = {
  title: "Sunset Pier", artist: "Philman (Philip Milman)", src: "/audio/sunset-pier.mp3",
  credit: "\"Sunset Pier\" by Philman (Philip Milman), from Lud and Schlatt Crossing, funded by Ludwig and Jschlatt. Licensed CC BY 3.0. Compressed for web.",
  licenseKind: "cc-by-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  why: "Ludwig and Jschlatt funded 20 minutes of music any creator can use for free. I needed music I could use, and that was the first place I looked. I like Ludwig for this kind of thing.",
  inspiredBy: null, spotifyUrl: null, cover: null,
};

// A neutral fixture: an adapted track is credited to its original's author, never to Aaron.
const adapted = (credit: string): SoundtrackTrack => ({
  title: "Night Drive", artist: "Example Artist", src: "/audio/night-drive.mp3", credit,
  licenseKind: "adapted", licenseUrl: null, why: null, inspiredBy: null, spotifyUrl: null, cover: null,
});

describe("soundtrack credits", () => {
  it("credit the three live tracks in full", () => {
    expect(live).toBe(liveTracks);
    expect(live.map((track) => track.credit)).toEqual([
      "\"Small Steps\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
      "\"Waves of Sleep\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
      "\"Slow Lights\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    ]);
    for (const track of live) {
      expect([track.licenseKind, track.why, track.inspiredBy]).toEqual(["cc-by-4.0", null, null]);
      expect(creditProblems(track)).toEqual([]);
    }
  });

  it("accept the approved Sunset Pier credit as written", () => {
    expect(creditProblems(sunsetPier)).toEqual([]);
  });

  it("name the CC BY deed the credit claims", () => {
    expect(creditProblems({ ...sunsetPier, licenseUrl: "https://creativecommons.org/licenses/by/4.0/" })).toContain("licenseUrl must be the CC BY deed");
    expect(creditProblems({ ...sunsetPier, credit: "\"Sunset Pier\" by Philman (Philip Milman). Compressed for web." })).toContain("credit must say Licensed CC BY 3.0.");
  });

  it("never credit an adapted track as licensed", () => {
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran. Licensed for this site."))).toContain("an adapted track is never credited as licensed");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist."))).toContain("an adapted track says it is adapted");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran."))).toEqual([]);
  });

  it("keep at least one fully licensed track in the set", () => {
    expect(hasFullyLicensedTrack(live)).toBe(true);
    expect(hasFullyLicensedTrack([adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran.")])).toBe(false);
    expect(hasAdaptedTrack(live)).toBe(false);
  });

  it("tip the music note without the adapting clause while no adapted track plays", () => {
    expect(tipText("music-note")).toBe("I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to. The credits are in the corner.");
    expect(tipText("killer-drones")).toBe("unless it's killer drones, I don't do that");
    expect(tipText("constructor")).toBeNull();
  });
});
