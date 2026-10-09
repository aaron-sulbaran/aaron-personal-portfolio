"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { cardById, drawnShape, shapeLabel } from "./cards";
import { cardLayout, desktopColumns, groupingOf, stepsOf } from "./cardSteps";
import { Frame } from "./Frame";
import { GalleryContent, type Measure } from "./GalleryContent";
import { GalleryModal } from "./GalleryModal";
import { boxFor, uniformBoxes } from "./plan";
import { isWide } from "./rows";
import { PageBehind } from "./PageBehind";
import { Panel, type View } from "./Panel";
import { exportValues, INITIAL, PRESETS, sameSettings, type Settings } from "./settings";
import { seekMasks, type Schedule } from "./useMaskIn";
import "./gallery.css";

// The bench for the photos inside a card's modal (docs/content/modal-gallery.md):
// a copy of the house modal shell over a stand-in page, inside a viewport
// frame, with the panel on the right. Desktop rows from 1024px, the phone
// stage under it, both masked in on a timer from the landing.

declare global {
  interface Window {
    __galleryLab?: { set: (patch: Partial<Settings>) => void; view: (patch: Partial<View>) => void; replay: () => void; seek: (ms: number | null) => boolean; get: () => { s: Settings; view: View; measure: Measure | null; schedule: Schedule | null } };
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
  const [shapeOverrides, setShapeOverrides] = useState<Record<string, number[]>>({});
  const shapes = useMemo(() => shapeOverrides[card.id] ?? card.photos.map((p) => p.shape), [shapeOverrides, card]);
  const setShape = useCallback(
    (index: number, aspect: number) =>
      setShapeOverrides((all) => {
        const current = all[card.id] ?? card.photos.map((p) => p.shape);
        return { ...all, [card.id]: current.map((a, i) => (i === index ? aspect : a)) };
      }),
    [card],
  );
  const resetShapes = useCallback(() => setShapeOverrides((all) => ({ ...all, [card.id]: card.photos.map((p) => p.shape) })), [card]);

  const setView = useCallback((update: (v: View) => View) => setViewState(update), []);
  const replay = useCallback(() => setReplays((n) => n + 1), []);
  const timingKey = useRestingKey(`${s.landingMs}|${s.maskMs}|${s.staggerMs}|${s.textSplit}|${s.lineStaggerMs}|${s.photoMask}|${s.settle}|${s.ease}`);
  const runKey = `${card.id}|${replays}|${timingKey}`;

  useEffect(() => {
    window.__galleryLab = {
      set: (patch) => setS((x) => ({ ...x, ...patch })),
      view: (patch) => setViewState((v) => ({ ...v, ...patch })),
      replay,
      seek: seekMasks,
      get: () => ({ s, view, measure, schedule }),
    };
    return () => {
      delete window.__galleryLab;
    };
  }, [s, view, measure, schedule, replay]);

  const aspects = useMemo(() => card.photos.map((_, i) => drawnShape(card, i, shapes[i])), [card, shapes]);
  const steps = useMemo(() => {
    const layout = cardLayout(card, aspects, s);
    return { desktop: stepsOf(card, layout, s, "desktop"), phone: stepsOf(card, layout, s, "phone") };
  }, [card, aspects, s]);
  // Round four sizes the panel from the card's photo column and the text
  // column; the earlier rounds from the panel width setting.
  const panelWidth = s.desktopLayout === "rows" ? desktopColumns(aspects, s).panel : s.panelWidth;
  const boxes = uniformBoxes(s.verticalWidth, s.horizontalWidth, s.horizontalShape);
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  // The live run's steps carry the measured line counts; the other layout's
  // count every part as one line.
  const live = schedule && measure ? { ...steps, [measure.mode]: schedule.steps } : steps;
  const values = {
    ...exportValues(s, preset ? preset.name : "custom", theme, live, card.name),
    shapesOnThisCard: card.photos.map((p, i) => {
      const aspect = aspects[i];
      if (s.desktopLayout === "rows") {
        const box = boxFor(aspect, boxes, s.wideFrom);
        const which = box === boxes.horizontal ? "the horizontal box" : "the vertical box";
        return `${p.intended}: ${shapeLabel(aspect)}, ${i === card.flownPhoto ? "the flown card picture, first row, " : ""}drawn in ${which} (${box.width} by ${Math.round(box.height)}px)`;
      }
      const where = i === card.flownPhoto ? `the flown card picture, leading ${s.leadMode === "title" ? "beside the title" : "beside the first block"}` : isWide(aspect, s.wideFrom) ? "spans the row" : "beside its paragraph";
      return `${p.intended}: drawn ${shapeLabel(aspect)}, ${where}`;
    }),
    ...(s.desktopLayout === "rows" ? { panelOnThisCard: `${panelWidth}px asked, ${measure?.panelPx ?? "unmeasured"}px drawn` } : {}),
    ...(s.desktopLayout === "rows" || s.phoneLayout === "pager" ? { groupingOnThisCard: groupingOf(card, aspects, s) } : {}),
  };

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
              <GalleryModal
                open={view.open}
                onClose={close}
                reduced={reduced}
                compact={phone}
                panelWidth={panelWidth}
                sheetHeight={phone && s.phoneLayout === "pager" ? frame.height - 48 : undefined}
                label={`${card.title}, photos and story`}
              >
                <GalleryContent card={card} shapes={shapes} s={s} phone={phone} theme={theme} reduced={reduced} frame={frame} panelWidth={panelWidth} runKey={runKey} onSchedule={setSchedule} onMeasure={setMeasure} onDismiss={close} />
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
          card={card}
          shapes={shapes}
          setShape={setShape}
          resetShapes={resetShapes}
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
