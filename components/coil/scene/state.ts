import type { RefObject } from "react";
import type { StrandCard } from "@/lib/content";
import type { CaptureState } from "@/lib/coil/capture";
import type { RenderBudget } from "@/lib/coil/drivers";
import { FIELD } from "@/lib/coil/field.glsl";
import type { FlightProbe } from "@/lib/coil/flightProbe";
import type { EntranceClock, FieldMask } from "@/lib/coil/entrance";
import type { Camera, CardPose, CoilGeometry, HelixFrame, Silhouette } from "@/lib/coil/geometry";
import { createEnvelope, createConveyor, createRowHold, type Conveyor, type Envelope, type RowHold } from "@/lib/coil/motion";
import type { CoilTheme } from "@/lib/coil/theme";
import { createUnwind, type UnwindState } from "@/lib/coil/unwind";
import { createCapture } from "@/lib/coil/capture";
import type { DebugFlags, DebugStats } from "./debug";
import { NO_RIBBON, type RibbonBox } from "./ribbonSlot";
import type { CoilSceneProps } from "./types";

// What the scene's modules share. SceneCtx holds the handles that never
// change for the scene's life; SceneState (ctx.st) holds the state more than
// one module reads. A module's own state stays in its own closure. Which
// module writes which field is listed in docs/coil-scene-modules.md.

export type View = { width: number; height: number; dpr: number };

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
  // The stage is page 2's phone layout (the columns under the Coil, no pane
  // beside them), as of the last layout: the band's own card size
  // (COIL.phone) and a drag for any pointer.
  phoneStage: boolean;
  // The field's opening (radius 0: the faded patch behind the paragraphs stays
  // faded; the field itself is always drawn).
  open: FieldMask;
  // Where page 1's foot put the ribbon's slot, as of the last layout (scene/ribbonSlot.ts).
  ribbon: RibbonBox;
  // How tall the canvas's bottom seam is now, as a share of its height: the
  // field and the cards fade into the page there (the entrance step writes it:
  // none while the stage is stuck at the top of the screen, whole once it lets go).
  seam: number;
  // ---- the loop ----
  lastFieldTime: number;
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
  tiles: readonly StrandCard[];
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

// conveyorStart: the conveyor's offset at the first frame, in cards (the
// still's measured phase; 0 for every other scene).
export function createSceneState(theme: CoilTheme, budget: RenderBudget, conveyorStart = 0): SceneState {
  return {
    theme,
    budget,
    view: { width: 1, height: 1, dpr: 1 },
    geo: null,
    geoCamera: null,
    nameFamily: "",
    conveyor: createConveyor(conveyorStart),
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
    phoneStage: false,
    open: { cx: 0, cy: 0, radius: 0, feather: 0 },
    ribbon: NO_RIBBON,
    seam: FIELD.seamFade,
    lastFieldTime: Number.NaN,
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
