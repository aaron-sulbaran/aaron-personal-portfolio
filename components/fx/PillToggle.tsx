"use client";

import { useState } from "react";

// A two-half capsule drawn as the hero's Coil and Band toggle is
// (components/coil/ShapeToggle.tsx): the selection is a fill over a second,
// aria-hidden and inert copy of both labels, its trailing edge a beat behind,
// and the other half leans toward a hover or a focus (globals.css, "The pill
// toggle"). It sits on the page, so it has no backdrop blur. Native buttons
// with aria-pressed, so Enter and Space work.
const HALF = "flex h-9 items-center justify-center px-3 font-label text-label leading-none whitespace-nowrap sm:px-3.5";
const SEGS = ["first", "second"] as const;

type Props<T extends string> = {
  label: string;
  options: readonly [T, T];
  value: T;
  onChange: (next: T) => void;
  names: Record<T, string>;
};

export function PillToggle<T extends string>({ label, options, value, onChange, names }: Props<T>) {
  const [dir, setDir] = useState<"left" | "right" | "none">("none");
  const pick = (next: T) => {
    if (next === value) return;
    setDir(next === options[1] ? "right" : "left");
    onChange(next);
  };
  return (
    <div role="group" aria-label={label} data-pill-toggle="" data-state={value === options[0] ? "first" : "second"} data-dir={dir} className="pill-toggle">
      <span className="pill-toggle__base grid grid-cols-2">
        {options.map((v, i) => (
          <button key={v} type="button" data-seg={SEGS[i]} aria-pressed={value === v} onClick={() => pick(v)} className={`pill-toggle__seg ${HALF}`}>
            {names[v]}
          </button>
        ))}
      </span>
      <span aria-hidden="true" inert className="pill-toggle__over grid grid-cols-2">
        {options.map((v) => (
          <span key={v} className={HALF}>
            {names[v]}
          </span>
        ))}
      </span>
    </div>
  );
}
