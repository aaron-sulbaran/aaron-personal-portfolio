import type { SoundtrackState } from "./soundtrack";

// The soundtrack note's three faces (lab log, "State glyph ruling"): playing
// is the plain note in the accent; paused and off are the note in muted ink
// with a slash, bottom left to top right, in that same ink. Nothing ever sits
// beside the note.
export type NoteState = "playing" | "paused" | "off";

export const NOTE_SLASH_MS = 200;

export const NOTE_INK: Record<NoteState, "text-accent" | "text-muted"> = {
  playing: "text-accent",
  paused: "text-muted",
  off: "text-muted",
};

export function noteState(music: SoundtrackState): NoteState {
  if (music === "on") return "playing";
  if (music === "paused") return "paused";
  return "off";
}

export const hasSlash = (state: NoteState) => state !== "playing";
