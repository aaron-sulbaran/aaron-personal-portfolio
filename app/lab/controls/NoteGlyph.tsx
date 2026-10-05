import type { CSSProperties } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { CURRENT_KEY, noteByKey } from "./notes";
import type { NoteAnim } from "./settings";

export type MusicState = "off" | "on" | "paused";

// One note candidate in one state with one state animation. Arcs and levels
// widen the box to hold their indicator to the right of the note's ink; the
// note itself never moves for them. The current NoteIcon is shown exactly as
// the site draws it (its own slash and sway), as the control.
const PAD = 1.5;
const GAP = 2.2;
const IND_W = 8.4;
const CY = 10.5;

export function NoteGlyph({
  noteKey,
  state,
  anim,
  size,
  className = "",
}: {
  noteKey: string;
  state: MusicState;
  anim: NoteAnim;
  size: number;
  className?: string;
}) {
  const note = noteByKey(noteKey);
  if (noteKey === CURRENT_KEY || !note) {
    const h = Math.round(size * 0.75 * 10) / 10;
    return (
      <span className={`inline-flex flex-none items-center justify-center ${className}`} style={{ width: Math.round(h * 0.64 * 10) / 10, height: size }}>
        <span className="block" style={{ width: "100%", height: h }}>
          <NoteIcon on={state === "on"} living className={`block h-full w-full ${state === "on" ? "text-accent" : "text-muted"}`} />
        </span>
      </span>
    );
  }

  const indicator = anim === "arcs" || anim === "levels";
  const inkW = note.ink[1] - note.ink[0];
  const dx = indicator ? PAD - note.ink[0] : 0;
  const ix = PAD + inkW + GAP;
  const width = indicator ? ix + IND_W + PAD : 24;
  const stroke = note.weight === "solid" ? 2.4 : 2;
  const bar = note.weight === "solid" ? 2.4 : 2.1;

  return (
    <svg
      viewBox={`0 0 ${width} 24`}
      width={(size * width) / 24}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-state={state}
      data-anim={anim}
      className={`note block flex-none ${className}`}
    >
      <g transform={dx ? `translate(${dx} 0)` : undefined}>
        <g className="mv">{note.draw()}</g>
      </g>
      {anim === "arcs" && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path className="ind-x" d={`M${ix + 0.4} ${CY - 2.5}l5 5M${ix + 5.4} ${CY - 2.5}l-5 5`} />
          <path className="ind-arc ind-arc-1" d={`M${ix + 0.4} ${CY - 3.2}a4.6 4.6 0 0 1 0 6.4`} />
          <path className="ind-arc ind-arc-2" d={`M${ix + 3.2} ${CY - 6}a8.2 8.2 0 0 1 0 12`} />
        </g>
      )}
      {anim === "levels" && (
        <g className="lv-wrap" fill="currentColor">
          {[
            { x: ix, h: 10, ms: 520, delay: -260 },
            { x: ix + 3, h: 13.5, ms: 700, delay: -90 },
            { x: ix + 6, h: 8.5, ms: 610, delay: -430 },
          ].map((b) => (
            <rect
              key={b.x}
              className="lv"
              x={b.x}
              y={20 - b.h}
              width={bar}
              height={b.h}
              rx={bar / 2}
              style={{ "--lv-ms": `${b.ms}ms`, "--lv-delay": `${b.delay}ms` } as CSSProperties}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
