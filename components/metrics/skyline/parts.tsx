"use client";

import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import type { SeriesChoice } from "@/lib/metrics/settings";

const copy = siteContent.metrics.chart;
export type View = "flat" | "skyline";

// Quiet rise Fills on native buttons with aria-pressed, so Enter and Space
// work. The chosen option reads in the accent, the other muted.
function Pair<T extends "flat" | "skyline" | SeriesChoice>({ label, options, value, onChange }: { label: string; options: readonly [T, T]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="-mx-2 flex items-baseline gap-1">
      {options.map((v) => (
        <Fill
          key={v}
          variant="rise"
          colorway="quiet"
          shape="rect"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`px-2 py-1 font-label text-label ${value === v ? "text-accent" : "text-muted"}`}
          overClassName="flex items-center px-2 py-1"
        >
          {copy[v]}
        </Fill>
      ))}
    </div>
  );
}

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return <Pair label={copy.viewGroup} options={["flat", "skyline"] as const} value={view} onChange={onChange} />;
}

export function SeriesToggle({ value, onChange }: { value: SeriesChoice; onChange: (v: SeriesChoice) => void }) {
  return <Pair label={copy.seriesGroup} options={["commits", "tokens"] as const} value={value} onChange={onChange} />;
}

// The Tokens view's key: each tool's strongest step beside its name.
export function ToolKey({ colors }: { colors: string[] }) {
  const t = siteContent.metrics.tokens;
  return (
    <ul aria-label={t.keyLabel} className="flex items-center gap-3 font-label text-label-sm text-muted">
      {[t.keyClaude, t.keyCodex].map((name, i) => (
        <li key={name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[2px] transition-[background-color] duration-500 motion-reduce:transition-none" style={{ background: colors[i] }} />
          {name}
        </li>
      ))}
    </ul>
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
// tracks the pin and a focused swatch is never announced as pressed. Each
// swatch draws at 11px; its before element is the press target, 24px tall
// and out to the middle of the 6px gaps, so neighbours meet and never overlap.
export function Legend({
  swatches,
  pinned,
  onPin,
  onPreview,
  levels = copy.levels,
}: {
  swatches: string[];
  pinned: number;
  onPin: (update: (l: number) => number) => void;
  onPreview: (level: number | null) => void;
  levels?: readonly string[];
}) {
  return (
    <div className="flex items-center gap-1.5 font-label text-label-sm text-muted" onMouseLeave={() => onPreview(null)}>
      <span className="mr-0.5">{copy.less}</span>
      {swatches.map((c, i) => (
        <button
          key={i}
          type="button"
          aria-label={copy.highlight(levels[i] ?? copy.levels[i])}
          aria-pressed={pinned === i}
          title={levels[i]}
          onMouseEnter={() => onPreview(i)}
          onFocus={() => onPreview(i)}
          onBlur={() => onPreview(null)}
          onClick={() => onPin((l) => (l === i ? -1 : i))}
          className="relative h-[11px] w-[11px] cursor-pointer rounded-[2px] before:absolute before:-inset-x-[3px] before:-inset-y-[6.5px] before:content-[''] border-0 p-0 shadow-[inset_0_0_0_1px_var(--color-border)] transition-[background-color,transform] duration-500 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 motion-reduce:transition-none"
          style={{ background: c }}
        />
      ))}
      <span className="ml-0.5">{copy.more}</span>
    </div>
  );
}
