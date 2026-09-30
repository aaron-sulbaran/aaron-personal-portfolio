// The shape of the QA hooks the site exposes behind ?coildebug (read only
// here; the scene and the loader own them). Type-only: nothing in this file
// runs in the page.
import type { Silhouette, Quad } from "@/lib/coil/geometry";

export type CoilHooks = {
  intervals: number[];
  work: number[];
  steps: number[];
  captured: number;
  released: number;
  offset: () => number;
  hovered: () => number;
  owner: () => "coil" | "page" | "none";
  silhouette: () => Silhouette | null;
  budget: () => Record<string, unknown>;
  visibleQuads: () => Quad[];
  entrance: () => { base: number | null; elapsedMs: number | null; ended: boolean; nameLanded: boolean; nameA: number; offset: number };
  drag: () => { dragging: boolean; coast: number | null; offset: number; target: number; velocity: number; cardsPerPx: number };
  unwindState: () => { on: boolean; latched: boolean; progress: number };
  focusKey: () => string | null;
  nameFx: () => { nameFill: string; driftPreset: string; repelActive: boolean; repelMax: number; nameClock: number };
  api: {
    cardAt: (clientX: number, clientY: number) => { key: string; slot: number } | null;
    slotOfKey: (key: string) => number;
    nameRect: () => { left: number; baseline: number; width: number; fontPx: number; gradient: { top: number; height: number } } | null;
  };
};

export type ProbePoint = { x: number; y: number };

export type SlotInfo = {
  slot: number;
  key: string;
  kind: "photo" | "work";
  quad: Quad;
  center: ProbePoint;
  outline: ProbePoint[][];
  grid: (ProbePoint & { s: number; t: number })[];
  hover: number;
  hovered: boolean;
  hidden: boolean;
  depth: number;
  alpha: number;
  fade: number;
};

export type FlightHooks = {
  rate: number;
  holdLanding: boolean;
  frame: number;
  log: { name: string; frame: number; at: number; data?: Record<string, unknown> }[];
  scene: {
    state: () => { offset: number; target: number; glide: boolean; hiddenSlot: number | null; looping: boolean; hover: number | null };
    follow: (slot: number) => void;
    slot: (slot: number) => SlotInfo | null;
    slots: () => SlotInfo[];
    hide: (slot: number | null) => void;
    seam: () => number;
    flown: () => Omit<SlotInfo, "slot" | "key" | "kind" | "hover" | "hovered" | "hidden" | "depth" | "alpha" | "fade"> | null;
    flight: () => { slot: number; state: string; gap: number } | null;
  };
};

export type LoaderHooks = {
  events: { t: number; event: string; data?: unknown }[];
  locks: { t: number; event: "locked" | "unlocked" }[];
  finish?: () => void;
};

export type HookWindow = Window & {
  __coil?: CoilHooks;
  __coilFlight?: FlightHooks;
  __coilLoader?: LoaderHooks;
};
