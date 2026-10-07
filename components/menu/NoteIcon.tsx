import { useId } from "react";
import { NOTE_INK, type NoteState } from "@/lib/note";

// The soundtrack's note: the bolt eighth (lab "mark-note"), a filled eighth
// whose flag is cut as the AS mark's bolt. Playing, it is the plain note in
// the accent. Paused and off, it is muted with a slash from bottom left to top
// right in the same ink, knocked out of the note so the line reads at 16px.
// The slash draws in and out over 200ms (globals.css, .note-icon). Nothing
// sits beside the note, so whatever holds it keeps its width in every state.
const VIEWBOX = "3 1.5 18.5 21";
const SLASH = "M4.2 21L20.2 3";

export function NoteIcon({ state, className = "" }: { state: NoteState; className?: string }) {
  const maskId = `note-knockout-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox={VIEWBOX} aria-hidden="true" focusable="false" data-note={state} className={`note-icon ${NOTE_INK[state]} ${className}`}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="2" y="0.5" width="20.5" height="23">
        <rect x="2" y="0.5" width="20.5" height="23" fill="white" />
        <path className="note-slash" d={SLASH} pathLength={1} stroke="black" strokeWidth={3.4} strokeLinecap="round" />
      </mask>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <ellipse cx="9.8" cy="17.2" rx="4.3" ry="3.15" transform="rotate(-24 9.8 17.2)" />
        <rect x="11.65" y="2.6" width="2.3" height="14.2" rx="1.15" />
        <path d="M13.2 2.6H13.9L18 7.5 16.4 8.4 19.1 14.1 13.2 8.4Z" />
      </g>
      <path data-note-slash className="note-slash" d={SLASH} pathLength={1} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
