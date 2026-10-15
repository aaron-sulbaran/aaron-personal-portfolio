"use client";

// Adapted from "Contribution Skyline" on 21st.dev (https://21st.dev/), reskinned to the site's tokens and type.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { formatCompact, tokenTip } from "@/lib/metrics/format";
import { dayValues, type Series, type UsageDay } from "@/lib/metrics/series";
import { SKYLINE } from "@/lib/metrics/settings";
import { accentRamp, buildGrid, dayMs, monthLabels } from "@/lib/metrics/skyline/maths";
import { lowerShare, tokenRamps } from "@/lib/metrics/skyline/stack";
import { createEngine, type Engine, type EngineConfig, type Model, type ThemeReadout } from "./skyline/engine";
import { Legend, SkylineHint, ToolKey, ViewToggle, type View } from "./skyline/parts";
import { useTokensSettings } from "./tokensSettings";

const chart = siteContent.metrics.chart;
const tokens = siteContent.metrics.tokens;
const number = new Intl.NumberFormat("en-US");
const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const PALETTE = accentRamp(SKYLINE.lightestShare);

const wordsFor = (series: Series) =>
  series.kind === "usage"
    ? { total: formatCompact(series.total), label: tokens.label, levels: tokens.levels }
    : { total: number.format(series.total), label: chart.label, levels: chart.levels };

type Props = { series: Series; switchReverse: boolean; view: View; onViewChange: (v: View) => void; toolbar?: ReactNode };

export function ContributionSkyline({ series, switchReverse, view, onViewChange, toolbar }: Props) {
  const settings = useTokensSettings();
  const stacked = series.kind === "usage";
  const copy = wordsFor(series);
  const { minShare, heightCurve, heightCap, colorSet } = settings;
  const { model, byDate } = useMemo(() => {
    const curve = stacked ? heightCurve : SKYLINE.heightCurve;
    const cap = stacked ? heightCap : SKYLINE.heightCap;
    const grid = buildGrid(dayValues(series), dayMs(series.range.to), 0, { from: dayMs(series.range.from) }, { levelCurve: SKYLINE.levelCurve, heightCap: cap });
    const byDate = new Map<string, UsageDay>(series.kind === "usage" ? series.days.map((d) => [d.date, d]) : []);
    const stack = stacked ? grid.cells.map((c) => lowerShare(byDate.get(c.date)?.claude ?? 0, byDate.get(c.date)?.codex ?? 0, minShare)) : null;
    const model: Model = { ...grid, months: monthLabels(grid.cells, grid.weeks), curve, stack };
    return { model, byDate };
  }, [series, stacked, minShare, heightCurve, heightCap]);
  const palettes = useMemo(() => {
    if (!stacked) return { lower: PALETTE, upper: null };
    const ramps = tokenRamps(colorSet, SKYLINE.lightestShare);
    return { lower: ramps.claude, upper: ramps.codex };
  }, [stacked, colorSet]);
  const [theme, setTheme] = useState<ThemeReadout>({ dark: false, swatches: [], key: [] });
  const [active, setActive] = useState(-1);
  const [pinnedLevel, setPinnedLevel] = useState(-1);
  const [previewLevel, setPreviewLevel] = useState<number | null>(null);
  const legendLevel = previewLevel ?? pinnedLevel;
  const [announce, setAnnounce] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const labelProbeRef = useRef<HTMLSpanElement>(null);
  const engine = useRef<Engine | null>(null);

  const describe = (i: number) => {
    const c = model.cells[i];
    if (!c) return "";
    if (stacked) return tokenTip(byDate.get(c.date) ?? { date: c.date, count: 0, claude: 0, codex: 0 });
    return `${c.count ? `${number.format(c.count)} ${c.count === 1 ? chart.unit : chart.units}` : chart.none} ${chart.on} ${longDay.format(dayMs(c.date))}`;
  };
  const config: EngineConfig = {
    model, duration: SKYLINE.durationMs, heightScale: 1, orbit: true, palette: palettes.lower, palette2: palettes.upper,
    switchMs: settings.switchMs, switchStagger: settings.switchStagger, switchReverse, segmentGap: settings.segmentGap,
    legendLevel, target: view === "skyline" ? 1 : 0, depth: SKYLINE.depth, locale: "en-US", setActive, setTheme, setAnnounce, describe,
  };
  const cfg = useRef(config);
  useLayoutEffect(() => {
    cfg.current = config;
  });
  useEffect(() => {
    const [stage, canvas, tip, probe, labelProbe] = [stageRef.current, canvasRef.current, tipRef.current, probeRef.current, labelProbeRef.current];
    if (!stage || !canvas || !tip || !probe || !labelProbe) return;
    engine.current = createEngine({ stage, canvas, tip, probe, labelProbe }, cfg);
    return () => {
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => engine.current?.kick(), [view, legendLevel, settings.segmentGap]);
  // The engine loads the first model itself; every later one is a switch.
  const loadedModel = useRef(model);
  useEffect(() => {
    if (loadedModel.current === model) return;
    loadedModel.current = model;
    engine.current?.load();
  }, [model]);
  const loadedPalettes = useRef(palettes);
  useEffect(() => {
    if (loadedPalettes.current === palettes) return;
    loadedPalettes.current = palettes;
    engine.current?.retheme();
  }, [palettes]);
  useLayoutEffect(() => {
    if (tipRef.current && active >= 0) engine.current?.tipWidth(tipRef.current.offsetWidth);
  }, [active, model]);

  const skyline = view === "skyline";
  return (
    <div className="relative">
      <span ref={probeRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden" />
      <span ref={labelProbeRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden font-label text-label-sm" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
        {toolbar ?? <span />}
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      <div className="relative">
        <div ref={stageRef} data-skyline-stage="" data-series={series.kind} className="metrics-stage relative w-full overflow-hidden" style={{ height: 150 }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-roledescription={chart.roleDescription}
            aria-label={copy.label(copy.total, shortDay.format(dayMs(series.range.from)), shortDay.format(dayMs(series.range.to)), skyline)}
            className="absolute left-0 top-0 block outline-none"
            style={{ maxWidth: "none", touchAction: skyline ? "pan-y" : "auto" }}
          />
        </div>
        <div ref={tipRef} role="tooltip" aria-hidden={active < 0} className="pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 font-label text-label-sm text-background transition-opacity duration-150 motion-reduce:transition-none" style={{ opacity: active >= 0 ? 1 : 0 }}>
          {active >= 0 ? describe(active) : " "}
          <span aria-hidden="true" className="absolute top-full h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-foreground" style={{ left: "var(--arrow, 50%)", marginLeft: -5 }} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4 font-label text-label-sm text-muted">
        <SkylineHint view={view} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {stacked && theme.key.length === 2 && <ToolKey colors={theme.key} />}
          {theme.swatches.length > 0 && <Legend swatches={theme.swatches} pinned={pinnedLevel} onPin={setPinnedLevel} onPreview={setPreviewLevel} levels={copy.levels} />}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
