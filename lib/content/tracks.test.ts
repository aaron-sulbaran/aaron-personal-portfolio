import { describe, expect, it } from "vitest";
import { siteContent, tipText, type SoundtrackTrack } from "@/lib/content";
import { creditProblems, hasAdaptedTrack, liveTracks } from "@/lib/content/tracks";

const live: readonly SoundtrackTrack[] = siteContent.soundtrack.tracks;

const credited = (credit: string): SoundtrackTrack => ({
  title: "Night Drive", artist: "Example Artist", src: "/audio/night-drive.mp3", credit,
  licenseKind: "credited", licenseUrl: null, why: null, inspiredBy: null, spotifyUrl: null, cover: null,
});

const ccBy: SoundtrackTrack = {
  title: "Night Drive", artist: "Example Artist", src: "/audio/night-drive.mp3",
  credit: "\"Night Drive\" by Example Artist. Licensed CC BY 3.0. Compressed for web.",
  licenseKind: "cc-by-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  why: null, inspiredBy: null, spotifyUrl: null, cover: null,
};

// A neutral fixture: an adapted track is credited to its original's author, never to Aaron.
const adapted = (credit: string): SoundtrackTrack => ({
  title: "Night Drive", artist: "Example Artist", src: "/audio/night-drive.mp3", credit,
  licenseKind: "adapted", licenseUrl: null, why: null, inspiredBy: null, spotifyUrl: null, cover: null,
});

describe("soundtrack credits", () => {
  it("credits the seven live tracks to their artists", () => {
    expect(live).toBe(liveTracks);
    expect(live.map((track) => track.credit)).toEqual([
      "\"Mia & Sebastian's Theme\" by Justin Hurwitz, from La La Land (Original Motion Picture Soundtrack). Instrumental.",
      "\"Loving Is Easy\" by Rex Orange County feat. Benny Sings. Instrumental.",
      "\"Cherry Wine\" by grentperez. Instrumental.",
      "\"2SEATER\" by Tyler, The Creator, from Cherry Bomb. Instrumental.",
      "\"No soy de aquí ni soy de allá\" by Facundo Cabral, from Epoca De Oro. Instrumental.",
      "\"Chachachá\" by Jósean Log, from Háblate de Mí. Instrumental.",
      "\"TURiSTA\" by Bad Bunny, from DeBÍ TiRAR MáS FOToS. Instrumental.",
    ]);
    expect(live.map((track) => track.src)).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `/audio/track-0${n}.mp3`));
    for (const track of live) {
      expect(track.licenseKind).toBe("credited");
      expect(track.licenseUrl).toBeNull();
      expect(creditProblems(track)).toEqual([]);
      expect(track.spotifyUrl).toMatch(/^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/);
    }
  });

  it("claims no license, adaptation or retired track anywhere in the data", () => {
    const text = live.map((track) => [track.title, track.artist, track.credit, track.why ?? ""].join(" ")).join(" ");
    expect(text).not.toMatch(/licen[sc]|\bCC\b|royalt|copyright|adapted/i);
  });

  it("require a credited track to quote the title and name the artist", () => {
    expect(creditProblems(credited("\"Night Drive\" by Example Artist. Instrumental."))).toEqual([]);
    expect(creditProblems(credited("Night Drive by Example Artist. Instrumental."))).toContain("credit must quote the title");
    expect(creditProblems(credited("\"Night Drive\". Instrumental."))).toContain("credit must name the artist");
  });

  it("forbid license words and adapted framing in a credited track", () => {
    for (const word of ["Licensed", "license", "CC BY", "royalty-free", "copyright-free"]) {
      expect(creditProblems(credited(`"Night Drive" by Example Artist. ${word}.`)), word).toContain("a credited track claims no license");
    }
    expect(creditProblems(credited("\"Night Drive\" by Example Artist, adapted by me."))).toContain("a credited track is not credited as adapted");
    expect(creditProblems({ ...credited("\"Night Drive\" by Example Artist."), licenseUrl: "https://example.com" })).toContain("a credited track has no licenseUrl");
  });

  it("still holds a CC BY credit to its deed", () => {
    expect(creditProblems(ccBy)).toEqual([]);
    expect(creditProblems({ ...ccBy, licenseUrl: "https://creativecommons.org/licenses/by/4.0/" })).toContain("licenseUrl must be the CC BY deed");
  });

  it("never credit an adapted track as licensed", () => {
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran. Licensed for this site."))).toContain("an adapted track is never credited as licensed");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist."))).toContain("an adapted track says it is adapted");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran."))).toEqual([]);
  });

  it("show no adapting clause while no adapted track plays", () => {
    expect(hasAdaptedTrack(live)).toBe(false);
    expect(hasAdaptedTrack([adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran.")])).toBe(true);
  });

  it("tip the music note as songs I like, credited to their artists", () => {
    expect(tipText("music-note")).toBe("These are songs I like, played as instrumentals so they're easy to read to. Each is credited to its artist in the player, with a link to the original on Spotify.");
    expect(tipText("music-note")).not.toMatch(/licen[sc]|royalt|copyright|adapted/i);
    expect(tipText("killer-drones")).toBe("unless it's killer drones, I don't do that");
    expect(tipText("constructor")).toBeNull();
  });
});
