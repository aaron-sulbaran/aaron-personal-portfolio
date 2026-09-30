import { useId } from "react";

// The soundtrack's icon: one quarter note (a tilted oval head unioned with a
// stem on its right, no flag, no beam) drawn as a single silhouette, so the
// outlined state traces the whole note rather than reading as a hollow half
// note. On, the silhouette fills in currentColor (the caller sets the accent)
// and may sway; off, it drains to an outline and a slash draws through it
// from the top left, with a knockout gap in the note along the slash so the
// line still reads at 15px. The motion lives in globals.css (.note-icon).
const NOTE_PATH = "M8.93 2.6H10.53V15.58A4.4 3.15 -22 1 1 8.93 14.02Z";
const SLASH_PATH = "M1.2 3.6L12.8 19.4";

export function NoteIcon({ on, living = false, className }: { on: boolean; living?: boolean; className?: string }) {
  const maskId = `note-knockout-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 14 22"
      aria-hidden="true"
      focusable="false"
      data-on={on}
      data-living={living && on}
      className={`note-icon ${className ?? ""}`}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-2" y="-2" width="18" height="26">
        <rect x="-2" y="-2" width="18" height="26" fill="white" />
        <path className="note-slash" d={SLASH_PATH} pathLength={1} stroke="black" strokeWidth={3.2} strokeLinecap="round" />
      </mask>
      <g className="note-sway">
        <path
          className="note-body"
          d={NOTE_PATH}
          mask={`url(#${maskId})`}
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
        <path
          className="note-slash"
          d={SLASH_PATH}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
