"use client";

// Adapted from "Contribution Skyline" on 21st.dev (https://21st.dev/), reskinned to the site's tokens and type.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { dayValues, type Series } from "@/lib/metrics/series";
import { SKYLINE } from "@/lib/metrics/settings";
import { accentRamp, buildGrid, dayMs, monthLabels } from "@/lib/metrics/skyline/maths";
import { createEngine, type Engine, type EngineConfig, type ThemeReadout } from "./skyline/engine";
import { Legend, SkylineHint, ViewToggle, type View } from "./skyline/parts";

const copy = siteContent.metrics.chart;
const number = new Intl.NumberFormat("en-US");
const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const PALETTE = accentRamp(SKYLINE.lightestShare);
const noun = (n: number) => (n === 1 ? copy.unit : copy.units);

export function ContributionSkyline({ series, view, onViewChange }: { series: Series; view: View; onViewChange: (v: View) => void }) {
  const model = useMemo(() => {
    const grid = buildGrid(dayValues(series), dayMs(series.range.to), 0, { from: dayMs(series.range.from) }, { levelCurve: SKYLINE.levelCurve, heightCap: SKYLINE.heightCap });
    return { ...grid, months: monthLabels(grid.cells, grid.weeks) };
  }, [series]);
  const [theme, setTheme] = useState<ThemeReadout>({ dark: false, swatches: [] });
  const [active, setActive] = useState(-1);
  const [legendLevel, setLegendLevel] = useState(-1);
  const [announce, setAnnounce] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const labelProbeRef = useRef<HTMLSpanElement>(null);
  const engine = useRef<Engine | null>(null);

  const describe = (i: number) => {
    const c = model.cells[i];
    return c ? `${c.count ? `${number.format(c.count)} ${noun(c.count)}` : copy.none} ${copy.on} ${longDay.format(dayMs(c.date))}` : "";
  };
  const config: EngineConfig = {
    model, duration: SKYLINE.durationMs, heightScale: 1, heightCurve: SKYLINE.heightCurve, orbit: true, palette: PALETTE,
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
  useEffect(() => engine.current?.kick(), [view, legendLevel]);
  useEffect(() => engine.current?.load(), [model]);
  useLayoutEffect(() => {
    if (tipRef.current && active >= 0) engine.current?.tipWidth(tipRef.current.offsetWidth);
  }, [active, model]);

  const skyline = view === "skyline";
  return (
    <div className="relative">
      <span ref={probeRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden" />
      <span ref={labelProbeRef} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden font-label text-label-sm" />
      <div className="mb-4 flex justify-end">
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      <div className="relative">
        <div ref={stageRef} data-skyline-stage="" className="metrics-stage relative w-full overflow-hidden" style={{ height: 150 }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-roledescription={copy.roleDescription}
            aria-label={copy.label(number.format(series.total), shortDay.format(dayMs(series.range.from)), shortDay.format(dayMs(series.range.to)), skyline)}
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
        {theme.swatches.length > 0 && <Legend swatches={theme.swatches} level={legendLevel} onLevel={setLegendLevel} />}
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
