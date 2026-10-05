"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Capsule } from "./Capsule";
import { createWaveEngine, type WaveEngine } from "./engine";
import { PANEL_WIDTH, Panel } from "./Panel";
import { PathLayer } from "./PathLayer";
import { SECTION_KEYS } from "./spines";
import { DEFAULT_SETTINGS, PRESETS, type PathSettings, type Placement, type ThemeName, type WaveSettings } from "./settings";

// The lab's client shell: the settings, the wave layer and the panel. The
// fixed placements live in one fixed stage at z 0 behind the content (z 10,
// as on the site); the in-flow ones (path, seams, chapters) sit inside the
// content at z -1, so they scroll with the page exactly and still paint
// behind it. Each section's wrapper carries data-lab-section, the anchors the
// path's spine is defined against.
// The section wrappers and seam markers are always rendered, so switching
// placement never remounts a section.

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const readTheme = (): ThemeName => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

declare global {
  interface Window {
    __waveLab?: {
      patch: (patch: Partial<WaveSettings>) => void;
      pathPatch: (patch: Partial<PathSettings>) => void;
      preset: (id: string) => void;
      get: () => WaveSettings;
      open: (open: boolean) => void;
      hold: (seconds: number | null) => void;
    };
  }
}

interface WaveLabProps {
  band: ReactNode;
  sections: ReactNode[];
  footer: ReactNode;
}

export function WaveLab({ band, sections, footer }: WaveLabProps) {
  const [settings, setSettings] = useState<WaveSettings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState(true);
  const [simReduced, setSimReduced] = useState(false);
  const systemReduced = useReducedMotionLive();
  const reduced = systemReduced || simReduced;
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const [engine] = useState(() => createWaveEngine(DEFAULT_SETTINGS));

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    engine.update(settings, reduced);
  }, [engine, settings, reduced]);

  // A handle for driving the lab from the console or a test browser:
  // window.__waveLab.patch({ placement: "seams" }), .preset("thresholds").
  useEffect(() => {
    window.__waveLab = {
      patch: (patch) => setSettings((current) => ({ ...current, ...patch })),
      preset: (id) => {
        const found = PRESETS.find((p) => p.id === id);
        if (found) setSettings(found.values);
      },
      get: () => settings,
      open: setOpen,
      hold: (seconds) => engine.hold(seconds),
      pathPatch: (patch) => setSettings((current) => ({ ...current, path: { ...current.path, ...patch } })),
    };
  }, [engine, settings]);

  const setTheme = (next: ThemeName) => {
    document.documentElement.dataset.theme = next;
  };

  const mainRef = useRef<HTMLElement | null>(null);
  const seamGaps = useSeamGaps(mainRef, settings.placement === "seams");

  const inset = open ? PANEL_WIDTH : 0;
  const { placement } = settings;
  const height = settings.stripHeight[placement];
  const position = settings.position[placement];

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-0 z-0" style={{ right: inset }}>
        {placement === "backdrop" && (
          <div className="absolute inset-x-0" style={{ top: `calc(${position * 100}% - ${height / 2}px)`, height, ...maskFor(settings, "backdrop") }}>
            <LabCanvas engine={engine} kind="backdrop" index={0} />
          </div>
        )}
        {placement === "horizon" && (
          <div className="absolute inset-x-0 bottom-0" style={{ height, ...maskFor(settings, "horizon") }}>
            <LabCanvas engine={engine} kind="horizon" index={0} />
          </div>
        )}
        {placement === "rail" && (
          <div className="absolute inset-y-0" style={{ right: position - height / 2, width: height, ...maskFor(settings, "rail") }}>
            <LabCanvas engine={engine} kind="rail" index={0} />
          </div>
        )}
      </div>

      <div className="relative z-10" style={{ marginRight: inset }}>
        {placement === "path" && <PathLayer settings={settings} reduced={reduced} />}
        <main ref={mainRef} id="main" className="relative overflow-x-clip">
          <div data-lab-section="band">{band}</div>
          {sections.map((section, i) => (
            <Fragment key={i}>
              <Seam on={placement === "seams"} index={i} engine={engine} settings={settings} gap={seamGaps[i]} />
              <div data-lab-section={SECTION_KEYS[i + 1]} className="relative">
                {section}
                {placement === "chapters" && (
                  <InFlow engine={engine} kind="chapters" index={i} settings={settings} top={`calc(${position * 100}% - ${height / 2}px)`} />
                )}
              </div>
            </Fragment>
          ))}
          <Seam on={placement === "seams"} index={sections.length} engine={engine} settings={settings} gap={seamGaps[sections.length]} />
        </main>
        <div data-lab-section="footer">{footer}</div>
      </div>

      {settings.capsule && <Capsule />}

      <Panel
        settings={settings}
        patch={(patch) => setSettings((current) => ({ ...current, ...patch }))}
        replace={setSettings}
        theme={theme}
        setTheme={setTheme}
        open={open}
        setOpen={setOpen}
        systemReduced={systemReduced}
        simReduced={simReduced}
        setSimReduced={setSimReduced}
      />
    </>
  );
}

// A zero-height marker at the boundary between two sections. The wave
// centres itself in the measured gap between the two sections' words (the
// offset slider nudges it from there) and never grows taller than the gap.
function Seam({ on, index, engine, settings, gap }: { on: boolean; index: number; engine: WaveEngine; settings: WaveSettings; gap?: SeamGap }) {
  const height = Math.min(settings.stripHeight.seams, gap ? Math.max(60, gap.span - 24) : Infinity);
  const centre = (gap?.centre ?? 0) + settings.position.seams;
  return (
    <div aria-hidden="true" data-seam className="relative h-0">
      {on && <InFlow engine={engine} kind="seams" index={index} settings={settings} height={height} top={`${centre - height / 2}px`} />}
    </div>
  );
}

interface SeamGap {
  centre: number; // px from the marker to the middle of the gap
  span: number; // px of clear air between the two sections' words
}

// Measures each seam's gap from the [data-wave-avoid] boxes the real sections
// already carry, on resize only (and once more after the reveals settle).
function useSeamGaps(mainRef: RefObject<HTMLElement | null>, on: boolean): SeamGap[] {
  const [gaps, setGaps] = useState<SeamGap[]>([]);
  useEffect(() => {
    const main = mainRef.current;
    if (!on || !main) return;
    const measure = () => setGaps(Array.from(main.querySelectorAll<HTMLElement>("[data-seam]"), measureGap));
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    const late = window.setTimeout(measure, 1500);
    return () => {
      observer.disconnect();
      window.clearTimeout(late);
    };
  }, [mainRef, on]);
  return gaps;
}

function measureGap(marker: HTMLElement): SeamGap {
  const at = marker.getBoundingClientRect().top;
  const before = marker.previousElementSibling;
  const after = marker.nextElementSibling ?? marker.parentElement?.nextElementSibling ?? null;
  let lastWords = -Infinity;
  before?.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
    // An element whose words overhang its box (Up to now's offset column) says so.
    const overhang = Math.max(0, Number(el.dataset.waveAvoidPad || 0) - 20);
    lastWords = Math.max(lastWords, el.getBoundingClientRect().bottom + overhang);
  });
  const top = Number.isFinite(lastWords) ? lastWords : at;
  let firstWords = Infinity;
  after?.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
    firstWords = Math.min(firstWords, el.getBoundingClientRect().top);
  });
  const bottom = Number.isFinite(firstWords) ? firstWords : at;
  return { centre: (top + bottom) / 2 - at, span: Math.max(0, bottom - top) };
}

function InFlow(props: { engine: WaveEngine; kind: Placement; index: number; settings: WaveSettings; top: string; height?: number }) {
  const { engine, kind, index, settings, top } = props;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0"
      style={{ top, height: props.height ?? settings.stripHeight[kind], zIndex: -1, ...maskFor(settings, kind) }}
    >
      <LabCanvas engine={engine} kind={kind} index={index} />
    </div>
  );
}

function LabCanvas({ engine, kind, index }: { engine: WaveEngine; kind: Placement; index: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return engine.attach(canvas, kind, index);
  }, [engine, kind, index]);
  return <canvas ref={ref} className="block h-full w-full" />;
}

// Two gradients intersected: the ends fade along the wave by the edge-fade
// setting, and the strip's own edges fade across it so a tall swing softens
// out rather than clipping (the horizon fades only its top, as built).
function maskFor(settings: WaveSettings, kind: Placement): CSSProperties {
  const vertical = kind === "rail";
  const e = settings.edgeFade * 100;
  const along = `linear-gradient(${vertical ? "to bottom" : "to right"}, transparent 0%, black ${e}%, black ${100 - e}%, transparent 100%)`;
  const across =
    kind === "horizon"
      ? "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)"
      : `linear-gradient(${vertical ? "to right" : "to bottom"}, transparent 0%, black 14%, black 86%, transparent 100%)`;
  const image = `${along}, ${across}`;
  return { maskImage: image, WebkitMaskImage: image, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
}
