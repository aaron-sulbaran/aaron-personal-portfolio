"use client";

// The chart's DOM pieces: one stat (corner or stacked), the view switch, the legend.

export type StatBlock = { label: string; value: string; unit: string; sub: string };

export function Stat({ label, value, unit, sub, size, align }: StatBlock & { size: number; align: "start" | "end" | "stack" }) {
  const figure = (
    <span
      className="font-display tabular-nums text-foreground"
      style={{ fontSize: size, lineHeight: 0.95, letterSpacing: "-0.02em" }}
    >
      {value}
    </span>
  );
  if (align === "stack") {
    return (
      <div className="min-w-0">
        <div className="m-label-sm text-muted">{label}</div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          {figure}
          <span className="m-label text-muted">{unit}</span>
        </div>
        <div className="m-label-sm mt-1 truncate text-muted">{sub}</div>
      </div>
    );
  }
  return (
    <div className={"flex flex-col gap-1 " + (align === "end" ? "items-end text-right" : "items-start")}>
      <div className="m-label-sm text-muted">{label}</div>
      <div className="flex items-baseline gap-1.5">
        {figure}
        <span className="m-label text-muted">{unit}</span>
      </div>
      <div className="m-label-sm whitespace-nowrap text-muted">{sub}</div>
    </div>
  );
}

export type View = "2d" | "3d";

const VIEW_NAMES: Record<View, string> = { "2d": "Flat", "3d": "Skyline" };

// Two words in the label face, accent because they are controls; the shown
// view carries the underline the label face spec gives "Play it".
export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="group" aria-label="Chart view" className="flex items-baseline gap-4">
      {(["2d", "3d"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={
            "m-label text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-hover " +
            (view === v ? "underline decoration-1" : "no-underline")
          }
        >
          {VIEW_NAMES[v]}
        </button>
      ))}
    </div>
  );
}

export function Legend({
  swatches,
  names,
  level,
  onLevel,
}: {
  swatches: string[];
  names: string[];
  level: number;
  onLevel: (update: (l: number) => number) => void;
}) {
  return (
    <div className="m-label-sm flex items-center gap-1.5 text-muted" onMouseLeave={() => onLevel(() => -1)}>
      <span className="mr-0.5">Less</span>
      {swatches.map((c, i) => (
        <button
          key={i}
          type="button"
          aria-label={"Highlight " + names[i].toLowerCase() + " days"}
          aria-pressed={level === i}
          title={names[i]}
          onMouseEnter={() => onLevel(() => i)}
          onFocus={() => onLevel(() => i)}
          onBlur={() => onLevel(() => -1)}
          onClick={() => onLevel((l) => (l === i ? -1 : i))}
          className="h-[11px] w-[11px] cursor-pointer rounded-[2px] border-0 p-0 shadow-[inset_0_0_0_1px_var(--color-border)] transition-[background-color,transform] duration-500 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 motion-reduce:transition-none"
          style={{ background: c }}
        />
      ))}
      <span className="ml-0.5">More</span>
    </div>
  );
}
