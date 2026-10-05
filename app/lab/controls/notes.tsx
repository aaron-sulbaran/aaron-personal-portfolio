import type { ReactNode } from "react";

// The note candidates, drawn on a 24 by 24 grid in currentColor. Line notes
// keep lucide's hand (2px stroke, round caps and joins, so they sit with the
// arrows and the chevrons the site already uses); solid notes are filled
// silhouettes heavy enough to stand beside Profa Black. `ink` is each
// drawing's horizontal extent including stroke, so a state indicator can sit
// a fixed gap to its right.
export type NoteOption = {
  key: string;
  name: string;
  line: string;
  weight: "line" | "solid";
  ink: [number, number];
  draw: () => ReactNode;
};

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const NOTES: readonly NoteOption[] = [
  {
    key: "line-quarter",
    name: "Line quarter",
    line: "One note in lucide's hand: an open tilted head and a stem. The calmest option; reads as an icon, not a symbol.",
    weight: "line",
    ink: [7.5, 16.5],
    draw: () => (
      <g {...LINE}>
        <ellipse cx="12" cy="17.4" rx="3.6" ry="2.7" transform="rotate(-22 12 17.4)" />
        <path d="M15.5 16.8V3.5" />
      </g>
    ),
  },
  {
    key: "line-eighth",
    name: "Line eighth",
    line: "The quarter plus a flag that swings out and down. The flag is what makes it a note at 14px rather than a lollipop.",
    weight: "line",
    ink: [6.2, 19.4],
    draw: () => (
      <g {...LINE}>
        <ellipse cx="10.4" cy="17.4" rx="3.6" ry="2.7" transform="rotate(-22 10.4 17.4)" />
        <path d="M13.9 16.8V3.2c.5 2.6 2.1 3.7 3.4 4.9 1.3 1.2 1.8 2.9 1.1 4.9" />
      </g>
    ),
  },
  {
    key: "line-beamed",
    name: "Line beamed pair",
    line: "Two eighths under one beam, the classic music glyph, drawn with tilted heads so it is not lucide's stock icon.",
    weight: "line",
    ink: [2.5, 20.7],
    draw: () => (
      <g {...LINE}>
        <ellipse cx="6.6" cy="18" rx="3.1" ry="2.35" transform="rotate(-22 6.6 18)" />
        <ellipse cx="16.6" cy="16" rx="3.1" ry="2.35" transform="rotate(-22 16.6 16)" />
        <path d="M9.6 17.5V5.8L19.6 3.8v11.7" />
      </g>
    ),
  },
  {
    key: "solid-quarter",
    name: "Solid quarter",
    line: "The current idea redrawn properly: a full oval head, a stem flush with its edge, real weight. Plain and sturdy.",
    weight: "solid",
    ink: [7.9, 16.2],
    draw: () => (
      <g fill="currentColor">
        <ellipse cx="12" cy="17.2" rx="4.3" ry="3.15" transform="rotate(-24 12 17.2)" />
        <rect x="13.85" y="2.6" width="2.3" height="14.2" rx="1.15" />
      </g>
    ),
  },
  {
    key: "solid-eighth",
    name: "Solid eighth",
    line: "A filled head, a stem and a teardrop flag. The most note-like silhouette at every size, and heavy enough for Profa.",
    weight: "solid",
    ink: [5.6, 19.4],
    draw: () => (
      <g fill="currentColor">
        <ellipse cx="9.8" cy="17.2" rx="4.3" ry="3.15" transform="rotate(-24 9.8 17.2)" />
        <rect x="11.65" y="2.6" width="2.3" height="14.2" rx="1.15" />
        <path d="M12.6 2.75c.9-.35 1.55.05 1.75.9.45 2 1.7 2.95 3 4 1.75 1.4 2.85 3.3 1.9 6.25-.2.6-1.05.5-1-.15.25-2.15-.6-3.55-2.15-4.55-.95-.6-2.05-.95-3.5-1.15Z" />
      </g>
    ),
  },
  {
    key: "solid-beamed",
    name: "Solid beamed pair",
    line: "Two filled eighths under a heavy slanted beam. Reads as music instantly, but it is wide and busy below 16px.",
    weight: "solid",
    ink: [2.9, 21.1],
    draw: () => (
      <g fill="currentColor">
        <ellipse cx="6.4" cy="18.3" rx="3.5" ry="2.6" transform="rotate(-24 6.4 18.3)" />
        <ellipse cx="17.2" cy="16.1" rx="3.5" ry="2.6" transform="rotate(-24 17.2 16.1)" />
        <rect x="7.75" y="6" width="2.05" height="11.8" rx="0.6" />
        <rect x="18.55" y="3.8" width="2.05" height="11.8" rx="0.6" />
        <path d="M7.75 5.2 20.6 2.6v3.7L7.75 8.9Z" />
      </g>
    ),
  },
  {
    key: "mark-note",
    name: "Bolt eighth",
    line: "Personal: the solid eighth with its flag cut as a lightning zig, the AS mark's bolt in the note's own gesture.",
    weight: "solid",
    ink: [5.6, 19.1],
    draw: () => (
      <g>
        <g fill="currentColor">
          <ellipse cx="9.8" cy="17.2" rx="4.3" ry="3.15" transform="rotate(-24 9.8 17.2)" />
          <rect x="11.65" y="2.6" width="2.3" height="14.2" rx="1.15" />
        </g>
        <path fill="currentColor" d="M13.2 2.6H13.9L18 7.5 16.4 8.4 19.1 14.1 13.2 8.4Z" />
      </g>
    ),
  },
  {
    key: "wave-beam",
    name: "Wave beam",
    line: "Personal: a beamed pair whose beam is the site's wave, the music and the waveform that follows you in one glyph.",
    weight: "line",
    ink: [2.5, 20.7],
    draw: () => (
      <g {...LINE}>
        <ellipse cx="6.6" cy="18" rx="3.1" ry="2.35" transform="rotate(-22 6.6 18)" />
        <ellipse cx="16.6" cy="16" rx="3.1" ry="2.35" transform="rotate(-22 16.6 16)" />
        <path d="M9.6 17.5V5.4M19.6 15.5V4.4" />
        <path d="M9.6 5.4c1.7-1.7 3.3-1.7 5-.5s3.3 1.2 5-.5" />
      </g>
    ),
  },
];

export const CURRENT_KEY = "current";
export const NOTE_KEYS = [CURRENT_KEY, ...NOTES.map((n) => n.key)];

export function noteByKey(key: string): NoteOption | null {
  return NOTES.find((n) => n.key === key) ?? null;
}

export function noteName(key: string): string {
  return key === CURRENT_KEY ? "Current NoteIcon" : (noteByKey(key)?.name ?? key);
}
