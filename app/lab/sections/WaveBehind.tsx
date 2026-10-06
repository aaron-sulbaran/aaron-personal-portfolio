"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getMeasure, getServerMeasure, subscribeMeasure } from "../wave/anchorStore";
import { setDecision } from "../wave/decisionStore";
import { PathLayer } from "../wave/PathLayer";
import { DEFAULT_SETTINGS } from "../wave/settings";
import { chooseSpine } from "../wave/spineChoice";
import { getBandDecision, getServerBandDecision, subscribeBandDecision } from "./bandDecision";

// The wave lab's path layer behind the sections, at the wave lab's default
// settings (Aaron's pick), read only. Two changes: the spine's debug drawing
// is off, and with "link" on the draw speed cap comes from the shared lag, so
// a one-screen flick takes the line as long to catch up as it takes the text.
// Loaded lazily (WaveSlot), so a broken wave lab never takes this page down.

type EngineInfo = { length: number; maxScrollY: number };
const engineInfo = (): EngineInfo | null => {
  const engine = (window as unknown as { __wavePath?: { info: () => EngineInfo } }).__wavePath;
  return engine ? engine.info() : null;
};

export interface WaveBehindProps {
  reduced: boolean;
  lag: number;
  link: boolean;
  onSpeed: (pxPerSecond: number) => void;
}

export default function WaveBehind({ reduced, lag, link, onSpeed }: WaveBehindProps) {
  const measure = useSyncExternalStore(subscribeMeasure, getMeasure, getServerMeasure);
  const decision = useSyncExternalStore(subscribeBandDecision, getBandDecision, getServerBandDecision);
  const [ratio, setRatio] = useState(1.5);

  // Arc px per page px, read from the engine once its line is laid out.
  useEffect(() => {
    const read = () => {
      const info = engineInfo();
      if (info && info.length > 0 && info.maxScrollY > 0) setRatio(info.length / info.maxScrollY);
    };
    read();
    const id = window.setTimeout(read, 2500);
    return () => window.clearTimeout(id);
  }, [measure]);

  const [viewport, setViewport] = useState(900);
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const drawSpeed = link ? Math.max(50, Math.round((ratio * viewport) / lag / 50) * 50) : DEFAULT_SETTINGS.path.drawSpeed;
  useEffect(() => onSpeed(drawSpeed), [drawSpeed, onSpeed]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, path: { ...DEFAULT_SETTINGS.path, debug: false, drawSpeed } }), [drawSpeed]);
  const choice = useMemo(() => chooseSpine(settings.path, measure, settings.amplitude), [settings.path, measure, settings.amplitude]);

  useEffect(() => setDecision(decision), [decision]);

  return <PathLayer settings={settings} reduced={reduced} points={choice.def.points} />;
}
