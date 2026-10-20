import type { SoundtrackTrack } from "@/lib/content/types";

// The player's track list, pure. Rows keep the playing order of the tracks;
// the current one is marked, never moved, so the list does not shuffle under
// the visitor's pointer as songs change.

export interface TrackRow {
  index: number;
  number: number; // 1-based, as the visitor counts
  title: string;
  artist: string;
  cover: string | null;
  spotifyUrl: string | null;
  current: boolean;
}

export function trackRows(tracks: readonly SoundtrackTrack[], currentIndex: number): TrackRow[] {
  return tracks.map((track, index) => ({
    index,
    number: index + 1,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    spotifyUrl: track.spotifyUrl,
    current: index === currentIndex,
  }));
}

export function wrapIndex(index: number, length: number): number {
  return length === 0 ? 0 : ((index % length) + length) % length;
}

// What pressing a row does: its own row toggles playback, another row switches to it and plays.
export type RowAction = "pause" | "resume" | "switch";

export function rowAction(rowIndex: number, currentIndex: number, playing: boolean): RowAction {
  if (rowIndex !== currentIndex) return "switch";
  return playing ? "pause" : "resume";
}
