"use client";

import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";

const copy = siteContent.metrics.chart;
export type View = "flat" | "skyline";

// Flat and Skyline: quiet rise Fills on native buttons with aria-pressed, so
// Enter and Space work. The shown view reads in the accent, the other muted.
export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="group" aria-label={copy.viewGroup} className="-mx-2 flex items-baseline gap-1">
      {(["flat", "skyline"] as const).map((v) => (
        <Fill
          key={v}
          variant="rise"
          colorway="quiet"
          shape="rect"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`px-2 py-1 font-label text-label ${view === v ? "text-accent" : "text-muted"}`}
          overClassName="flex items-center px-2 py-1"
        >
          {copy[v]}
        </Fill>
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

// Hover and focus preview a level; only a press pins it, so aria-pressed
// tracks the pin and a focused swatch is never announced as pressed.
export function Legend({
  swatches,
  pinned,
  onPin,
  onPreview,
}: {
  swatches: string[];
  pinned: number;
  onPin: (update: (l: number) => number) => void;
  onPreview: (level: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 font-label text-label-sm text-muted" onMouseLeave={() => onPreview(null)}>
      <span className="mr-0.5">{copy.less}</span>
      {swatches.map((c, i) => (
        <button
          key={i}
          type="button"
          aria-label={copy.highlight(copy.levels[i])}
          aria-pressed={pinned === i}
          title={copy.levels[i]}
          onMouseEnter={() => onPreview(i)}
          onFocus={() => onPreview(i)}
          onBlur={() => onPreview(null)}
          onClick={() => onPin((l) => (l === i ? -1 : i))}
          className="h-[11px] w-[11px] cursor-pointer rounded-[2px] border-0 p-0 shadow-[inset_0_0_0_1px_var(--color-border)] transition-[background-color,transform] duration-500 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 motion-reduce:transition-none"
          style={{ background: c }}
        />
      ))}
      <span className="ml-0.5">{copy.more}</span>
    </div>
  );
}
