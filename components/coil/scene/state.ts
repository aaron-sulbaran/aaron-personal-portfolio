import type { RefObject } from "react";
import type { HomeTile } from "@/lib/content";
import type { CaptureState } from "@/lib/coil/capture";
import type { RenderBudget } from "@/lib/coil/drivers";
import type { FlightProbe } from "@/lib/coil/flightProbe";
import type { EntranceClock } from "@/lib/coil/entrance";
import type { Camera, CardPose, CoilGeometry, HelixFrame, Silhouette } from "@/lib/coil/geometry";
import { createEnvelope, createConveyor, createRowHold, type Conveyor, type Envelope, type RowHold } from "@/lib/coil/motion";
import type { CoilTheme } from "@/lib/coil/theme";
import { createUnwind, type UnwindState } from "@/lib/coil/unwind";
import { createCapture } from "@/lib/coil/capture";
import type { DebugFlags, DebugStats } from "./debug";
import type { CoilSceneProps } from "./types";

// What the scene's modules share. SceneCtx holds the handles that never
// change for the scene's life; SceneState (ctx.st) holds the state more than
// one module reads. A module's own state stays in its own closure. Which
// module writes which field is listed in docs/coil-scene-modules.md.

export type View = { width: number; height: number; dpr: number; docTop: number; docLeft: number };

export type Pointer = { clientX: number; clientY: number; x: number; y: number; inside: boolean; known: boolean };

export type SceneState = {
  theme: CoilTheme;
  // Slice 7: the render budget follows the input driver (coarse pointers cap
  // the DPR at 2 and paint smaller card textures).
  budget: RenderBudget;
  view: View;
  geo: CoilGeometry | null;
  geoCamera: Camera | null;
  nameFamily: string;
  conveyor: Conveyor;
  envelope: Envelope;
  unwind: UnwindState;
  poses: CardPose[];
  rendered: CardPose[];
  sil: Silhouette | null;
  hoveredSlot: number;
  hiddenSlot: number | null;
  pointer: Pointer;
  // ---- fx-input state: who owns the wheel gesture, and the book row hold ----
  capture: CaptureState;
  rowHold: RowHold;
  // ---- slice 7 state: the touch drag and its coast ----
  dragging: boolean;
  coast: { rest: number } | null;
  pressCaughtCoil: boolean; // this touch stopped a coast: it is a catch, not a tap
  rebuildAt: number | null; // when the last rebuild began
  // ---- the loop ----
  lastFieldTime: number;
  lastScrollY: number;
  lastTime: number;
  raf: number;
  ready: boolean;
  disposed: boolean;
  visible: boolean;
  frozenByApi: boolean;
  contextLost: boolean;
  firstFrameSent: boolean;
  // ---- fx-flight state ----
  resuming: boolean; // the next frame is the first after a stop
  landedAhead: boolean; // a flight landed; the frozen prop has yet to follow
  pendingSize: { width: number; height: number } | null;
};

export type SceneCtx = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  live: RefObject<CoilSceneProps>;
  tiles: readonly HomeTile[];
  tileCount: number;
  flags: DebugFlags;
  debug: DebugStats | null;
  flightLog: FlightProbe | null;
  st: SceneState;
};

// One frame's record: the props as the frame began, the geometry it runs
// on, and what each step hands the next (lib/coil/frame.ts holds the order).
export type SceneFrame = {
  dt: number;
  now: number;
  props: CoilSceneProps;
  geo: CoilGeometry;
  camera: Camera;
  scrollDelta: number;
  helix: HelixFrame | null;
  clock: EntranceClock | null;
  realElapsedMs: number;
  rebuilt: number;
  listProgress: number;
};

// The loop's entry points, for modules created before it (bound late: none
// is called before startCoil returns).
export type LoopLink = {
  wake: () => void;
  stop: () => void;
  renderStill: () => void;
  shouldRun: () => boolean;
  update: (dt: number, now: number) => void;
  render: (dt: number) => void;
};

export function createSceneState(theme: CoilTheme, budget: RenderBudget): SceneState {
  return {
    theme,
    budget,
    view: { width: 1, height: 1, dpr: 1, docTop: 0, docLeft: 0 },
    geo: null,
    geoCamera: null,
    nameFamily: "",
    conveyor: createConveyor(0),
    envelope: createEnvelope(),
    unwind: createUnwind(),
    poses: [],
    rendered: [],
    sil: null,
    hoveredSlot: -1,
    hiddenSlot: null,
    pointer: { clientX: -1, clientY: -1, x: -1, y: -1, inside: false, known: false },
    capture: createCapture(),
    rowHold: createRowHold(),
    dragging: false,
    coast: null,
    pressCaughtCoil: false,
    rebuildAt: null,
    lastFieldTime: Number.NaN,
    lastScrollY: window.scrollY,
    lastTime: performance.now(),
    raf: 0,
    ready: false,
    disposed: false,
    visible: true,
    frozenByApi: false,
    contextLost: false,
    firstFrameSent: false,
    resuming: false,
    landedAhead: false,
    pendingSize: null,
  };
}
