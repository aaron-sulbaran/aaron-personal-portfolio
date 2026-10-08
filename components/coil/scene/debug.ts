import { Vector2 } from "three";
import { gestureOwner } from "@/lib/coil/capture";
import { parseDebugFlags, type DebugFlags } from "@/lib/coil/debugFlags";
import {
  cardDistancesPx,
  insideSilhouette,
  projectQuad,
  seamMarginPx,
  type Camera,
  type CoilGeometry,
  type Quad,
  type Silhouette,
} from "@/lib/coil/geometry";
import type { CoilShape } from "@/lib/coil/shape";
import type { Cards } from "./cards";
import type { Entrance } from "./entrance";
import type { Field } from "./field";
import type { Hover } from "./hover";
import type { Input } from "./input";
import type { Name } from "./name";
import type { NameDelta, NameProbe } from "./nameProbe";
import type { NameSurface } from "./nameSurface";
import type { Gl } from "./renderer";
import type { Shape } from "./shape";
import type { SceneCtx, SceneState } from "./state";
import type { CoilSceneApi } from "./types";
import type { UnwindWiring } from "./unwind";

// The scene's QA surface, all behind ?coildebug (and the ?drift pick it
// shares a parser with): the tokens, the window.__coil stats object the
// Playwright suite reads, and (with the flight token) the probe's scene hooks.
// Without the query nothing here is created and every call is a null check.
//
// Tokens: poster (the field's first frame, no cards, no name), still or
// still=<offset> (the scene at rest for the hero stills: cards and name drawn, the name at COIL.lockup.stillInk,
// the field at its first frame, the entrance done, the conveyor idle at
// <offset> cards, 0 for plain still; scripts/render-posters.mjs), nocards, noname, at=<s> (the field and the
// name's surface held on one moment), entrance=<ms> (the drawn entrance
// frozen there), throw=render, throw=frame (the error boundary paths), flight
// (lib/coil/flightProbe.ts), name (the wake grid and the per-letter readout
// over the hero, NameReadout.tsx), ink=<percent> (the name's ink held there;
// 100 shows the whole surface, the crease check). Any value turns on
// window.__coil.

export function debugTokens() {
  const value = new URLSearchParams(window.location.search).get("coildebug");
  return new Set(value ? value.split(",").map((token) => token.trim()) : []);
}

export type { DebugFlags };

export function readDebugFlags(): DebugFlags {
  return parseDebugFlags(window.location.search);
}

// Slice 7, QA only: ?coildebug=throw=frame throws from the loop a second in.
export function throwFrameAt() {
  return debugTokens().has("throw=frame") ? performance.now() + 1000 : Number.POSITIVE_INFINITY;
}

export type DebugStats = {
  intervals: number[];
  work: number[];
  steps: number[];
  envelope: number[];
  captured: number;
  released: number;
  geo?: CoilGeometry;
  offset: () => number;
  hovered: () => number;
  capturing: () => boolean;
  // ---- fx-input debug: the live wheel owner and the helix hull ----
  owner?: () => "coil" | "page" | "none";
  silhouette?: () => Silhouette | null;
  // Wheel capture at a viewport point: rule A (onCard, with the distances to
  // the nearest and second nearest pickable cards and the seam margin in
  // use), the hull that governs release and the hold, whether a real pointer
  // move has armed capture, and whether the last coil gesture still holds it.
  captureAt?: (clientX: number, clientY: number) => CaptureProbe;
  // ---- end fx-input debug ----
  api?: CoilSceneApi;
  // Slice 7: what the scene spends, as live (the DPR in use, the buffer,
  // the card textures actually uploaded).
  budget?: () => object;
  // Slice 7: every visible card's bent corners in viewport px (for the
  // header and greeting overlap checks).
  visibleQuads?: () => Quad[];
  // ---- the name debug: CPU ms of the name step (the surface's clock and the wake) per frame ----
  namePass?: number[];
  nameFx?: () => NameFx;
  // The wake grid over the lockup (a copy), for the ?coildebug=name overlay.
  nameWake?: () => { cols: number; rows: number; rect: { x: number; y: number; w: number; h: number }; wake: number[] };
  // The per-letter readout and lightness snapshots (scene/nameProbe.ts).
  nameProbe?: {
    contrast: NameProbe["contrast"];
    snap: (key: string) => boolean;
    delta: (a: string, b: string) => NameDelta | null;
    drop: (key: string) => boolean;
    clear: () => void;
    solidDelta: NameProbe["solidDelta"];
  };
  // The Fable lab's timing: the surface pass on the GPU (batched) and the wake on the CPU.
  nameBench?: (n?: number) => Promise<{ gpu: Awaited<ReturnType<NameSurface["benchGpu"]>>; cpuMs: number }>;
  // The surface target's mean color, bytes (for --name-surface-mean).
  nameSurfaceMean?: () => number[];
  // Each letter's mean contrast at rest ink as the per-letter reduction measured it.
  nameGlyphs?: () => number[];
  // ---- end the name debug ----
  // Slice 4: the entrance clock and the name.
  entrance?: () => object;
  // The Coil and Band toggle: the shape asked for, the clock (0 band, 1
  // coil), the pull, this frame's angular step beside the band's and the
  // rest's, and how many cards show.
  shape?: () => ShapeProbe;
  // Slice 5: the unwind and the row focus.
  unwindAt?: number[];
  unwindState?: () => object;
  unwindMs?: () => number;
  focusKey?: () => string | null;
  // Slice 7: the touch drag.
  drag?: () => object;
};

export type CaptureProbe = {
  onCard: boolean;
  cardPx: number;
  secondCardPx: number;
  seamPx: number;
  insideSilhouette: boolean;
  armed: boolean;
  held: boolean;
};

export type DebugReads = {
  offset: () => number;
  hovered: () => number;
  capturing: () => boolean;
  owner: () => "coil" | "page" | "none";
  silhouette: () => Silhouette | null;
};

// The live reads every stats object starts with.
export function debugReads(st: SceneState): DebugReads {
  return {
    offset: () => st.conveyor.offset,
    hovered: () => st.hoveredSlot,
    // ---- fx-input debug ----
    capturing: () => gestureOwner(st.capture, performance.now()) === "coil",
    owner: () => gestureOwner(st.capture, performance.now()) ?? "none",
    silhouette: () => st.sil,
    // ---- end fx-input debug ----
  };
}

// The stats object, installed as window.__coil (only with ?coildebug).
export function createDebugStats(flags: DebugFlags, reads: DebugReads): DebugStats | null {
  const debug: DebugStats | null = flags.debugMode
    ? {
        intervals: [],
        work: [],
        steps: [],
        envelope: [],
        captured: 0,
        released: 0,
        ...reads,
      }
    : null;
  if (debug) (window as unknown as { __coil?: DebugStats }).__coil = debug;
  return debug;
}

export type NameFx = {
  driftPreset: string;
  clock: number;
  wakeActive: boolean;
  wakeMax: number;
  surf: number[];
  surfIn: number;
  // The lockup: the greeting's and the name's cap heights (CSS px) and whether
  // the greeting sits inside the mask's rect.
  greetCap: number;
  nameCap: number;
  greetingInMask: boolean;
};

export type ShapeProbe = { target: CoilShape; progress: number; pull: number; angStep: number; bandAngStep: number; restAngStep: number | null; shown: number };

type HookParts = {
  gl: Gl;
  cards: Cards;
  field: Field;
  name: Name;
  surface: NameSurface;
  probe: NameProbe;
  entrance: Entrance;
  shape: Shape;
  hover: Hover;
  input: Input;
  unwinder: UnwindWiring;
  api: CoilSceneApi;
};

// The hooks read from the scene's parts, added to window.__coil in the order
// the Playwright suite has always seen them (budget, visibleQuads, nameFx,
// api, entrance, the unwind's, focusKey, drag; geo and namePass arrive as the
// scene lays out and runs).
export function installSceneHooks(ctx: SceneCtx, parts: HookParts) {
  const { debug, st, host, live, tileCount } = ctx;
  if (!debug) return;
  const { gl, cards, field, name, surface, probe, entrance, shape, hover, input, unwinder, api } = parts;
  debug.budget = () => {
    const buffer = gl.renderer.getDrawingBufferSize(new Vector2());
    const sizes = cards.textureSizes();
    return {
      input: live.current.input,
      dprCap: st.budget.dprCap,
      devicePixelRatio: window.devicePixelRatio,
      dpr: st.view.dpr,
      css: [st.view.width, st.view.height],
      buffer: [buffer.x, buffer.y],
      field: [gl.fieldTarget.width, gl.fieldTarget.height],
      textures: [...sizes],
      narrow: st.geo?.narrow ?? null,
      slots: st.geo?.slotCount ?? null,
      cards: tileCount,
    };
  };
  debug.visibleQuads = () => {
    if (!st.geoCamera) return [];
    const rect = host.getBoundingClientRect();
    return st.rendered
      .filter((pose) => pose && pose.alpha > 0.01)
      .map((pose) => projectQuad(pose, st.geoCamera as Camera, { left: rect.left, top: rect.top }));
  };
  debug.nameFx = () => {
    const lock = name.lockup();
    return {
      driftPreset: field.driftPreset(),
      ...surface.state(),
      surfIn: field.compMaterial.uniforms.uSurfIn.value,
      greetCap: lock?.greetCap ?? 0,
      nameCap: lock?.ascent ?? 0,
      greetingInMask: !!lock && lock.split > 0 && lock.split < lock.greetBlock + lock.pad,
    };
  };
  debug.nameWake = () => {
    const wake = surface.wake();
    return { cols: wake.cols, rows: wake.rows, rect: { ...surface.wakeRect() }, wake: Array.from(wake.E) };
  };
  debug.nameProbe = probe;
  debug.nameSurfaceMean = surface.measureMean;
  debug.nameGlyphs = name.glyphMeans;
  debug.nameBench = async (n = 40) => ({ gpu: await surface.benchGpu(n), cpuMs: surface.benchCpu() });
  debug.api = api;
  debug.entrance = () => ({
    ...entrance.clockState(),
    nameLanded: name.landed(),
    nameA: field.compMaterial.uniforms.uNameA.value,
    offset: st.conveyor.offset,
  });
  debug.shape = () => ({
    ...shape.state(), bandAngStep: (Math.PI * 2) / tileCount, restAngStep: st.geo?.angStep ?? null,
    shown: st.rendered.filter((pose) => pose && pose.alpha > 0.01).length,
  });
  Object.assign(debug, {
    unwindAt: [] as number[],
    unwindState: unwinder.unwindState,
    unwindMs: unwinder.unwindMs,
    focusKey: hover.focusKey,
  });
  debug.drag = input.dragState;
  debug.captureAt = (clientX, clientY) => {
    const x = clientX - (st.view.docLeft - window.scrollX);
    const y = clientY - (st.view.docTop - window.scrollY);
    const distances = st.geoCamera ? cardDistancesPx(st.poses, st.geoCamera, x, y) : null;
    return {
      onCard: hover.nearCardAt(x, y),
      cardPx: distances?.nearest ?? Number.POSITIVE_INFINITY,
      secondCardPx: distances?.second ?? Number.POSITIVE_INFINITY,
      seamPx: st.geo ? seamMarginPx(st.geo) : 0,
      insideSilhouette: st.sil !== null && insideSilhouette(st.sil, x, y),
      armed: st.capture.armed,
      held: st.capture.held,
    };
  };
}

export function removeDebugStats(debug: DebugStats | null) {
  if (debug) delete (window as unknown as { __coil?: DebugStats }).__coil;
}

export function pushStat(list: number[], value: number) {
  list.push(value);
  if (list.length > 6000) list.shift();
}
