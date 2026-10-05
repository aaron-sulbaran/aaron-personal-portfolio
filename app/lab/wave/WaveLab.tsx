"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Capsule } from "./Capsule";
import { createWaveEngine, type WaveEngine } from "./engine";
import { PANEL_WIDTH, Panel } from "./Panel";
import { DEFAULT_SETTINGS, type Placement, type ThemeName, type WaveSettings } from "./settings";

// The lab's client shell: the settings, the wave layer and the panel. The
// fixed placements live in one fixed stage at z 0 behind the content (z 10,
// as on the site); the in-flow ones (seams, chapters) sit inside the content
// at z -1, so they scroll with the page exactly and still paint behind it.
// The section wrappers and seam markers are always rendered, so switching
// placement never remounts a section.

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const readTheme = (): ThemeName => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

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

  const setTheme = (next: ThemeName) => {
    document.documentElement.dataset.theme = next;
  };

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
          <div className="absolute inset-y-0" style={{ left: `calc(${position * 100}% - ${height / 2}px)`, width: height, ...maskFor(settings, "rail") }}>
            <LabCanvas engine={engine} kind="rail" index={0} />
          </div>
        )}
      </div>

      <div className="relative z-10" style={{ marginRight: inset }}>
        <main id="main" className="relative overflow-x-clip">
          {band}
          {sections.map((section, i) => (
            <Fragment key={i}>
              <Seam on={placement === "seams"} index={i} engine={engine} settings={settings} />
              <div className="relative">
                {section}
                {placement === "chapters" && (
                  <InFlow engine={engine} kind="chapters" index={i} settings={settings} top={`calc(${position * 100}% - ${height / 2}px)`} />
                )}
              </div>
            </Fragment>
          ))}
          <Seam on={placement === "seams"} index={sections.length} engine={engine} settings={settings} />
        </main>
        {footer}
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

// A zero-height marker at the boundary between two sections.
function Seam({ on, index, engine, settings }: { on: boolean; index: number; engine: WaveEngine; settings: WaveSettings }) {
  const height = settings.stripHeight.seams;
  return (
    <div aria-hidden="true" className="relative h-0">
      {on && <InFlow engine={engine} kind="seams" index={index} settings={settings} top={`${settings.position.seams - height / 2}px`} />}
    </div>
  );
}

function InFlow({ engine, kind, index, settings, top }: { engine: WaveEngine; kind: Placement; index: number; settings: WaveSettings; top: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0"
      style={{ top, height: settings.stripHeight[kind], zIndex: -1, ...maskFor(settings, kind) }}
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
