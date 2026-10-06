"use client";

// Adapted from "Contribution Skyline" on 21st.dev (https://21st.dev/), reskinned to the site's tokens and type.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildGrid,
  computeStats,
  DAY_MS,
  dayMs,
  generateContributions,
  monthLabels,
  type ContributionDay,
  type HeightCurve,
  type LevelCurve,
  type Streak,
} from "./skyline/maths";
import { createEngine, type Drive, type Engine, type EngineConfig, type Gate, type ThemeReadout } from "./skyline/engine";
import { Legend, Stat, ViewToggle, type StatBlock, type View } from "./skyline/parts";

// A year of activity as a heat map that folds up into an isometric skyline.
// One scene: the 2D view is the grid seen from above, the 3D view the same
// grid seen from the corner; switching swings one camera while each week's
// bars rise in a wave from the oldest week to the newest.

export type ContributionSkylineProps = {
  // One entry per day, YYYY-MM-DD. Omit for a generated sample year.
  data?: ContributionDay[];
  // Last real day (today). Defaults to the latest date in `data`.
  endDate?: string;
  // A calendar range: the grid starts on the week containing `from`; days
  // after endDate up to `through` are drawn as empty future slabs.
  range?: { from: string; through?: string };
  // The current streak to show (the data's own, which may reach past the
  // window); omitted, the chart computes it from the days it draws.
  streak?: Streak;
  // "in 2026" after the total in the caption; the total stat's label.
  periodLabel?: string;
  totalLabel?: string;
  view?: View;
  defaultView?: View;
  onViewChange?: (view: View) => void;
  // Four CSS colours, lightest activity to heaviest. Tokens and color-mix work.
  palette: string[];
  showTitle?: boolean;
  unit?: string;
  unitPlural?: string;
  heightScale?: number;
  heightCurve?: HeightCurve;
  // Colour steps: quarters of a busy day ("linear", the original) or of its square root.
  levelCurve?: LevelCurve;
  // The quantile of active days the tallest bar stands for; 1 is the busiest day.
  heightCap?: number;
  duration?: number;
  weekStart?: 0 | 1;
  orbit?: boolean;
  showStats?: boolean;
  showLegend?: boolean;
  showToggle?: boolean;
  // Replaces the hint under the chart. null renders none.
  footer?: ReactNode;
  // The comparison skin: the original's bordered, rounded card.
  card?: boolean;
  // Lab only: hold the morph at this point (0 flat, 1 skyline).
  pin?: number | null;
  // When the view first applies: on first sight (the original) or at once.
  gate?: Gate;
  // An outside clock for the morph (a scrubbed scroll); it drives while `driven`.
  drive?: Drive | null;
  driven?: boolean;
  locale?: string;
  seed?: number;
  onCellClick?: (day: ContributionDay) => void;
  className?: string;
};

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

export default function ContributionSkyline({
  data,
  endDate,
  range,
  streak: streakProp,
  periodLabel = "in the last year",
  totalLabel = "1 year total",
  view: viewProp,
  defaultView = "3d",
  onViewChange,
  palette,
  showTitle = true,
  unit = "contribution",
  unitPlural,
  heightScale = 1,
  heightCurve = "power",
  levelCurve = "linear",
  heightCap = 1,
  duration = 1300,
  weekStart = 0,
  orbit = true,
  showStats = true,
  showLegend = true,
  showToggle = true,
  footer,
  card = false,
  pin = null,
  gate = "sight",
  drive = null,
  driven = false,
  locale = "en-US",
  seed = 7,
  onCellClick,
  className = "",
}: ContributionSkylineProps) {
  const rangeFrom = range?.from;
  const rangeThrough = range?.through;
  const model = useMemo(() => {
    const dates = (data ?? []).map((d) => dayMs(d.date)).filter(Number.isFinite);
    const end = endDate ? dayMs(endDate) : dates.length ? Math.max(...dates) : dayMs(new Date());
    const from = rangeFrom ? dayMs(rangeFrom) : undefined;
    const through = rangeThrough ? dayMs(rangeThrough) : undefined;
    const sampleDays = from === undefined ? 371 : Math.round((end - from) / DAY_MS) + 1;
    const grid = buildGrid(data ?? generateContributions(end, seed, sampleDays), end, weekStart, { from, through }, { levelCurve, heightCap });
    return { ...grid, stats: computeStats(grid.cells), months: monthLabels(grid.cells, grid.weeks, locale) };
  }, [data, endDate, rangeFrom, rangeThrough, seed, weekStart, locale, levelCurve, heightCap]);

  const [innerView, setInnerView] = useState<View>(defaultView);
  const view = viewProp ?? innerView;
  const setView = (v: View) => {
    if (viewProp === undefined) setInnerView(v);
    onViewChange?.(v);
  };

  const [theme, setTheme] = useState<ThemeReadout>({ dark: false, swatches: [] });
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(-1);
  const [legendLevel, setLegendLevel] = useState(-1);
  const [announce, setAnnounce] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const labelProbeRef = useRef<HTMLSpanElement>(null);
  const engine = useRef<Engine | null>(null);

  const plural = unitPlural ?? unit + "s";
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const df = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const dfy = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), [locale]);
  const dfl = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const noun = (n: number) => (n === 1 ? unit : plural);
  const describe = (i: number) => {
    const c = model.cells[i];
    if (!c) return "";
    return (c.count ? nf.format(c.count) + " " + noun(c.count) : "No " + plural) + " on " + dfl.format(dayMs(c.date));
  };

  const paletteKey = palette.join("|");
  const config: EngineConfig = {
    model,
    duration,
    heightScale,
    heightCurve,
    orbit,
    palette,
    legendLevel,
    target: view === "3d" ? 1 : 0,
    pin,
    gate,
    drive,
    driven,
    locale,
    onCellClick,
    setActive,
    setWidth,
    setTheme,
    setAnnounce,
    describe,
  };
  const cfg = useRef(config);
  // The loop reads the latest props through this ref every frame; a layout
  // effect refreshes it after each render, before the effects below kick.
  useLayoutEffect(() => {
    cfg.current = config;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    const probe = probeRef.current;
    const labelProbe = labelProbeRef.current;
    if (!stage || !canvas || !tip || !probe || !labelProbe) return;
    engine.current = createEngine({ stage, canvas, tip, probe, labelProbe }, cfg);
    return () => {
      engine.current?.destroy();
      engine.current = null;
    };
  }, [locale]);

  useEffect(() => {
    engine.current?.kick();
  }, [view, legendLevel, pin, driven]);

  useEffect(() => {
    engine.current?.load();
  }, [model, heightScale, heightCurve]);

  useEffect(() => {
    engine.current?.retheme();
  }, [paletteKey]);

  // The tooltip's width keeps it inside the chart; measure it when its text changes.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (tip && active >= 0) engine.current?.tipWidth(tip.offsetWidth);
  }, [active, model]);

  const { stats } = model;
  const span = (a: string | null, b: string | null, withYear = false) => {
    if (!a || !b) return "None yet";
    const f = withYear ? dfy : df;
    return a === b ? f.format(dayMs(a)) : f.format(dayMs(a)) + " to " + f.format(dayMs(b));
  };
  const is3d = view === "3d";
  const corners = showStats && width >= 560;
  const bigSize = Math.round(Math.max(30, Math.min(56, width * 0.058)));
  const days = (n: number) => (n === 1 ? "day" : "days");
  // The current streak only; the longest is never shown (the same number twice for a daily contributor).
  const streak = streakProp ?? stats.current;
  const statBlocks: StatBlock[] = [
    { label: totalLabel, value: nf.format(stats.total), unit: noun(stats.total), sub: span(stats.first, stats.last, true) },
    { label: "Active days", value: nf.format(stats.active), unit: days(stats.active), sub: "of " + nf.format(stats.days) + " days" },
    {
      label: "Current streak of " + plural,
      value: nf.format(streak.days),
      unit: days(streak.days),
      sub: streak.start ? "since " + df.format(dayMs(streak.start)) : "None yet",
    },
    { label: "Busiest day", value: nf.format(stats.busiest.count), unit: noun(stats.busiest.count), sub: stats.busiest.date ? df.format(dayMs(stats.busiest.date)) : "None yet" },
  ];
  const showRow = showStats && !(is3d && corners);
  const levelNames = ["No " + plural, "Light", "Moderate", "Heavy", "Heaviest"];
  const hints = ["Hover a day for details, arrow keys to explore", "Drag to orbit, double-click to reset"];
  const hint = hints[is3d && orbit ? 1 : 0];
  const activeCell = active >= 0 ? model.cells[active] : undefined;

  const cornerStyle = (from: number, delay: number) => ({
    opacity: is3d ? 1 : 0,
    transform: is3d ? "translateY(0)" : `translateY(${from}px)`,
    transitionDuration: is3d ? "600ms" : "300ms",
    transitionDelay: is3d ? Math.round(duration * delay) + "ms" : "0ms",
    transitionTimingFunction: EASE,
  });

  return (
    <section
      aria-label={"Contributions " + periodLabel}
      className={
        "relative w-full bg-background text-foreground " + (card ? "rounded-xl border border-border p-4 sm:p-5 " : "") + className
      }
    >
      <span ref={probeRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden" />
      <span ref={labelProbeRef} aria-hidden="true" className="m-label-sm pointer-events-none absolute h-0 w-0 overflow-hidden" />

      {(showTitle || showToggle) && (
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          {showTitle ? (
            <h3 className="m-label m-0 text-muted">
              <span className="tabular-nums text-foreground">{nf.format(stats.total)}</span> {noun(stats.total)} {periodLabel}
            </h3>
          ) : (
            <span />
          )}
          {showToggle && <ViewToggle view={view} onChange={setView} />}
        </header>
      )}

      <div className={card ? "relative rounded-lg border border-border p-3 sm:p-4" : "relative"}>
        <div className="relative">
          <div
            ref={stageRef}
            className="relative w-full overflow-hidden outline-offset-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            style={{ height: 150 }}
          >
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="img"
              aria-roledescription="interactive chart"
              aria-label={
                nf.format(stats.total) + " " + noun(stats.total) + " from " + span(stats.first, stats.last, true) +
                ", shown as a " + (is3d ? "3D skyline" : "heat map") + ". Use the arrow keys to read individual days."
              }
              className="absolute left-0 top-0 block outline-none"
              style={{ maxWidth: "none", touchAction: is3d && orbit ? "pan-y" : "auto" }}
            />

            {corners && (
              <>
                {/* Each corner pair sits side by side: the empty triangles above the
                    back edge and below the front edge are wide and shallow, and a
                    stacked pair ran into the newest, tallest bars. */}
                <div
                  aria-hidden={!is3d}
                  className="pointer-events-none absolute right-1 top-1 flex items-start gap-8 transition-[opacity,transform] motion-reduce:transition-none"
                  style={cornerStyle(-10, 0.55)}
                >
                  <Stat {...statBlocks[0]} size={bigSize} align="end" />
                  <Stat {...statBlocks[1]} size={bigSize} align="end" />
                </div>
                <div
                  aria-hidden={!is3d}
                  className="pointer-events-none absolute bottom-1 left-1 flex items-end gap-8 transition-[opacity,transform] motion-reduce:transition-none"
                  style={cornerStyle(10, 0.65)}
                >
                  <Stat {...statBlocks[2]} size={bigSize} align="start" />
                  <Stat {...statBlocks[3]} size={bigSize} align="start" />
                </div>
              </>
            )}
          </div>

          <div
            ref={tipRef}
            role="tooltip"
            aria-hidden={active < 0}
            className="m-label-sm pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-background transition-opacity duration-150 motion-reduce:transition-none"
            style={{ opacity: active >= 0 ? 1 : 0 }}
          >
            {activeCell ? (
              <>
                {activeCell.count ? nf.format(activeCell.count) + " " + noun(activeCell.count) : "No " + plural}
                <span className="opacity-70"> on {dfy.format(dayMs(activeCell.date))}</span>
              </>
            ) : (
              " "
            )}
            <span
              aria-hidden="true"
              className="absolute top-full h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-foreground"
              style={{ left: "var(--arrow, 50%)", marginLeft: -5 }}
            />
          </div>
        </div>

        {showStats && (
          <div
            aria-hidden={!showRow}
            className="grid transition-[grid-template-rows,opacity] motion-reduce:transition-none"
            style={{
              gridTemplateRows: showRow ? "1fr" : "0fr",
              opacity: showRow ? 1 : 0,
              transitionDuration: duration + "ms",
              transitionTimingFunction: EASE,
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 pb-1 pt-6 md:grid-cols-4">
                {statBlocks.map((b) => (
                  <Stat key={b.label} {...b} size={32} align="stack" />
                ))}
              </div>
            </div>
          </div>
        )}

        {(footer !== null || showLegend) && (
          <div className="m-label-sm flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4 text-muted">
            {footer === undefined ? (
              <span className="relative grid flex-1">
                {hints.map((h) => (
                  <span
                    key={h}
                    aria-hidden={h !== hint}
                    className="transition-opacity duration-500 [grid-area:1/1] motion-reduce:transition-none"
                    style={{ opacity: h === hint ? 1 : 0 }}
                  >
                    {h}
                  </span>
                ))}
              </span>
            ) : (
              <span className="flex-1">{footer}</span>
            )}
            {showLegend && theme.swatches.length > 0 && (
              <Legend swatches={theme.swatches} names={levelNames} level={legendLevel} onLevel={setLegendLevel} />
            )}
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}
