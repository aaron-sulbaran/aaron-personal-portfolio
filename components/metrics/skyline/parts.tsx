"use client";

import { PillToggle } from "@/components/fx/PillToggle";
import { useCoarsePointer } from "@/components/useCoarsePointer";
import { siteContent } from "@/lib/content";
import type { SeriesChoice } from "@/lib/metrics/settings";

const copy = siteContent.metrics.chart;
export type View = "flat" | "skyline";

// The chart's control row: two pill toggles.
export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return <PillToggle label={copy.viewGroup} options={["flat", "skyline"] as const} value={view} onChange={onChange} names={copy} />;
}

export function SeriesToggle({ value, onChange }: { value: SeriesChoice; onChange: (v: SeriesChoice) => void }) {
  return <PillToggle label={copy.seriesGroup} options={["commits", "tokens"] as const} value={value} onChange={onChange} names={copy} />;
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

// The skyline's hint by pointer type, as the modals' close hint is: a double-tap on a touch screen, a double-click with a mouse.
export function SkylineHint({ view }: { view: View }) {
  const coarse = useCoarsePointer();
  return (
    <span className="relative grid flex-1">
      {([["flat", copy.hintFlat], ["skyline", coarse ? copy.hintSkylineTouch : copy.hintSkyline]] as const).map(([v, text]) => (
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
          className="group relative flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[2px] shadow-[inset_0_0_0_1px_var(--color-border)] transition-transform duration-500 group-hover:scale-125 motion-reduce:transition-none" style={{ background: c }} />
        </button>
      ))}
      <span className="ml-0.5">{copy.more}</span>
    </div>
  );
}
