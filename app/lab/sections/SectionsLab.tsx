"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { labFontVariables } from "../type/fonts";
import { AboutCopy } from "./AboutCopy";
import { BandCopy } from "./BandCopy";
import { ConnectCopy } from "./ConnectCopy";
import { probe } from "./grammar";
import { PANEL_WIDTH, Panel, type WaveState } from "./Panel";
import { PRESETS, type LabSettings } from "./settings";
import { UpCopy } from "./UpCopy";
import { useGrammar } from "./useGrammar";
import { useSectionsSettings } from "./useSectionsSettings";
import { WaveSlot } from "./WaveSlot";
import { WhoCopy } from "./WhoCopy";
import "./sections.css";

// The lab's client shell: the band stand-in, the four sections (the real
// components for "Site today", the lab's copies for the grammar), the real
// footer, the wave behind them in flow (as the wave lab mounts it) and the
// panel. Section wrappers carry data-lab-section, which the wave's path is
// measured against.

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as "light" | "dark";

declare global {
  interface Window {
    __sectionsLab?: {
      patch: (patch: Partial<LabSettings>) => void;
      preset: (id: string) => void;
      get: () => LabSettings;
      open: (open: boolean) => void;
      probe: typeof probe;
    };
  }
}

const KEYS = ["about", "who", "up", "connect"] as const;

export function SectionsLab({ today, footer }: { today: ReactNode[]; footer: ReactNode }) {
  const [s, setS] = useSectionsSettings();
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id);
  const [open, setOpen] = useState(true);
  const [simReduced, setSimReduced] = useState(false);
  const systemReduced = useReducedMotionLive();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const [waveAttempt, setWaveAttempt] = useState(0);
  const [waveFailed, setWaveFailed] = useState(false);
  const [waveSpeed, setWaveSpeed] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useGrammar(rootRef, s, simReduced);

  const edit = useCallback(
    (next: Partial<LabSettings>) => {
      setPresetId(null);
      setS((current) => ({ ...current, ...next }));
    },
    [setS],
  );

  useEffect(() => {
    window.__sectionsLab = {
      patch: (patch) => setS((current) => ({ ...current, ...patch })),
      preset: (id) => {
        const found = PRESETS.find((x) => x.id === id);
        if (!found) return;
        setPresetId(id);
        setS(found.values);
      },
      get: () => s,
      open: setOpen,
      probe,
    };
  }, [s, setS]);

  const onSpeed = useCallback((speed: number) => setWaveSpeed(speed), []);
  const onWaveFail = useCallback(() => setWaveFailed(true), []);
  const waveState: WaveState = !s.wave.show ? "off" : waveFailed ? "failed" : waveSpeed === null ? "loading" : "ok";
  const inset = open ? PANEL_WIDTH : 0;
  const sticky = (key: "who" | "up" | "connect") => s.sections[key].sticky && (key !== "up" || s.up.layout === "beside");
  const vars = {
    "--sl-sticky-top": `${s.stickyTop}px`,
    "--sl-stop": s.stickyStop === "early" ? `${s.stopOffset}px` : "0px",
  } as CSSProperties;

  const copies = [
    <AboutCopy key="about" face={s.kickerFace} />,
    <WhoCopy key="who" face={s.kickerFace} sticky={sticky("who")} />,
    <UpCopy key="up" face={s.kickerFace} sticky={sticky("up")} layout={s.up.layout} arrival={s.up.arrival} />,
    <ConnectCopy key="connect" face={s.kickerFace} sticky={sticky("connect")} />,
  ];
  const sections = s.source === "today" ? today : copies;

  return (
    <div className={`sl-root ${labFontVariables}`} style={vars}>
      <div className="relative z-10" style={{ marginRight: inset }}>
        {s.wave.show && (
          <WaveSlot
            attempt={waveAttempt}
            onFail={onWaveFail}
            reduced={systemReduced || simReduced}
            lag={s.lag}
            link={s.wave.link}
            onSpeed={onSpeed}
          />
        )}
        <main ref={rootRef} id="main" className="relative overflow-x-clip">
          <div data-lab-section="band">
            <BandCopy />
          </div>
          {sections.map((section, i) => (
            <div key={`${s.source}-${KEYS[i]}`} data-lab-section={KEYS[i]} className="relative">
              {section}
            </div>
          ))}
        </main>
        <div data-lab-section="footer">{footer}</div>
      </div>

      <Panel
        s={s}
        edit={edit}
        replace={setS}
        presetId={presetId}
        setPresetId={setPresetId}
        theme={theme}
        setTheme={(next) => {
          document.documentElement.dataset.theme = next;
        }}
        open={open}
        setOpen={setOpen}
        systemReduced={systemReduced}
        simReduced={simReduced}
        setSimReduced={setSimReduced}
        wave={{
          state: waveState,
          speed: waveSpeed,
          retry: () => {
            setWaveFailed(false);
            setWaveAttempt((n) => n + 1);
          },
        }}
      />
    </div>
  );
}
