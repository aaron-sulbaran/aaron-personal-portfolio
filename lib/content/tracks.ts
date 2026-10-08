import { register, registerHas, resolveTip } from "./register";
import type { SoundtrackTrack } from "./types";

// The tracks the player ships today (public/audio/LICENSES.md): Lee Rosevere,
// CC BY 4.0, re-encoded to 160 kbps for the web.
export const liveTracks: readonly SoundtrackTrack[] = [
  {
    title: "Small Steps", artist: "Lee Rosevere", src: "/audio/track-01.mp3",
    credit: "\"Small Steps\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
  {
    title: "Waves of Sleep", artist: "Lee Rosevere", src: "/audio/track-02.mp3",
    credit: "\"Waves of Sleep\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
  {
    title: "Slow Lights", artist: "Lee Rosevere", src: "/audio/track-03.mp3",
    credit: "\"Slow Lights\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
];

const CC_BY = /^cc-by-(\d)\.0$/;

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
  return problems;
}

export function hasAdaptedTrack(tracks: readonly SoundtrackTrack[]): boolean {
  return tracks.some((track) => track.licenseKind === "adapted");
}

// Removing any other track on request must leave the band one it may play.
export function hasFullyLicensedTrack(tracks: readonly SoundtrackTrack[]): boolean {
  return tracks.some((track) => track.licenseKind !== "adapted");
}

// A tip's words as a visitor should read them now: the music note's adapting
// clause shows only while an adapted track is in the player.
export function tipText(key: string): string | null {
  if (!registerHas("tip", key)) return null;
  return resolveTip(register.tip[key], hasAdaptedTrack(liveTracks));
}
