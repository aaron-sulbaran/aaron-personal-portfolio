"use client";

import { siteContent } from "@/lib/content";

const copy = siteContent.metrics.chart;
export type View = "flat" | "skyline";

// Flat and Skyline: native buttons with aria-pressed, so Enter and Space work.
// The fallback until the controls slice's Fill lands (Task 14 swaps it).
export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="group" aria-label={copy.viewGroup} className="-mx-2 flex items-baseline gap-1">
      {(["flat", "skyline"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => onChange(v)} className="metrics-toggle rounded-[10px] px-2 py-1 font-label text-label">
          {copy[v]}
        </button>
      ))}
    </div>
  );
}

export function SkylineHint({ view }: { view: View }) {
  return (
    <span className="relative grid flex-1">
      {([["flat", copy.hintFlat], ["skyline", copy.hintSkyline]] as const).map(([v, text]) => (
        <span key={v} aria-hidden={v !== view} className="transition-opacity duration-500 [grid-area:1/1] motion-reduce:transition-none" style={{ opacity: v === view ? 1 : 0 }}>
          {text}
        </span>
      ))}
    </span>
  );
}

export function Legend({
  swatches,
  level,
  onLevel,
}: {
  swatches: string[];
  level: number;
  onLevel: (update: (l: number) => number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 font-label text-label-sm text-muted" onMouseLeave={() => onLevel(() => -1)}>
      <span className="mr-0.5">{copy.less}</span>
      {swatches.map((c, i) => (
        <button
          key={i}
          type="button"
          aria-label={copy.highlight(copy.levels[i])}
          aria-pressed={level === i}
          title={copy.levels[i]}
          onMouseEnter={() => onLevel(() => i)}
          onFocus={() => onLevel(() => i)}
          onBlur={() => onLevel(() => -1)}
          onClick={() => onLevel((l) => (l === i ? -1 : i))}
          className="h-[11px] w-[11px] cursor-pointer rounded-[2px] border-0 p-0 shadow-[inset_0_0_0_1px_var(--color-border)] transition-[background-color,transform] duration-500 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 motion-reduce:transition-none"
          style={{ background: c }}
        />
      ))}
      <span className="ml-0.5">{copy.more}</span>
    </div>
  );
}
