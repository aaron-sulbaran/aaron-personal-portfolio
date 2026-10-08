"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { cardById } from "./cards";
import { Frame } from "./Frame";
import { GalleryContent, type Measure } from "./GalleryContent";
import { GalleryModal } from "./GalleryModal";
import { interleave, readingOrder } from "./rows";
import { PageBehind } from "./PageBehind";
import { Panel, type View } from "./Panel";
import { exportValues, INITIAL, PRESETS, sameSettings, type Settings } from "./settings";
import { desktopSteps, phoneSteps } from "./timing";
import type { Schedule } from "./useMaskIn";
import "./gallery.css";

// The bench for the photos inside a card's modal (docs/content/modal-gallery.md):
// a copy of the house modal shell over a stand-in page, inside a viewport
// frame, with the panel on the right. Desktop rows from 1024px, the phone
// stage under it, both masked in on a timer from the landing.

declare global {
  interface Window {
    __galleryLab?: { set: (patch: Partial<Settings>) => void; view: (patch: Partial<View>) => void; replay: () => void; get: () => { s: Settings; view: View; measure: Measure | null; schedule: Schedule | null } };
  }
}

const BREAKPOINT = 1024;
const PANEL_INSET = "372px";

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
}

const subscribeWide = (listener: () => void) => {
  const query = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

// Timing inputs replay the masks once a slider rests; layout inputs never do.
function useRestingKey(key: string, ms = 280) {
  const [resting, setResting] = useState(key);
  useEffect(() => {
    const id = window.setTimeout(() => setResting(key), ms);
    return () => window.clearTimeout(id);
  }, [key, ms]);
  return resting;
}

export function GalleryLab() {
  const [s, setS] = useState<Settings>(INITIAL);
  const [view, setViewState] = useState<View>({ card: "capital-one", frame: "window", layout: "auto", reduce: false, open: true });
  const [panelOpen, setPanelOpen] = useState(true);
  const [replays, setReplays] = useState(0);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const wideWindow = useSyncExternalStore(subscribeWide, () => window.matchMedia(`(min-width: ${BREAKPOINT}px)`).matches, () => true);
  const osReduced = useReducedMotionLive();
  const reduced = view.reduce || osReduced;
  const card = cardById(view.card);

  const setView = useCallback((update: (v: View) => View) => setViewState(update), []);
  const replay = useCallback(() => setReplays((n) => n + 1), []);
  const timingKey = useRestingKey(`${s.landingMs}|${s.maskMs}|${s.staggerMs}|${s.textSplit}|${s.lineStaggerMs}|${s.photoMask}|${s.settle}|${s.ease}`);
  const runKey = `${card.id}|${replays}|${timingKey}`;

  useEffect(() => {
    window.__galleryLab = {
      set: (patch) => setS((x) => ({ ...x, ...patch })),
      view: (patch) => setViewState((v) => ({ ...v, ...patch })),
      replay,
      get: () => ({ s, view, measure, schedule }),
    };
    return () => {
      delete window.__galleryLab;
    };
  }, [s, view, measure, schedule, replay]);

  const steps = useMemo(() => {
    const rows = interleave(card.blocks.length, card.photos, s.extrasPerRow);
    const o = { flown: card.flown, hasLinks: card.links.length > 0 };
    return { desktop: desktopSteps(rows, readingOrder(rows)[0], o), phone: phoneSteps(card.blocks.length, o) };
  }, [card, s.extrasPerRow]);
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  // The live run's steps carry the measured line counts; the other layout's
  // count every part as one line.
  const live = schedule && measure ? { ...steps, [measure.mode]: schedule.steps } : steps;
  const values = exportValues(s, preset ? preset.name : "custom", theme, live, card.name);

  const close = useCallback(() => setViewState((v) => ({ ...v, open: false })), []);
  const open = useCallback((id: string) => setViewState((v) => ({ ...v, card: id, open: true })), []);

  return (
    <div id="main" className="min-h-screen bg-background">
      <Frame frame={view.frame} inset={panelOpen && wideWindow ? PANEL_INSET : "0px"}>
        {(frame) => {
          const phone = view.layout === "phone" || (view.layout === "auto" && frame.width < BREAKPOINT);
          return (
            <>
              <PageBehind compact={frame.width < BREAKPOINT} onOpen={open} />
              <GalleryModal open={view.open} onClose={close} reduced={reduced} compact={phone} panelWidth={s.panelWidth} label={`${card.title}, photos and story`}>
                <GalleryContent card={card} s={s} phone={phone} theme={theme} reduced={reduced} frame={frame} runKey={runKey} onSchedule={setSchedule} onMeasure={setMeasure} />
              </GalleryModal>
            </>
          );
        }}
      </Frame>
      {panelOpen ? (
        <Panel
          s={s}
          view={view}
          theme={theme}
          osReduced={osReduced}
          phone={measure?.mode === "phone"}
          measure={view.open ? measure : null}
          doneAtMs={view.open && schedule ? Math.round(schedule.endMs) : null}
          values={values}
          edit={(update) => setS(update)}
          setView={setView}
          setTheme={setTheme}
          replay={replay}
          collapse={() => setPanelOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-4 right-4 z-[70] rounded-md bg-[var(--menu-panel)] px-2.5 py-1 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)] [font-family:system-ui]"
        >
          Show controls
        </button>
      )}
    </div>
  );
}
