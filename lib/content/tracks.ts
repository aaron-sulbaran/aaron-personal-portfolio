import { register, registerHas, resolveTip } from "./register";
import type { SoundtrackTrack } from "./types";

// The tracks the player ships (public/audio/CREDITS.md): instrumental versions
// of songs I like, credited to their artists. No license is claimed for any of
// them. Each track shows its album cover (public/audio/covers); a null cover falls
// back to the designed tile.
export const liveTracks: readonly SoundtrackTrack[] = [
  {
    title: "Mia & Sebastian's Theme",
    artist: "Justin Hurwitz",
    src: "/audio/track-01.mp3",
    credit: "\"Mia & Sebastian's Theme\" by Justin Hurwitz, from La La Land (Original Motion Picture Soundtrack). Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/1Vk4yRsz0iBzDiZEoFMQyv",
    cover: "/audio/covers/track-01.jpg",
  },
  {
    title: "Loving Is Easy",
    artist: "Rex Orange County feat. Benny Sings",
    src: "/audio/track-02.mp3",
    credit: "\"Loving Is Easy\" by Rex Orange County feat. Benny Sings. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/7ASFZh1D0DPZro7UXUKGmd",
    cover: "/audio/covers/track-02.jpg",
  },
  {
    title: "Cherry Wine",
    artist: "grentperez",
    src: "/audio/track-03.mp3",
    credit: "\"Cherry Wine\" by grentperez. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/5o5WaO9pzPhXSGIrTIYVce",
    cover: "/audio/covers/track-03.jpg",
  },
  {
    title: "2SEATER",
    artist: "Tyler, The Creator",
    src: "/audio/track-04.mp3",
    credit: "\"2SEATER\" by Tyler, The Creator, from Cherry Bomb. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/6Xw3iWrQKgArwlRhVuU9CK",
    cover: "/audio/covers/track-04.jpg",
  },
  {
    title: "No soy de aquí ni soy de allá",
    artist: "Facundo Cabral",
    src: "/audio/track-05.mp3",
    credit: "\"No soy de aquí ni soy de allá\" by Facundo Cabral, from Epoca De Oro. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/6ecQfWXmbhiBSCzL0h1YxN",
    cover: "/audio/covers/track-05.jpg",
  },
  {
    title: "Chachachá",
    artist: "Jósean Log",
    src: "/audio/track-06.mp3",
    credit: "\"Chachachá\" by Jósean Log, from Háblate de Mí. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/6aommJFM8i3iT4inKuDSXh",
    cover: "/audio/covers/track-06.jpg",
  },
  {
    title: "TURiSTA",
    artist: "Bad Bunny",
    src: "/audio/track-07.mp3",
    credit: "\"TURiSTA\" by Bad Bunny, from DeBÍ TiRAR MáS FOToS. Instrumental.",
    licenseKind: "credited",
    licenseUrl: null,
    why: null,
    inspiredBy: null,
    spotifyUrl: "https://open.spotify.com/track/3zRr8fzBc3O3Y9JrjLdoIO",
    cover: "/audio/covers/track-07.jpg",
  },
];

const CC_BY = /^cc-by-(\d)\.0$/;

// A credit-only track states attribution and nothing else: no license words.
const LICENSE_CLAIM = /licen[sc]|\bCC\b|royalt|copyright/i;

// Why a track's credit would mislead or fall short of its license; empty means it may ship.
export function creditProblems(track: SoundtrackTrack): string[] {
  const problems: string[] = [];
  if (!track.credit.includes(`"${track.title}"`)) problems.push("credit must quote the title");
  if (!track.credit.includes(track.artist)) problems.push("credit must name the artist");
  const ccBy = CC_BY.exec(track.licenseKind);
  if (ccBy) {
    const version = `${ccBy[1]}.0`;
    if (!track.credit.includes(`Licensed CC BY ${version}.`)) problems.push(`credit must say Licensed CC BY ${version}.`);
    if (track.licenseUrl !== `https://creativecommons.org/licenses/by/${version}/`) problems.push("licenseUrl must be the CC BY deed");
  }
  if (track.licenseKind === "adapted") {
    if (/\blicensed\b/i.test(track.credit)) problems.push("an adapted track is never credited as licensed");
    if (!/\badapted\b/i.test(track.credit)) problems.push("an adapted track says it is adapted");
  }
  if (track.licenseKind === "credited") {
    if (LICENSE_CLAIM.test(track.credit)) problems.push("a credited track claims no license");
    if (/\badapted\b/i.test(track.credit)) problems.push("a credited track is not credited as adapted");
    if (track.licenseUrl !== null) problems.push("a credited track has no licenseUrl");
  }
  return problems;
}

export function hasAdaptedTrack(tracks: readonly SoundtrackTrack[]): boolean {
  return tracks.some((track) => track.licenseKind === "adapted");
}

// A tip's words as a visitor should read them now: a tip's adapting clause
// shows only while an adapted track is in the player.
export function tipText(key: string): string | null {
  if (!registerHas("tip", key)) return null;
  return resolveTip(register.tip[key], hasAdaptedTrack(liveTracks));
}
