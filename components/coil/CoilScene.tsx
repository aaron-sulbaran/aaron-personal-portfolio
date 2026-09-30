"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  type Texture,
} from "three";
import { siteContent, strandTiles } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import {
  cameraFor,
  coilPose,
  insideSilhouette,
  isNarrow,
  mod,
  pickCard,
  poseAt,
  projectPoint,
  projectQuad,
  rayThrough,
  restHelix,
  silhouette,
  solveGeometry,
  type Camera,
  type CardPose,
  type CoilGeometry,
  type Quad,
  type Silhouette,
} from "@/lib/coil/geometry";
import {
  addWheel,
  createConveyor,
  createEnvelope,
  stepConveyor,
  stepEnvelope,
  stretchedDy,
  wheelPixels,
} from "@/lib/coil/motion";
import { entranceClock, entranceHelix, entranceNameAlpha, entrancePose, isRested } from "@/lib/coil/entrance";
import { createUnwind, unwindPose, unwindProgress } from "@/lib/coil/unwind";
import { budgetFor, sameBudget, type InputDriver } from "@/lib/coil/drivers";
import { Observer } from "@/lib/gsap";
import { COMPOSITE_FRAG, COMPOSITE_VERT, FIELD, FIELD_FRAG, FULLSCREEN_VERT } from "@/lib/coil/field.glsl";
import { createCardGeometry, createCardMaterial, type CardUniforms, type SharedCardUniforms } from "@/lib/coil/material";
import { seenRingDpr } from "@/lib/coil/material"; // fx-hero
import { loadCardSource, paintCard, type CardSource } from "@/lib/coil/textures";
import {
  applyColor,
  createRepaintQueue,
  disableColorManagement,
  readCoilTheme,
  toBytes,
  watchTheme,
  type CoilTheme,
} from "@/lib/coil/theme";
import { getSeen } from "@/lib/home/seen";
// ---- fx-input imports: wheel ownership and the row hold ----
import {
  createCapture,
  decideWheel,
  feedsPageScroll,
  gestureOwner,
  heroVisibleFraction,
  nudgeShown,
  pointerMoved,
} from "@/lib/coil/capture";
import { createRowHold, rowHoldWeight, setRowHold } from "@/lib/coil/motion";
// ---- end fx-input imports ----
import { setSceneHover } from "@/lib/cursor/hover";
import type { HeroOverlayHandle } from "./HeroOverlay";
// Slice 4: the loader's tally and the name handoff.
import { reportHomeLoad } from "@/lib/loader/progress";
import type { NameTarget } from "@/lib/loader/handoff";
// ---- slice 5 imports: the book, the unwind egg and the flight ----
import { clamp01, helixRotation, smoothstep01, unprojectToPlane, type HelixFrame } from "@/lib/coil/geometry";
import { hoverJumpTarget, siteEase, startGlide, type JumpBand } from "@/lib/coil/motion";
import { settleUnwind, toggleUnwind, unwindDurationMs } from "@/lib/coil/unwind";
import { isConvex } from "@/lib/coil/flight";
// ---- end slice 5 imports ----
// ---- fx-hero imports: the greeting in the name, the name's fill and repel, the drift presets ----
// (DataTexture, RGBAFormat and UnsignedByteType come in with the fx-flight imports.)
import { DRIFT_PRESETS, fieldClocks, parseDriftPreset, type DriftPreset } from "@/lib/coil/drift";
import { COIL_FX_EVENT, NAME_FILL, NAME_FILLS, parseNameFill, type CoilFxDetail, type NameFill } from "@/lib/coil/field.glsl";
import { REPEL, createRepelField, encodeRepel, injectStroke, maxOffset, stepRepel } from "@/lib/coil/repel";
import { LOADER } from "@/lib/loader/progress";
// ---- end fx-hero imports ----
// ---- fx-flight imports ----
import { DataTexture, DoubleSide, GreaterDepth, RGBAFormat, UnsignedByteType } from "three";
import { flightProbe } from "@/lib/coil/flightProbe";
import { bendLocal as bendLocalPoint } from "@/lib/coil/geometry";
import {
  afterPause,
  flightPoseAt,
  handoff,
  poseGap,
  resumeStep,
  seatPose,
  slotPose,
  type FlightPose,
  type HandoffAction,
  type HandoffEvent,
  type HandoffState,
  type Rect,
} from "@/lib/coil/flight";
import { CARD_VERT } from "@/lib/coil/material";
// ---- end fx-flight imports ----

// The Coil scene: the dynamic chunk CoilStage imports after first paint. It
// owns the renderer, the two field passes, the helix of cards, the loop, the
// input and the picking; React only mounts it. Ported from hero lab 2 (518-531
// renderer, 1098-1316 update, 1362-1394 input, 1485-1514 frame).
//
// Frame order: scroll delta, conveyor (idle, wheel, page scroll; one smoothing
// stage and the spin cap), stretch envelope, helix frame, [entrance], slots,
// [unwind], hover lift, seen ring, picking, nudge, then field (only when its
// clock moved), composite, cards. The bracketed stages are the slice 4 and 5
// wiring blocks; their modifiers are the identity until then.
//
// It renders only when needed: never while the tab is hidden, the hero is
// off screen, a modal holds the scene frozen, or the context is lost.

// tap: the card was touched (slice 7), so it opens with no flight.
export type CoilCardRef = { key: string; slot: number; tap?: boolean };

// ---- slice 5 api: the book, the unwind egg and the flight ----
export type CoilCardFaces = { front: HTMLCanvasElement; back: HTMLCanvasElement };

export type CoilFlightApi = {
  // The flight's source: the slot's bent corners as last rendered, or the
  // flat card's corners when a card nearly edge on folds them concave.
  flightQuadOf: (slot: number) => Quad | null;
  // The card's own painted faces (the canvases its textures upload).
  facesOf: (slot: number) => CoilCardFaces | null;
  // The slot showing a card: its latched copy while unwound, else the
  // front-most visible copy. -1 when none is on screen.
  slotOfKey: (key: string) => number;
  // Hover-jump: glides the nearest copy of the card to the front of the
  // visible helix (600ms, site ease); null ends the focus.
  focusCard: (key: string | null) => void;
  // The unwind egg: sets (or toggles) it; false winds the coil back.
  unwind: (on?: boolean) => void;
};
// ---- end slice 5 api ----

// ---- fx-flight api: the flown card ----
// One flight, from the card's seat in the coil into the modal's slot and
// back. The scene draws the card itself (the card shader, its bend, shading
// and lift) into a canvas of its own above the modal, so both swaps between
// the mesh and the flown card draw the same pixels.
export type CoilFlightHandle = {
  // Draws the flown card at e: 0 on its seat, 1 in `rect` (the modal's slot,
  // viewport px; null keeps the last one). dt (seconds) moves the lift on the
  // way home. Returns the card's four corners in viewport px (the flat
  // card's), or null when the card cannot be drawn any more.
  draw: (e: number, rect: Rect | null, dt: number) => Quad | null;
  // The card reached the slot.
  arrive: () => void;
  // The card heads home.
  close: () => void;
  // The scene's layout as the last draw saw it: a parked card is drawn again
  // when this changes (a resize).
  stamp: () => string;
  // The card is drawn on its seat: the mesh shows, the flown card clears,
  // and the scene resumes on the next frame.
  land: () => void;
  // Torn down part way: the mesh shows where it is.
  abort: () => void;
};

export type CoilFlownApi = {
  // Starts a flight for the slot, mounting the flown card's canvas in `mount`
  // (a fixed layer above the modal). Draws the card on its seat and hides the
  // mesh before it returns. Null when the card cannot be flown.
  beginFlight: (slot: number, mount: HTMLElement) => CoilFlightHandle | null;
};
// ---- end fx-flight api ----

// For slices 4 and 5 (the entrance and the flight): the live scene, read
// without a React render.
export type CoilSceneApi = CoilFlightApi &
  CoilFlownApi & {
  // Stops (true) or resumes (false) rendering at once; the last frame stays.
  // The flight freezes before its modal activates, so the blur sits over a
  // still scene and the card's rendered pose equals its flight pose.
  freeze: (on: boolean) => void;
  // The card under a viewport point, from the last rendered frame.
  cardAt: (clientX: number, clientY: number) => CoilCardRef | null;
  // A slot's four bent corners in viewport px, as last rendered (lift included).
  quadOf: (slot: number) => Quad | null;
  // Hides one slot's mesh (the flown card) or none.
  hideSlot: (slot: number | null) => void;
  // ---- slice 4: the loader's continuity exit ----
  // The canvas name in viewport px (its ink box, baseline and gradient), for
  // the loader to land its DOM name on; null until the scene has laid out.
  nameRect: () => NameTarget | null;
  // Shows the canvas name now, rendering this frame synchronously, so the
  // loader can drop its DOM name in the same task with no frame between.
  landName: () => void;
  // ---- end slice 4 ----
};

// Slice 4: when the entrance plays. startMs is on the performance.now()
// clock (it may be in the future: the loader overlaps its exit); -Infinity
// means no entrance (a fast start), so the coil is at rest from its first
// frame. nameFromLoader: the loader lands the name (the canvas name waits for
// landName); otherwise it fades up behind the band as the band opens.
export type CoilEntrance = { startMs: number; nameFromLoader: boolean };

export type CoilSceneProps = {
  frozen: boolean; // a modal is open
  interactive: boolean; // the hero is ready (no entrance playing)
  input: InputDriver;
  overlay: RefObject<HeroOverlayHandle | null>;
  api?: RefObject<CoilSceneApi | null>;
  onFirstFrame: () => void;
  onContextLost: () => void;
  onError: (error: unknown) => void;
  // Slice 5 flies the card into its modal; until then a click does nothing.
  onCardClick?: (card: CoilCardRef) => void;
  // ---- slice 4: the entrance ----
  // Null: not started (cards hidden, the name held by the loader).
  entrance?: CoilEntrance | null;
  // Once, when the entrance's clock has run out (at once for a fast start).
  onEntranceEnd?: () => void;
  // ---- end slice 4 ----
};

export default function CoilScene(props: CoilSceneProps) {
  // Slice 7, QA only: ?coildebug=throw=render throws here, into the error
  // boundary (the poster and the book carry on).
  if (typeof window !== "undefined" && debugTokens().has("throw=render")) throw new Error("coildebug: scene render");
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(props);
  const runtimeRef = useRef<CoilRuntime | null>(null);

  useEffect(() => {
    liveRef.current = props;
    runtimeRef.current?.sync();
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let runtime: CoilRuntime | null = null;
    try {
      runtime = startCoil(host, canvas, liveRef);
    } catch (error) {
      liveRef.current.onError(error);
      return;
    }
    runtimeRef.current = runtime;
    return () => {
      runtime?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <div ref={hostRef} aria-hidden="true" className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

// ---------------------------------------------------------------- runtime

function debugTokens() {
  const value = new URLSearchParams(window.location.search).get("coildebug");
  return new Set(value ? value.split(",").map((token) => token.trim()) : []);
}

// Slice 7: how much of a card may show under a narrow pane's clear top band:
// 1 while its projected top edge stays a quarter card below the band, fading
// to 0 as that edge reaches it, so no card ever crosses the mark, the Menu
// pill or the greeting's line. Faded cards are never picked.
const HEADER_FADE_CARDS = 0.25;
function headerClearance(pose: CardPose, geo: CoilGeometry, camera: Camera) {
  if (pose.alpha <= 0.001) return 1;
  const quad = projectQuad(pose, camera);
  const top = Math.min(quad[0].y, quad[1].y, quad[2].y, quad[3].y);
  return smoothstep01(clamp01((top - geo.clearTopPx) / (HEADER_FADE_CARDS * geo.cardPx)));
}

// sync: the props changed (the input driver may have, and with it the budget).
type CoilRuntime = { wake: () => void; sync: () => void; dispose: () => void };

// Slice 7, the touch drag: a released flick coasts on this time constant (an
// exponential throw, distance = velocity * tau) and settles on a card.
const COAST_TAU_S = 0.325;
const COAST_SETTLED_CARDS = 0.002;
const DRAG_MINIMUM_PX = 4;
// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over this, so nothing pops.
const REBUILD_FADE_MS = 450;
const REBUILD_WIDTH_CHANGE = 0.2;
const TEXTURE_TIMEOUT_MS = 6000; // the loader's give-up time: a slow photo paints the plain pane
const CLICK_SLOP_PX = 6;
const HOVER_RATE = 6.5; // 1/s, the lift's soft approach (no overshoot)
const SEEN_RATE = 8;
const HOVER_SCALE = 0.045;
const HOVER_BRIGHT = 0.05;
const HOVER_UNFADE = 0.6;
// A hover-jump lands a card's center at least a quarter card inside the
// visible band, so most of the card shows.
const JUMP_INSET_CARDS = 0.25;
// A theme repaint starts no new card past this much of a frame (at most 4).
const REPAINT_BUDGET_MS = 6;

// ---- fx-hero: the name lockup and the greeting's fade ----
// "Hi, I'm" and "Aaron" in one mask, both Profa Black in white on clear: the
// greeting small (its cap height NAME_FILL.greetingCap of the name's), on the
// name's left edge, its lowest ink a fraction of its own cap height above the
// top of the "A". Everything in CSS px; the canvas is `scale` times that.
type NameLockup = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pad: number;
  nameInkWidth: number;
  ascent: number; // the name's
  descent: number;
  greetBlock: number; // the greeting's band above the name's own mask
  split: number; // where the greeting's alpha gives way to the name's
};

function paintNameLockup(greeting: string, name: string, family: string, sizePx: number, scale: number): NameLockup {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  g.font = `900 100px ${family}`;
  const cap100 = g.measureText("H").actualBoundingBoxAscent || 70;
  const nameFont = `900 ${sizePx}px ${family}`;
  g.font = nameFont;
  const nm = g.measureText(name);
  const greetPx = ((NAME_FILL.greetingCap * nm.actualBoundingBoxAscent) / cap100) * 100;
  const greetFont = `900 ${greetPx}px ${family}`;
  g.font = greetFont;
  const gm = g.measureText(greeting);
  const gAscent = gm.actualBoundingBoxAscent;
  const gDescent = Math.max(0, gm.actualBoundingBoxDescent);
  const gap = NAME_FILL.greetingGap * gAscent;
  const greetBlock = gAscent + gDescent + gap;
  const pad = Math.ceil(sizePx * 0.04);
  const nameInkWidth = nm.actualBoundingBoxLeft + nm.actualBoundingBoxRight;
  const greetInkWidth = gm.actualBoundingBoxLeft + gm.actualBoundingBoxRight;
  // The greeting's stem sits a hair inside the A's foot, as the lab's did.
  const greetShift = sizePx * 0.02;
  const width = Math.ceil(Math.max(nameInkWidth, greetShift + greetInkWidth) + pad * 2);
  const height = Math.ceil(greetBlock + nm.actualBoundingBoxAscent + nm.actualBoundingBoxDescent + pad * 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, width, height);
  g.fillStyle = "white";
  g.textBaseline = "alphabetic";
  g.font = greetFont;
  g.fillText(greeting, pad + greetShift + gm.actualBoundingBoxLeft, pad + gAscent);
  g.font = nameFont;
  g.fillText(name, pad + nm.actualBoundingBoxLeft, pad + greetBlock + nm.actualBoundingBoxAscent);
  return {
    canvas,
    width,
    height,
    pad,
    nameInkWidth,
    ascent: nm.actualBoundingBoxAscent,
    descent: nm.actualBoundingBoxDescent,
    greetBlock,
    split: pad + gAscent + gDescent + gap / 2,
  };
}

// The greeting's alpha. After the loader it fades up over NAME_FILL.
// greetingFadeMs from the middle of the loader's exit (the loader lands on
// "Aaron" only); otherwise it rises with the name as the band opens.
function greetingAlpha(entrance: CoilEntrance | null, nowMs: number, nameAlpha: number) {
  if (!entrance || !entrance.nameFromLoader || !Number.isFinite(entrance.startMs)) return nameAlpha;
  const startMs = entrance.startMs - (LOADER.exitMs - LOADER.entranceOverlapMs) + LOADER.exitMs / 2;
  const x = clamp01((nowMs - startMs) / NAME_FILL.greetingFadeMs);
  return siteEase(x);
}

// ---- end fx-hero ----

type DebugStats = {
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
  // ---- end fx-input debug ----
  api?: CoilSceneApi;
  // Slice 7: what the scene spends, as live (the DPR in use, the buffer,
  // the card textures actually uploaded).
  budget?: () => object;
  // ---- fx-hero debug: CPU ms of the name pass (the fill's clock and the repel) per frame ----
  namePass?: number[];
  nameFx?: () => object;
  // ---- end fx-hero debug ----
};

function startCoil(host: HTMLElement, canvas: HTMLCanvasElement, live: RefObject<CoilSceneProps>): CoilRuntime {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get("coildebug");
  const posterMode = debugMode === "poster";

  disableColorManagement();
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(new Color(0, 0, 0), 0);
  renderer.autoClear = false;

  const tiles = strandTiles;
  const tileCount = tiles.length;
  let theme: CoilTheme = readCoilTheme();
  // Slice 7: the render budget follows the input driver (coarse pointers cap
  // the DPR at 2 and paint smaller card textures).
  let budget = budgetFor(live.current.input);

  // ---- passes
  const orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const camera = new PerspectiveCamera(COIL.camera.fovDeg, 1, 0.1, 100);
  const fieldScene = new Scene();
  const compScene = new Scene();
  const cardScene = new Scene();
  const fieldTarget = new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const uView = { value: new Vector4(0, 0, 1, 1) };
  const quad = new PlaneGeometry(2, 2);

  // ---- fx-hero state: the fill, the drift preset and the repel buffer ----
  let nameFill: NameFill = parseNameFill(params.get("name"));
  let driftPreset: DriftPreset = parseDriftPreset(params.get("drift"));
  const repel = createRepelField();
  const repelBytes = new Uint8Array(REPEL.cols * REPEL.rows * 4);
  encodeRepel(repel, repelBytes);
  const repelTexture = new DataTexture(repelBytes, REPEL.cols, REPEL.rows, RGBAFormat, UnsignedByteType);
  repelTexture.minFilter = LinearFilter;
  repelTexture.magFilter = LinearFilter;
  repelTexture.needsUpdate = true;
  let repelUploaded = true; // the texture holds the buffer's rest state
  const repelLast = { clientX: Number.NaN, clientY: Number.NaN };
  let nameClock = 0; // seconds of the fill's idle motion
  let greetBlock = 0; // the greeting's band above the name's mask, CSS px at rest
  let fillInFrom: number | null = null; // when the loader's solid name landed
  const repelRect = { x: 0, y: 0, w: 0, h: 0 };
  const strokeFrom = { x: 0, y: 0 };
  const strokeTo = { x: 0, y: 0 };
  // QA only: ?coildebug=nocards hides the helix (contrast reads of the name);
  // ?coildebug=at=<seconds> holds the field and the fill on one moment.
  const qaTokens = debugTokens();
  const hideCards = qaTokens.has("nocards");
  const heldAtToken = [...qaTokens].map((token) => token.match(/^at=(\d+(?:\.\d+)?)$/)).find(Boolean);
  const heldAt = heldAtToken ? Number(heldAtToken[1]) : null;
  // ---- end fx-hero state ----

  const fieldMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {
      uT: { value: 0 },
      // ---- fx-hero: the weather clock and warp (drift presets) ----
      uTw: { value: 0 },
      uWarp: { value: DRIFT_PRESETS[driftPreset].warp },
      // ---- end fx-hero ----
      uAspect: { value: 1.6 },
      uAmt: { value: FIELD.amount },
      uSec: { value: theme.field.secondStrength },
      uSecAt: { value: new Vector2(...FIELD.secondAt) },
      uSecScale: { value: new Vector2(...FIELD.secondScale) },
      uTop: { value: new Color() },
      uBottom: { value: new Color() },
      uGlow: { value: new Color() },
      uSecond: { value: new Color() },
    },
  });
  const fieldMesh = new Mesh(quad, fieldMaterial);
  fieldMesh.frustumCulled = false;
  fieldScene.add(fieldMesh);

  let nameTexture: Texture | null = null;
  const compMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: COMPOSITE_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
      uField: { value: fieldTarget.texture },
      uName: { value: null },
      uView,
      uNameRect: { value: new Vector4(0, 0, 1, 1) },
      uFull: { value: new Vector2(1, 1) },
      uPaper: { value: new Color() },
      uGradTop: { value: new Color() },
      uGradBottom: { value: new Color() },
      uNameK: { value: 0 },
      uNameA: { value: 0 },
      uLod: { value: 0 },
      uGrain: { value: FIELD.grain },
      uDpr: { value: 1 },
      uSeam: { value: FIELD.seamFade },
      // ---- fx-hero: the greeting, the fill and the repel ----
      uNameSpan: { value: new Vector2(0, 1) },
      uGreetSplit: { value: 0 },
      uGreetA: { value: 0 },
      uWarm: { value: new Color() },
      uFlowDir: { value: new Vector2(Math.cos(0.58), -Math.sin(0.58)) },
      uMode: { value: NAME_FILLS.indexOf(nameFill) },
      uFillMix: { value: 1 },
      uNameT: { value: 0 },
      uRepel: { value: repelTexture },
      uRepelOn: { value: 0 },
      uRepelMax: { value: REPEL.maxPush },
      // ---- end fx-hero ----
    },
  });
  const compMesh = new Mesh(quad, compMaterial);
  compMesh.frustumCulled = false;
  compScene.add(compMesh);

  // ---- cards
  const shared: SharedCardUniforms = {
    uField: { value: fieldTarget.texture },
    uView,
    uInk: { value: new Color() },
    uPaper: { value: new Color() },
    uSheen: { value: theme.card.sheen },
    uSeam: { value: FIELD.seamFade },
  };
  const cardGeometry = createCardGeometry();
  type Slot = { mesh: Mesh; uniforms: CardUniforms; tile: number; hover: number };
  const slots: Slot[] = [];
  const faces: { front: Texture; back: Texture }[] = [];
  let sources: CardSource[] = [];
  const seenLevel = new Float32Array(tileCount);

  function makeTexture(source: HTMLCanvasElement) {
    const texture = new CanvasTexture(source);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function ensureSlots(count: number) {
    while (slots.length < count) {
      const { material, uniforms } = createCardMaterial(shared);
      const mesh = new Mesh(cardGeometry, material);
      mesh.frustumCulled = false;
      cardScene.add(mesh);
      slots.push({ mesh, uniforms, tile: -1, hover: 0 });
    }
    slots.forEach((slot, j) => {
      slot.mesh.visible = j < count;
    });
  }

  function bindTile(slot: Slot, tile: number) {
    const face = faces[tile];
    if (slot.tile === tile && slot.uniforms.mapF.value === face.front && slot.uniforms.mapB.value === face.back) return;
    slot.tile = tile;
    slot.uniforms.mapF.value = face.front;
    slot.uniforms.mapB.value = face.back;
  }

  // A fresh canvas pair into fresh textures; the old pair is disposed.
  function paintTile(tile: number) {
    const painted = paintCard(sources[tile], theme, budget.textureSize);
    const previous = faces[tile];
    faces[tile] = { front: makeTexture(painted.front), back: makeTexture(painted.back) };
    slots.forEach((slot) => {
      if (slot.tile === tile) bindTile(slot, tile);
    });
    previous?.front.dispose();
    previous?.back.dispose();
  }
  const repaints = createRepaintQueue<number>(4);

  function applyTheme() {
    const fu = fieldMaterial.uniforms;
    applyColor(fu.uTop.value, theme.field.top);
    applyColor(fu.uBottom.value, theme.field.bottom);
    applyColor(fu.uGlow.value, theme.field.glow);
    applyColor(fu.uSecond.value, theme.field.second);
    fu.uSec.value = theme.field.secondStrength;
    const cu = compMaterial.uniforms;
    applyColor(cu.uPaper.value, theme.paper);
    applyColor(cu.uGradTop.value, theme.name.top);
    applyColor(cu.uGradBottom.value, theme.name.bottom);
    cu.uNameK.value = theme.name.ink * FIELD.nameInkGain;
    applyColor(cu.uWarm.value, theme.field.second); // fx-hero: grain-warm's second tone
    applyColor(shared.uInk.value, theme.ink);
    applyColor(shared.uPaper.value, theme.paper);
    shared.uSheen.value = theme.card.sheen;
    lastFieldTime = Number.NaN;
  }

  // ---- state
  const view = { width: 1, height: 1, dpr: 1, docTop: 0, docLeft: 0 };
  let geo: CoilGeometry | null = null;
  let geoCamera: Camera | null = null;
  let nameFamily = "";
  const conveyor = createConveyor(0);
  const envelope = createEnvelope();
  const unwind = createUnwind();
  const poses: CardPose[] = [];
  const rendered: CardPose[] = [];
  let sil: Silhouette | null = null;
  let hoveredSlot = -1;
  let hiddenSlot: number | null = null;
  const pointer = { clientX: -1, clientY: -1, x: -1, y: -1, inside: false, known: false };
  // ---- fx-input state: who owns the wheel gesture, and the book row hold ----
  let capture = createCapture();
  const rowHold = createRowHold();
  // ---- end fx-input state ----
  let fieldElapsed = 0;
  let lastFieldTime = Number.NaN;
  let lastWeatherTime = Number.NaN; // fx-hero
  let lastScrollY = window.scrollY;
  let lastTime = performance.now();
  let raf = 0;
  let ready = false;
  let disposed = false;
  let visible = true;
  let frozenByApi = false;
  let contextLost = false;
  let firstFrameSent = false;
  // ---- fx-flight state ----
  let resuming = false; // the next frame is the first after a stop
  let landedAhead = false; // a flight landed; the frozen prop has yet to follow
  // ---- end fx-flight state ----
  // ---- slice 7 state: the touch drag and its coast ----
  let dragging = false;
  let coast: { rest: number } | null = null;
  let pressCaughtCoil = false; // this touch stopped a coast: it is a catch, not a tap
  let rebuildAt: number | null = null; // when the last rebuild began
  // ---- end slice 7 state ----
  // ---- slice 4 state: the entrance clock and the name handoff ----
  let nameBox: { left: number; baseline: number; inkWidth: number; size: number; maskTop: number; maskHeight: number } | null =
    null;
  let entranceBase: number | null = null; // when this scene's entrance clock reads 0
  let entranceEnded = false;
  let nameLanded = false;
  // ?coildebug=entrance=<ms> freezes the drawn entrance at that moment (the
  // real clock still ends it, so the page unlocks).
  const forcedEntrance = debugMode
    ?.split(",")
    .map((token) => token.trim().match(/^entrance=(-?\d+(?:\.\d+)?)$/))
    .find(Boolean);
  const forcedEntranceMs = forcedEntrance ? Number(forcedEntrance[1]) : null;

  // Real milliseconds since the entrance started (-Infinity before it,
  // Infinity for a fast start). A start the scene first sees late (it was
  // still loading) begins at that first sight, so no part of it is skipped.
  // Slice 7: a scene that mounts with the hero already interactive (reduced
  // motion switched off again, the remount after a lost context, a chunk
  // that arrived after the lock gave up) starts at rest: the entrance plays
  // once per load, never on a rebuild.
  function entranceElapsedMs(now: number) {
    const entrance = live.current.entrance;
    if (!entrance) return Number.NEGATIVE_INFINITY;
    if (entranceBase === null) {
      const played = Number.isFinite(entrance.startMs);
      const rebuilt = played && live.current.interactive;
      entranceBase = played && !rebuilt ? Math.max(entrance.startMs, now) : Number.NEGATIVE_INFINITY;
      // A rebuild fades its cards and name in over the poster (the rotation's fade).
      if (rebuilt) rebuildAt = now;
    }
    return now - entranceBase;
  }
  // ---- end slice 4 state ----
  const debug: DebugStats | null = debugMode
    ? {
        intervals: [],
        work: [],
        steps: [],
        envelope: [],
        captured: 0,
        released: 0,
        offset: () => conveyor.offset,
        hovered: () => hoveredSlot,
        // ---- fx-input debug ----
        capturing: () => gestureOwner(capture, performance.now()) === "coil",
        owner: () => gestureOwner(capture, performance.now()) ?? "none",
        silhouette: () => sil,
        // ---- end fx-input debug ----
      }
    : null;
  if (debug) (window as unknown as { __coil?: DebugStats }).__coil = debug;
  if (debug) {
    debug.budget = () => {
      const buffer = renderer.getDrawingBufferSize(new Vector2());
      const sizes = new Set(
        faces.map((face) => {
          const image = face.front.image as HTMLCanvasElement;
          return `${image.width}x${image.height}`;
        }),
      );
      return {
        input: live.current.input,
        dprCap: budget.dprCap,
        devicePixelRatio: window.devicePixelRatio,
        dpr: view.dpr,
        css: [view.width, view.height],
        buffer: [buffer.x, buffer.y],
        field: [fieldTarget.width, fieldTarget.height],
        textures: [...sizes],
        narrow: geo?.narrow ?? null,
        slots: geo?.slotCount ?? null,
        cards: tileCount,
      };
    };
    // Slice 7: every visible card's bent corners in viewport px (for the
    // header and greeting overlap checks).
    (debug as DebugStats & { visibleQuads?: () => Quad[] }).visibleQuads = () => {
      if (!geoCamera) return [];
      const rect = host.getBoundingClientRect();
      return rendered
        .filter((pose) => pose && pose.alpha > 0.01)
        .map((pose) => projectQuad(pose, geoCamera as Camera, { left: rect.left, top: rect.top }));
    };
  }
  const push = (list: number[], value: number) => {
    list.push(value);
    if (list.length > 6000) list.shift();
  };

  // ---- layout
  function layoutName() {
    if (!geo) return;
    const { width: W, height: H } = view;
    const narrow = isNarrow(view);
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return;
    probe.font = `900 100px ${nameFamily}`;
    const w100 = probe.measureText(siteContent.hero.name).width || 1;
    const size = ((W * (narrow ? 0.9 : 0.7)) / w100) * 100;
    // ---- fx-hero: "Hi, I'm" drawn with the name, one mask ----
    const mask = paintNameLockup(
      siteContent.hero.greeting,
      siteContent.hero.name,
      nameFamily,
      size,
      Math.min(2, window.devicePixelRatio || 1),
    );
    nameTexture?.dispose();
    const texture = new CanvasTexture(mask.canvas);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    nameTexture = texture;
    const inkWidth = mask.nameInkWidth;
    const capTop = H / 2 - mask.ascent / 2;
    const left = (W - inkWidth) / 2;
    const span = mask.ascent + mask.descent + 2 * mask.pad;
    const cu = compMaterial.uniforms;
    cu.uName.value = texture;
    cu.uNameRect.value.set(left - mask.pad, capTop - mask.pad - mask.greetBlock, mask.width, mask.height);
    cu.uNameSpan.value.set(mask.greetBlock / mask.height, span / mask.height);
    cu.uGreetSplit.value = mask.split / mask.height;
    greetBlock = mask.greetBlock;
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (mask.height * view.dpr)));
    cu.uNameA.value = posterMode ? 0 : 1;
    // Slice 4: the name's geometry for the loader's handoff (canvas px): the
    // name alone, never the greeting.
    nameBox = {
      left,
      baseline: capTop + mask.ascent,
      inkWidth,
      size,
      maskTop: capTop - mask.pad,
      maskHeight: span,
    };
    // The overlay keeps only the unwound list's "Coil" control, sized off the
    // greeting's old size.
    const greetingPx = narrow ? 16 : Math.min(21, Math.max(16, W * 0.0125));
    live.current.overlay.current?.layout(posterMode ? null : { controlPx: Math.round(greetingPx * 0.86) });
    // ---- end fx-hero ----
  }

  function layout(width: number, height: number) {
    view.width = Math.max(1, width);
    view.height = Math.max(1, height);
    view.dpr = Math.min(window.devicePixelRatio || 1, budget.dprCap);
    const rect = host.getBoundingClientRect();
    view.docTop = rect.top + window.scrollY;
    view.docLeft = rect.left + window.scrollX;
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(view.width, view.height, false);
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    uView.value.set(0, 0, 1 / buffer.x, 1 / buffer.y);
    camera.aspect = view.width / view.height;
    geoCamera = cameraFor(view);
    camera.position.set(0, 0, geoCamera.distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    fieldTarget.setSize(
      Math.max(8, Math.round(view.width / FIELD.divisor)),
      Math.max(8, Math.round(view.height / FIELD.divisor)),
    );
    fieldMaterial.uniforms.uAspect.value = view.width / view.height;
    compMaterial.uniforms.uFull.value.set(view.width, view.height);
    compMaterial.uniforms.uDpr.value = buffer.y / view.height;
    seenRingDpr.value = buffer.y / view.height; // fx-hero: the seen ring stays one CSS px wide
    lastFieldTime = Number.NaN;
    const before = geo;
    geo = solveGeometry(view, tileCount);
    // Slice 7: a new composition or a rotation lays every card out afresh;
    // fade the new frame in rather than jump (only while the loop runs: a
    // still frame behind a modal just re-lays out).
    if (
      before &&
      shouldRun() &&
      (before.narrow !== geo.narrow ||
        Math.abs(view.width - before.viewport.width) > REBUILD_WIDTH_CHANGE * before.viewport.width)
    ) {
      rebuildAt = performance.now();
    }
    ensureSlots(geo.slotCount);
    poses.length = geo.slotCount;
    rendered.length = geo.slotCount;
    if (debug) debug.geo = geo;
    layoutName();
  }

  // ---- fx-hero: the fill's idle clock and the cursor repel, once per frame ----
  // A fine pointer's movement since the last frame (in client px, so page
  // scroll alone never counts) is one stroke across the name's rect, whether
  // or not a card sits between it and the name. The buffer relaxes every
  // frame and uploads only while it moves. Nothing while unwound or solid.
  function stepNameFill(dt: number, listProgress: number) {
    const started = debug ? performance.now() : 0;
    const cu = compMaterial.uniforms;
    nameClock = heldAt ?? nameClock + dt;
    cu.uNameT.value = nameClock;
    const props = live.current;
    const repelLive = props.input === "fine" && listProgress === 0 && nameFill !== "solid" && !posterMode;
    if (repelLive && pointer.known && Number.isFinite(repelLast.clientX) && dt > 0) {
      const dx = pointer.clientX - repelLast.clientX;
      const dy = pointer.clientY - repelLast.clientY;
      if (dx !== 0 || dy !== 0) {
        const rect = cu.uNameRect.value as Vector4;
        repelRect.x = rect.x;
        repelRect.y = rect.y;
        repelRect.w = rect.z;
        repelRect.h = rect.w;
        strokeFrom.x = pointer.x - dx;
        strokeFrom.y = pointer.y - dy;
        strokeTo.x = pointer.x;
        strokeTo.y = pointer.y;
        injectStroke(repel, repelRect, strokeFrom, strokeTo, dt);
      }
    }
    repelLast.clientX = pointer.known ? pointer.clientX : Number.NaN;
    repelLast.clientY = pointer.known ? pointer.clientY : Number.NaN;
    if (!repelLive && repel.active) {
      repel.d.fill(0);
      repel.v.fill(0);
      repel.active = false;
    } else {
      stepRepel(repel, dt);
    }
    if (repel.active || !repelUploaded) {
      encodeRepel(repel, repelBytes);
      repelTexture.needsUpdate = true;
      repelUploaded = !repel.active;
    }
    cu.uRepelOn.value = repel.active ? 1 : 0;
    if (debug) {
      if (!debug.namePass) debug.namePass = [];
      push(debug.namePass, performance.now() - started);
    }
  }

  // The switcher (?coildebug=name) and ?name / ?drift picks, live.
  const onFx = (event: Event) => {
    const detail = (event as CustomEvent<CoilFxDetail>).detail ?? {};
    if (detail.name !== undefined) {
      nameFill = parseNameFill(detail.name);
      compMaterial.uniforms.uMode.value = NAME_FILLS.indexOf(nameFill);
    }
    if (detail.drift !== undefined) {
      driftPreset = parseDriftPreset(detail.drift);
      fieldMaterial.uniforms.uWarp.value = DRIFT_PRESETS[driftPreset].warp;
      lastFieldTime = Number.NaN;
    }
    if (raf) return;
    renderStill();
  };
  if (debug) {
    debug.nameFx = () => ({ nameFill, driftPreset, repelActive: repel.active, repelMax: maxOffset(repel), nameClock });
  }
  // ---- end fx-hero ----

  // ---- pose application
  const basis = new Matrix4();
  const bx = new Vector3();
  const by = new Vector3();
  const bz = new Vector3();

  function applyPose(slot: Slot, pose: CardPose, bright: number) {
    const { mesh, uniforms } = slot;
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    basis.makeBasis(bx.set(...pose.basis.x), by.set(...pose.basis.y), bz.set(...pose.basis.z));
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.scale.setScalar(pose.scale);
    uniforms.uBend.value = pose.bend;
    (uniforms.uAxis.value as Vector2).set(Math.sin(pose.beta), Math.cos(pose.beta));
    uniforms.uFade.value = pose.fade;
    uniforms.uBright.value = bright;
    uniforms.uAlpha.value = pose.alpha;
    const material = mesh.material as ShaderMaterial;
    const translucent = pose.alpha < 0.995;
    if (material.transparent !== translucent) {
      material.transparent = translucent;
      material.depthWrite = !translucent;
      material.needsUpdate = true;
    }
    mesh.visible = pose.alpha > 0.01;
  }

  // ---- picking and the pointer
  function pickAt(x: number, y: number) {
    if (!geoCamera || poses.length === 0) return -1;
    return pickCard(poses, rayThrough(geoCamera, x, y));
  }

  function updatePointerLocal() {
    pointer.x = pointer.clientX - (view.docLeft - window.scrollX);
    pointer.y = pointer.clientY - (view.docTop - window.scrollY);
  }

  // Only the canvas itself counts: the overlay's control, the mark, the Menu
  // pill and its scrim all sit over the hero and must never pick a card.
  function pointerOverHero(target: EventTarget | null) {
    if (!(target instanceof Node) || !host.contains(target)) return false;
    return pointer.x >= 0 && pointer.x <= view.width && pointer.y >= 0 && pointer.y <= view.height;
  }

  // ---- fx-input: wheel ownership (lib/coil/capture.ts) ----
  // The hero may take a wheel gesture: ready, entrance over, not frozen, not
  // unwound, a fine pointer, and not a pinch (ctrl + wheel).
  function wheelInteractive(event: WheelEvent) {
    const props = live.current;
    return (
      ready &&
      !props.frozen &&
      !frozenByApi &&
      props.interactive &&
      props.input === "fine" &&
      !event.ctrlKey &&
      !unwind.on
    );
  }

  // The pointer over the canvas and inside the helix's projected hull (gaps
  // between cards included), from the last rendered frame.
  function pointerInsideHelix() {
    return pointer.inside && sil !== null && insideSilhouette(sil, pointer.x, pointer.y);
  }

  function heroVisible() {
    const rect = host.getBoundingClientRect();
    return heroVisibleFraction(rect.top, rect.height, window.innerHeight);
  }

  function setCapture(next: typeof capture, nowMs: number) {
    if (debug && gestureOwner(capture, nowMs) === "coil" && next.owner === "page") debug.released += 1;
    capture = next;
  }

  // Only a real move counts: a card or a gap passing under a still pointer is
  // not a move, so it never releases a coil gesture.
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const moved = !pointer.known || event.clientX !== pointer.clientX || event.clientY !== pointer.clientY;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.known = true;
    updatePointerLocal();
    pointer.inside = pointerOverHero(event.target);
    const now = performance.now();
    if (moved) setCapture(pointerMoved(capture, { nowMs: now, insideSilhouette: pointerInsideHelix() }), now);
    wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    pointer.inside = false;
    pointer.known = false;
    const now = performance.now();
    setCapture(pointerMoved(capture, { nowMs: now, insideSilhouette: false }), now);
  };

  // Decided once per gesture (events under COIL.capture.gestureGapMs apart,
  // trackpad inertia included): a gesture that starts inside the helix with
  // the hero at least half in view spins the coil from its first event, in
  // both directions, and the page does not move; any other gesture scrolls
  // the page natively. The coil responds on the frame after the event (one
  // smoothing stage and the spin cap, nothing before the first motion).
  const onWheel = (event: WheelEvent) => {
    const now = performance.now();
    const fresh = gestureOwner(capture, now) === null;
    if (fresh) {
      // Some synthesized wheels carry no position (0, 0); the last pointer
      // position stands in, as in the lab.
      if (event.clientX !== 0 || event.clientY !== 0 || !pointer.known) {
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
      }
      updatePointerLocal();
      pointer.inside = pointerOverHero(event.target);
    }
    setCapture(
      decideWheel(capture, {
        nowMs: now,
        interactive: wheelInteractive(event),
        heroVisible: fresh ? heroVisible() : 1,
        insideSilhouette: fresh ? pointerInsideHelix() : true,
      }),
      now,
    );
    if (capture.owner !== "coil") return;
    event.preventDefault();
    if (fresh && debug) debug.captured += 1;
    addWheel(conveyor, wheelPixels(event.deltaX, event.deltaY, event.deltaMode, view.height));
    wake();
  };

  // Wheels elsewhere on the page (the host never sees them) still belong to
  // the running gesture: a gesture that left the hero stays the page's, and
  // one that began outside it never becomes the coil's on arrival.
  const onWindowWheel = (event: WheelEvent) => {
    if (event.target instanceof Node && host.contains(event.target)) return;
    const now = performance.now();
    setCapture(decideWheel(capture, { nowMs: now, interactive: false, heroVisible: 0, insideSilhouette: false }), now);
  };
  // ---- end fx-input ----

  let downAt: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    downAt = { x: event.clientX, y: event.clientY };
  };
  // The browser took the touch as a pan (a vertical swipe): no tap.
  const onPointerCancel = () => {
    downAt = null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = downAt;
    downAt = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    // ---- slice 7: a tap opens the card under the finger, with no flight ----
    if (event.pointerType === "touch") {
      const props = live.current;
      if (!ready || dragging || pressCaughtCoil || !props.interactive || props.frozen || frozenByApi || unwind.on) return;
      const card = api.cardAt(event.clientX, event.clientY);
      if (card) props.onCardClick?.({ ...card, tap: true });
      return;
    }
    // ---- end slice 7 ----
    if (!ready || hoveredSlot < 0 || live.current.input !== "fine") return;
    const slot = slots[hoveredSlot];
    const tile = tiles[slot.tile];
    // Slice 5 wiring block (the flight): the handler freezes, projects the
    // card's quad through the api and opens the modal. Until then it is unset.
    live.current.onCardClick?.({ key: tile.key, slot: hoveredSlot });
  };

  // ---- the frame
  // Slice 7, QA only: ?coildebug=throw=frame throws from the loop a second in.
  const throwFrameAt = debugTokens().has("throw=frame") ? performance.now() + 1000 : Number.POSITIVE_INFINITY;
  function update(dt: number, now: number) {
    if (!geo || !geoCamera) return;
    if (now > throwFrameAt) throw new Error("coildebug: scene frame");
    const props = live.current;
    const scrollY = window.scrollY;
    const scrollDelta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    updatePointerLocal();

    const previous = conveyor.offset;
    if (!posterMode) {
      // Slice 7: a released drag's throw decays into the target, which the
      // one smoothing stage and the speed cap then carry, as for the wheel.
      if (coast) conveyor.target += (coast.rest - conveyor.target) * (1 - Math.exp(-dt / COAST_TAU_S));
      // ---- fx-input: the conveyor's feeds ----
      // A held book row stills the idle drift and the page-scroll feed (and
      // eases them back after it lets go); page scroll turns the coil only
      // during page gestures, keyboard and scrollbar scrolling.
      const holdWeight = rowHoldWeight(rowHold, now);
      const pageFeed = props.interactive && feedsPageScroll(capture, now) ? scrollDelta * holdWeight : 0;
      stepConveyor(conveyor, {
        dt,
        nowMs: now,
        // The idle drift waits while a finger holds or throws the coil, so
        // the coast lands exactly on its card.
        idleWeight: dragging || coast ? 0 : holdWeight,
        pageScrollPx: pageFeed,
      });
      // ---- end fx-input ----
      stepEnvelope(envelope, conveyor.excessVelocity, dt);
      if (coast && Math.abs(coast.rest - conveyor.offset) < COAST_SETTLED_CARDS) coast = null;
    }
    if (debug) {
      push(debug.steps, conveyor.offset - previous);
      push(debug.envelope, envelope.value);
    }

    let helix = restHelix(geo, theme.card.recede);
    helix = { ...helix, dy: stretchedDy(helix.dy, envelope) };
    // ---- slice 4 wiring block: the entrance ----
    const realElapsedMs = posterMode ? Number.POSITIVE_INFINITY : entranceElapsedMs(now);
    const clock = entranceClock(forcedEntranceMs ?? realElapsedMs);
    if (!isRested(clock)) {
      // Idle, wheel and page scroll wait for the entrance: the strand holds
      // still at its start until the band has opened.
      conveyor.offset = 0;
      conveyor.target = 0;
      conveyor.velocity = 0;
      conveyor.excessVelocity = 0;
      conveyor.glide = null;
      coast = null; // slice 7
    }
    helix = entranceHelix(helix, geo, clock);
    {
      const entrance = props.entrance;
      // A loader that never lands the name still gives it up a second after the entrance.
      const handedOff = entrance?.nameFromLoader
        ? nameLanded || realElapsedMs > clock.durationS * 1000 + 1000
        : null;
      const nameAlpha = posterMode ? 0 : entranceNameAlpha(clock, handedOff);
      compMaterial.uniforms.uNameA.value = nameAlpha;
      compMaterial.uniforms.uGrain.value = FIELD.grain * nameAlpha;
      // ---- fx-hero: the greeting's own fade; the fill grows in after the loader's solid name lands ----
      compMaterial.uniforms.uGreetA.value = posterMode ? 0 : greetingAlpha(entrance ?? null, now, nameAlpha);
      if (entrance?.nameFromLoader && fillInFrom === null && handedOff) fillInFrom = now;
      compMaterial.uniforms.uFillMix.value = !entrance?.nameFromLoader
        ? 1
        : fillInFrom === null
          ? 0
          : siteEase(clamp01((now - fillInFrom) / NAME_FILL.fillInMs));
      // ---- end fx-hero ----
      if (entrance && !entranceEnded && realElapsedMs >= clock.durationS * 1000) {
        entranceEnded = true;
        props.onEntranceEnd?.();
      }
    }
    // ---- end slice 4 block ----
    // Slice 7: the rebuild fade (1 when none is running).
    let rebuilt = 1;
    if (rebuildAt !== null) {
      rebuilt = siteEase(clamp01((now - rebuildAt) / REBUILD_FADE_MS));
      if (rebuilt >= 1) rebuildAt = null;
      compMaterial.uniforms.uNameA.value *= rebuilt;
      compMaterial.uniforms.uGreetA.value *= rebuilt; // fx-hero
    }
    // ---- slice 5 wiring block: the unwind ----
    // While latched the conveyor holds still, so every latched copy keeps its
    // slot and the wind-back lands on the exact pose it left.
    if (settleUnwind(unwind, now)) unwind.column = null;
    if (unwind.latched) {
      conveyor.offset = unwind.offset;
      conveyor.target = unwind.offset;
      conveyor.glide = null;
      unwind.column = measureColumn(helix);
    }
    const listProgress = unwindProgress(unwind, now);
    unwindFrame(listProgress);
    // ---- end slice 5 block ----
    stepNameFill(dt, listProgress);

    const seen = getSeen();
    const hoverStep = 1 - Math.exp(-dt * HOVER_RATE);
    const seenStep = 1 - Math.exp(-dt * SEEN_RATE);
    for (let i = 0; i < tileCount; i++) {
      seenLevel[i] += ((seen.has(tiles[i].key) ? 1 : 0) - seenLevel[i]) * seenStep;
    }

    for (let j = 0; j < geo.slotCount; j++) {
      const slot = slots[j];
      let pose: CardPose = coilPose(helix, j, conveyor.offset);
      const strandPosition = Math.round(pose.u - conveyor.offset);
      const tile = mod(strandPosition, tileCount);
      bindTile(slot, tile);
      pose = entrancePose(pose, { strandPosition, cardCount: tileCount }, geo, clock);
      if (listProgress > 0) pose = unwindPose(pose, tile, unwind, now, null);
      // ---- slice 7: the narrow pane's clear top band (header and greeting) ----
      if (geo.clearTopPx > 0 && listProgress < 1) {
        const clear = headerClearance(pose, geo, geoCamera);
        if (clear < 1) pose = { ...pose, alpha: pose.alpha * (clear + (1 - clear) * listProgress) };
      }
      if (rebuilt < 1) pose = { ...pose, alpha: pose.alpha * rebuilt };
      // ---- end slice 7 ----
      if (posterMode || j === hiddenSlot) pose = { ...pose, alpha: 0 };
      poses[j] = pose;

      slot.hover += ((j === hoveredSlot ? 1 : 0) - slot.hover) * hoverStep;
      const lift = slot.hover > 0.001 ? slot.hover : 0;
      const shown: CardPose = lift
        ? { ...pose, scale: pose.scale * (1 + HOVER_SCALE * lift), fade: pose.fade * (1 - HOVER_UNFADE * lift) }
        : pose;
      rendered[j] = shown;
      applyPose(slot, shown, HOVER_BRIGHT * lift);
      // Unwound, the row's outline ring after the title is the one seen mark;
      // the card's own ring fades with the unwind, since at thumb size it
      // reads as a second, solid dot.
      slot.uniforms.uSeen.value = seenLevel[tile] * (1 - listProgress);
    }
    sil = silhouette(helix, geoCamera, poses);
    // ---- fx-hero: sand drifts along the helix's axis; QA can hide the cards ----
    if (sil) compMaterial.uniforms.uFlowDir.value.set(sil.dx, sil.dy);
    if (hideCards) for (let j = 0; j < geo.slotCount; j++) slots[j].mesh.visible = false;
    // ---- end fx-hero ----

    // Hover: picked every frame, since cards move under a still pointer.
    const pickable = pointer.inside && pointer.known && props.interactive && props.input === "fine";
    const nextHover = pickable ? pickAt(pointer.x, pointer.y) : -1;
    hoveredSlot = nextHover;
    setSceneHover(nextHover >= 0);

    // ---- fx-input: the nudge ----
    // Only while a coil gesture has been held 2.6s; gone the instant the
    // gesture ends or passes to the page. A caret by the cursor points off
    // the helix.
    const overlay = props.overlay.current;
    if (sil && pointer.known && nudgeShown(capture, now)) {
      const px = pointer.x - sil.ax;
      const py = pointer.y - sil.ay;
      const along = px * sil.dx + py * sil.dy;
      let nx = px - along * sil.dx;
      let ny = py - along * sil.dy;
      const length = Math.hypot(nx, ny);
      if (length < 1) {
        nx = -sil.dy;
        ny = sil.dx;
      } else {
        nx /= length;
        ny /= length;
      }
      overlay?.nudge({ x: pointer.x, y: pointer.y, angle: Math.atan2(ny, nx) });
    } else {
      overlay?.nudge(null);
    }
    // ---- end fx-input ----

    repaints.drain(paintTile, REPAINT_BUDGET_MS);
  }

  function render(dt: number) {
    if (!posterMode) fieldElapsed += dt;
    // The poster is the live field's first frame, so the scene picks up where it left off.
    // ---- fx-hero: two clocks, the orange and the weather (drift presets) ----
    const clocks = fieldClocks(posterMode ? 0 : (heldAt ?? fieldElapsed), false, driftPreset);
    fieldMaterial.uniforms.uT.value = clocks.orange;
    fieldMaterial.uniforms.uTw.value = clocks.weather;
    renderer.setRenderTarget(null);
    renderer.clear();
    if (clocks.orange !== lastFieldTime || clocks.weather !== lastWeatherTime) {
      renderer.setRenderTarget(fieldTarget);
      renderer.render(fieldScene, orthoCamera);
      renderer.setRenderTarget(null);
      lastFieldTime = clocks.orange;
      lastWeatherTime = clocks.weather;
    }
    // ---- end fx-hero ----
    renderer.render(compScene, orthoCamera);
    renderer.clearDepth();
    renderer.render(cardScene, camera);
  }

  function shouldRun() {
    return (
      ready &&
      !disposed &&
      !contextLost &&
      visible &&
      !document.hidden &&
      // fx-flight freeze: a landed flight resumes the scene itself, ahead of
      // the props that still name it.
      (!live.current.frozen || landedAhead) &&
      !frozenByApi
    );
  }

  function frame(now: number) {
    raf = 0;
    if (!shouldRun()) {
      setSceneHover(false);
      return;
    }
    raf = requestAnimationFrame(frame);
    const interval = now - lastTime;
    // ---- fx-flight freeze: the first frame after a freeze steps one frame at most ----
    const step = Math.min(Math.max(interval, 0) / 1000, COIL.lab.maxFrameSeconds);
    const dt = resuming ? resumeStep(step) : step;
    resuming = false;
    flightFrame();
    // ---- end fx-flight freeze ----
    lastTime = now;
    const started = performance.now();
    try {
      update(dt, now);
      render(dt);
    } catch (error) {
      stop();
      live.current.onError(error);
      return;
    }
    if (debug) {
      push(debug.intervals, interval);
      push(debug.work, performance.now() - started);
    }
    // ---- fx-flight debug ----
    flightLog?.mark("scene-frame", { dt, interval, ...probeState() });
    // ---- end fx-flight debug ----
    if (!firstFrameSent) {
      firstFrameSent = true;
      live.current.onFirstFrame();
    }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function wake() {
    if (raf || !shouldRun()) return;
    // ---- fx-flight freeze: a stopped scene holds its clocks ----
    holdClocks(performance.now() - lastTime);
    // ---- end fx-flight freeze ----
    lastTime = performance.now();
    // A return from off screen or a hidden tab must not read as one huge scroll.
    lastScrollY = window.scrollY;
    raf = requestAnimationFrame(frame);
  }

  // One frame outside the loop (a resize while frozen or off screen), so
  // the canvas never shows a stretched stale buffer.
  function renderStill() {
    if (!ready || contextLost || disposed) return;
    // fx-flight freeze: a still frame of a stopped scene is drawn at the moment it stopped.
    update(0, raf ? performance.now() : lastTime);
    render(0);
    // ---- fx-flight: a card in flight follows the new layout in the same frame ----
    flightStill();
    flightLog?.mark("scene-still", probeState());
    // ---- end fx-flight ----
  }

  // ---- observers and listeners
  const resizeObserver = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (!box) return;
    pendingSize = { width: box.width, height: box.height };
    if (!ready) return;
    layout(box.width, box.height);
    if (!raf) renderStill();
  });
  let pendingSize: { width: number; height: number } | null = null;
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1]?.isIntersecting ?? true;
      wake();
    },
    { threshold: 0 },
  );
  intersectionObserver.observe(host);

  const onVisibility = () => wake();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerout", onPointerOut);
  host.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("wheel", onWindowWheel, { passive: true }); // fx-input
  window.addEventListener(COIL_FX_EVENT, onFx); // fx-hero
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointerup", onPointerUp);
  host.addEventListener("pointercancel", onPointerCancel);

  const onContextLost = () => {
    contextLost = true;
    stop();
    live.current.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  const stopWatchingTheme = watchTheme((next) => {
    theme = next;
    applyTheme();
    repaints.enqueue(tiles.map((_, i) => i));
    wake();
  });

  // ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
  const flightLog = flightProbe();
  let probeSlot = -1; // the slot the harness follows
  function probePoseInfo(pose: CardPose) {
    if (!geoCamera) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    const camera = geoCamera;
    const hw = COIL.cardAspect / 2;
    const at = (x: number, y: number) => {
      const b = bendLocalPoint(x, y, pose.bend, pose.beta);
      const world: [number, number, number] = [
        pose.position[0] + (pose.basis.x[0] * b[0] + pose.basis.y[0] * b[1] + pose.basis.z[0] * b[2]) * pose.scale,
        pose.position[1] + (pose.basis.x[1] * b[0] + pose.basis.y[1] * b[1] + pose.basis.z[1] * b[2]) * pose.scale,
        pose.position[2] + (pose.basis.x[2] * b[0] + pose.basis.y[2] * b[1] + pose.basis.z[2] * b[2]) * pose.scale,
      ];
      return projectPoint(camera, world, origin);
    };
    // The bent silhouette: 17 points along each edge, in corner order.
    const steps = 16;
    const edge = (x0: number, y0: number, x1: number, y1: number) =>
      Array.from({ length: steps + 1 }, (_, i) => at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps));
    const outline = [edge(-hw, 0.5, hw, 0.5), edge(hw, 0.5, hw, -0.5), edge(hw, -0.5, -hw, -0.5), edge(-hw, -0.5, -hw, 0.5)];
    // The face itself: a 9 by 9 grid of card points (s across, t down, 0..1).
    const grid = Array.from({ length: 81 }, (_, i) => {
      const s = (i % 9) / 8;
      const t = Math.floor(i / 9) / 8;
      return { s, t, ...at((s - 0.5) * COIL.cardAspect, 0.5 - t) };
    });
    return {
      quad: projectQuad(pose, camera, origin),
      flatQuad: projectQuad({ ...pose, bend: 0 }, camera, origin),
      center: at(0, 0),
      outline,
      grid,
    };
  }
  function probeSlotInfo(j: number) {
    const slot = slots[j];
    const pose = rendered[j];
    const drawn = pose ? probePoseInfo(pose) : null;
    if (!slot || !pose || !drawn) return null;
    const tile = tiles[slot.tile];
    return {
      ...drawn,
      slot: j,
      key: tile?.key,
      kind: tile?.kind,
      hover: slot.hover,
      hovered: hoveredSlot === j,
      hidden: hiddenSlot === j,
      u: pose.u,
      depth: pose.depth,
      fade: pose.fade,
      alpha: pose.alpha,
      scale: pose.scale,
      bend: pose.bend,
      beta: pose.beta,
      uniforms: {
        uBend: slot.uniforms.uBend.value,
        uFade: slot.uniforms.uFade.value,
        uBright: slot.uniforms.uBright.value,
        uShade: slot.uniforms.uShade.value,
        uSeen: slot.uniforms.uSeen.value,
        uAlpha: slot.uniforms.uAlpha.value,
      },
    };
  }
  function probeState() {
    const followed = probeSlot >= 0 ? slots[probeSlot] : null;
    const pose = probeSlot >= 0 ? rendered[probeSlot] : null;
    return {
      offset: conveyor.offset,
      target: conveyor.target,
      glide: conveyor.glide !== null,
      envelope: envelope.value,
      hoveredSlot,
      hiddenSlot,
      frozenByApi,
      frozenByProps: live.current.frozen,
      looping: raf !== 0,
      slot: probeSlot,
      hover: followed?.hover ?? null,
      scale: pose?.scale ?? null,
      fade: pose?.fade ?? null,
      bright: followed?.uniforms.uBright.value ?? null,
      seen: followed?.uniforms.uSeen.value ?? null,
    };
  }
  if (flightLog) {
    flightLog.scene = {
      state: probeState,
      follow: ((j: number) => {
        probeSlot = j;
      }) as never,
      slot: probeSlotInfo as never,
      slots: () =>
        Array.from({ length: geo?.slotCount ?? 0 }, (_, j) => probeSlotInfo(j)).filter(
          (info) => info !== null && info.alpha > 0.5,
        ),
      // Shows or hides a slot's mesh and redraws, with no other side effect.
      hide: ((j: number | null) => {
        hiddenSlot = j;
        if (!raf) {
          update(0, performance.now());
          render(0);
        }
      }) as never,
      seam: () => FIELD.seamFade,
    };
  }
  // ---- end fx-flight debug ----

  // ---- the api for slices 4 and 5
  const api: CoilSceneApi = {
    ...slice5Api(),
    ...flownApi(), // fx-flight
    freeze(on) {
      flightLog?.mark(on ? "freeze" : "unfreeze", probeState()); // fx-flight debug
      frozenByApi = on;
      if (on) stop();
      else wake();
    },
    cardAt(clientX, clientY) {
      const x = clientX - (view.docLeft - window.scrollX);
      const y = clientY - (view.docTop - window.scrollY);
      const slot = pickAt(x, y);
      if (slot < 0) return null;
      return { key: tiles[slots[slot].tile].key, slot };
    },
    quadOf(slot) {
      const pose = rendered[slot];
      if (!pose || !geoCamera) return null;
      const rect = host.getBoundingClientRect();
      return projectQuad(pose, geoCamera, { left: rect.left, top: rect.top });
    },
    hideSlot(slot) {
      flightLog?.mark(slot === null ? "mesh-show" : "mesh-hide", { slot }); // fx-flight debug
      hiddenSlot = slot;
      if (!raf) renderStill();
    },
    // ---- slice 4: the loader's continuity exit ----
    nameRect() {
      if (!ready || !nameBox) return null;
      const rect = host.getBoundingClientRect();
      return {
        left: rect.left + nameBox.left,
        baseline: rect.top + nameBox.baseline,
        width: nameBox.inkWidth,
        fontPx: nameBox.size,
        gradient: {
          top: rect.top + nameBox.maskTop,
          height: nameBox.maskHeight,
          from: toBytes(theme.name.top),
          to: toBytes(theme.name.bottom),
        },
        inkAlpha: Math.min(1, Math.max(0, theme.name.ink * FIELD.nameInkGain)),
      };
    },
    landName() {
      nameLanded = true;
      if (!ready || contextLost || disposed || posterMode) return;
      compMaterial.uniforms.uNameA.value = 1;
      compMaterial.uniforms.uGrain.value = FIELD.grain;
      render(0);
    },
    // ---- end slice 4 ----
  };
  if (live.current.api) live.current.api.current = api;
  if (debug) debug.api = api;
  // Slice 4: the entrance clock and the name, for QA behind ?coildebug.
  if (debug) {
    (debug as DebugStats & { entrance?: () => object }).entrance = () => ({
      base: entranceBase,
      elapsedMs: entranceBase === null ? null : performance.now() - entranceBase,
      ended: entranceEnded,
      nameLanded,
      nameA: compMaterial.uniforms.uNameA.value,
      offset: conveyor.offset,
    });
  }

  // ---- slice 5: the book, the unwind egg and the flight ----
  // Hover-jump from a book row, the double-click unwind into a column beside
  // the overlay's rows (the name moves to the list's lead), and the flight
  // source for a card click. The frame work runs in update()'s slice 5 block.
  let focusKey: string | null = null;
  const tileIndex = new Map<string, number>(tiles.map((tile, i) => [tile.key, i]));
  const nameRest = new Vector4();
  const nameWritten = new Vector4(Number.NaN, 0, 0, 0);
  let nameRestLod = 0;
  let nameRestInk = 0;
  let nameLodWritten = Number.NaN;
  let nameInkWritten = Number.NaN;
  const probe = document.createElement("canvas").getContext("2d");
  const unwindEase = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function slice5Api(): CoilFlightApi {
    return {
      flightQuadOf(slot) {
        const pose = rendered[slot];
        if (!pose || !geoCamera) return null;
        const rect = host.getBoundingClientRect();
        const origin = { left: rect.left, top: rect.top };
        const bent = projectQuad(pose, geoCamera, origin);
        return isConvex(bent) ? bent : projectQuad({ ...pose, bend: 0 }, geoCamera, origin);
      },
      facesOf(slot) {
        const tile = slots[slot]?.tile ?? -1;
        const face = faces[tile];
        if (!face) return null;
        return { front: face.front.image as HTMLCanvasElement, back: face.back.image as HTMLCanvasElement };
      },
      slotOfKey(key) {
        const tile = tileIndex.get(key);
        if (tile === undefined || !geo) return -1;
        let best = -1;
        let bestDepth = -Infinity;
        for (let j = 0; j < geo.slotCount; j++) {
          const pose = poses[j];
          if (!pose || slots[j].tile !== tile) continue;
          if (unwind.latched) {
            if (Math.round(pose.u - unwind.offset) === unwind.latched[tile]) return j;
            continue;
          }
          if (pose.alpha > 0.5 && pose.depth > bestDepth) {
            best = j;
            bestDepth = pose.depth;
          }
        }
        return best;
      },
      focusCard(key) {
        focusKey = key;
        // ---- fx-input: the row hold ----
        // A held row stills the coil on its card (idle and page scroll at
        // zero) after one glide; letting go resumes the idle after a beat. A
        // hero under a quarter in view has nothing to show: the row does
        // nothing to the coil.
        const now = performance.now();
        const hold = key !== null && canRowHold();
        setRowHold(rowHold, hold, now);
        if (hold && key) hoverJump(key);
        wake();
        // ---- end fx-input ----
      },
      unwind(on) {
        const next = on ?? !unwind.on;
        if (next === unwind.on) return;
        if (next && !canUnwind()) return;
        toggleUnwind(unwind, performance.now(), conveyor.offset, tileCount, next);
        if (debug) (debug as DebugStats & { unwindAt?: number[] }).unwindAt?.push(performance.now());
        wake();
      },
    };
  }

  // ---- fx-input: the row hold ----
  function canRowHold() {
    const props = live.current;
    return (
      ready &&
      props.interactive &&
      !props.frozen &&
      !frozenByApi &&
      !unwind.latched &&
      heroVisible() >= COIL.rowHold.minHeroVisible
    );
  }
  // ---- end fx-input ----

  function canUnwind() {
    const props = live.current;
    return ready && props.interactive && props.input === "fine" && !props.frozen && !frozenByApi && window.scrollY <= 2;
  }

  // The row's card to the part of the helix still on screen: the copy whose
  // projected center lands inside the hero's visible rows (clear of the
  // narrow header band and the bottom seam fade), or the nearest that will
  // be once the hero scrolls back. Nothing while unwound.
  function hoverJump(key: string) {
    const props = live.current;
    const tile = tileIndex.get(key);
    if (tile === undefined || !geo || !geoCamera || !ready) return;
    if (unwind.latched || props.frozen || frozenByApi || !props.interactive) return;
    const rect = host.getBoundingClientRect();
    const inset = JUMP_INSET_CARDS * geo.cardPx;
    const band: JumpBand = {
      top: Math.max(0, -rect.top, geo.clearTopPx) + inset,
      bottom: Math.min(view.height, window.innerHeight - rect.top, view.height * (1 - FIELD.seamFade)) - inset,
      left: inset,
      right: view.width - inset,
    };
    const frame = restHelix(geo, theme.card.recede);
    const camera = geoCamera;
    const maxU = geo.slotCount / 2 - COIL.lab.endFadeSlots;
    const { to } = hoverJumpTarget(tile, conveyor.offset, tileCount, geo.cardsPerTurn, maxU, (u) =>
      projectPoint(camera, poseAt(frame, u).position), band);
    startGlide(conveyor, to, performance.now());
    wake();
  }

  // Double-click open hero space (not a card, not a control) with the page at
  // the top: the helix unwinds in place; again, it winds back.
  const onDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || !host.contains(event.target)) return;
    const x = event.clientX - (view.docLeft - window.scrollX);
    const y = event.clientY - (view.docTop - window.scrollY);
    if (pickAt(x, y) >= 0) return;
    if (!unwind.on && !canUnwind()) return;
    api.unwind(!unwind.on);
  };
  host.addEventListener("dblclick", onDoubleClick);
  const slice5Dispose = () => host.removeEventListener("dblclick", onDoubleClick);
  if (debug) {
    Object.assign(debug, {
      unwindAt: [] as number[],
      unwindState: () => ({ on: unwind.on, latched: unwind.latched !== null, progress: unwindProgress(unwind, performance.now()) }),
      unwindMs: () => unwindDurationMs(tileCount),
      focusKey: () => focusKey,
    });
  }

  // The rows' card boxes, measured from the overlay each latched frame (it
  // moves with the page and relayouts on resize), onto the z = 0 plane.
  function measureColumn(helix: HelixFrame) {
    if (!geoCamera) return null;
    const boxes = live.current.overlay.current?.listTargets();
    if (!boxes) return null;
    const rect = host.getBoundingClientRect();
    const camera = geoCamera;
    return {
      axisCenter: helix.center,
      axisDirection: helixRotation(helix).y,
      targets: tiles.map((tile) => {
        const box = boxes.get(tile.key);
        if (!box || box.height <= 0) return null;
        const x = box.left + box.width / 2 - rect.left;
        const y = box.top + box.height / 2 - rect.top;
        return { position: unprojectToPlane(camera, x, y, 0), scale: box.height * camera.worldPerPx };
      }),
    };
  }

  // Per frame: the overlay's fades, and the canvas name moving from its rest
  // rect into the list's lead (lab 1327-1360), inked to full as it lands.
  // A layout or theme change rewrites the rest values; they are recaptured
  // whenever the uniforms hold something this block did not write.
  function unwindFrame(progress: number) {
    live.current.overlay.current?.unwindFrame(progress, unwind.on);
    const cu = compMaterial.uniforms;
    const rect = cu.uNameRect.value as Vector4;
    if (!rect.equals(nameWritten)) nameRest.copy(rect);
    if (cu.uLod.value !== nameLodWritten) nameRestLod = cu.uLod.value;
    if (cu.uNameK.value !== nameInkWritten) nameRestInk = cu.uNameK.value;
    const target = progress > 0 ? nameTarget() : null;
    if (!target) {
      rect.copy(nameRest);
      cu.uLod.value = nameRestLod;
      cu.uNameK.value = nameRestInk;
    } else {
      const t = unwindEase(clamp01((progress - 0.08) / 0.84));
      const land = smoothstep01(clamp01((progress - 0.5) / 0.47));
      rect.set(
        nameRest.x + (target.x - nameRest.x) * t,
        nameRest.y + (target.y - nameRest.y) * t,
        nameRest.z + (target.z - nameRest.z) * t,
        nameRest.w + (target.w - nameRest.w) * t,
      );
      const maskHeight = ((cu.uName.value as Texture | null)?.image as HTMLCanvasElement | undefined)?.height ?? 0;
      cu.uLod.value = maskHeight ? Math.max(0, Math.log2(maskHeight / (rect.w * view.dpr))) : nameRestLod;
      cu.uNameK.value = nameRestInk + (1 - nameRestInk) * land;
    }
    nameWritten.copy(rect);
    nameLodWritten = cu.uLod.value;
    nameInkWritten = cu.uNameK.value;
  }

  // The name mask's rect at the lead slot's font size: the rest mask scaled
  // by the size ratio, its ink box on the slot's text (layoutName's sizing).
  function nameTarget(): Vector4 | null {
    const slot = live.current.overlay.current?.nameSlot();
    if (!slot || !probe) return null;
    const name = siteContent.hero.name;
    probe.font = `900 100px ${nameFamily}`;
    const w100 = probe.measureText(name).width || 1;
    const restSize = ((view.width * (isNarrow(view) ? 0.9 : 0.7)) / w100) * 100;
    const pad = Math.ceil(restSize * 0.04);
    const k = slot.fontPx / restSize;
    probe.font = `900 ${slot.fontPx}px ${nameFamily}`;
    const m = probe.measureText(name);
    const hostRect = host.getBoundingClientRect();
    const left = slot.rect.left - hostRect.left - m.actualBoundingBoxLeft;
    const baseline =
      slot.rect.top - hostRect.top + (slot.fontPx - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const inkTop = baseline - m.actualBoundingBoxAscent;
    // fx-hero: the mask carries the greeting's band above the name's pad.
    return new Vector4(left - pad * k, inkTop - (pad + greetBlock) * k, nameRest.z * k, nameRest.w * k);
  }
  // ---- end slice 5 ----

  // ---- fx-flight freeze ----
  // A stopped scene holds its clocks: whatever runs from a start time (the
  // hover-jump's glide, the unwind, the rebuild fade) carries on from where
  // the stop caught it, and the first frame steps one frame at most.
  function holdClocks(stoppedMs: number) {
    resuming = true;
    if (!ready || !(stoppedMs > 0)) return;
    conveyor.glide = afterPause(conveyor.glide, stoppedMs);
    if (unwind.latched) unwind.startMs += stoppedMs;
    if (rebuildAt !== null) rebuildAt += stoppedMs;
  }
  // ---- end fx-flight freeze ----

  // ---- fx-flight: the flown card ----
  // A clicked card flies into its modal as itself. The scene draws that one
  // card with the card shader (its bend, its shading, its lift, the seam, the
  // seen ring, and the cards that cover it) into a second canvas mounted above
  // the modal, on the scene canvas's own pixel grid and through the same
  // projection, so the frame the mesh hides and the frame it shows again are
  // the same pixels drawn twice. Between the seat and the slot the pose is
  // flightPoseAt(): the card travels and turns as a body while the bend
  // flattens and the shading releases. The order of every swap is handoff().
  const COVER_FRAG = /* glsl */ `
    uniform sampler2D mapF;
    varying vec2 vUv; varying vec3 vN; varying vec3 vViewPos;
    void main() {
      if (texture2D(mapF, vUv).a < 0.5) discard;
      gl_FragColor = vec4(0.0);
    }
  `;
  type Cover = { mesh: Mesh; uBend: { value: number }; uAxis: { value: Vector2 }; mapF: { value: Texture | null } };
  type Overlay = {
    canvas: HTMLCanvasElement;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    scene: Scene;
    shared: SharedCardUniforms;
    card: Mesh;
    cardUniforms: CardUniforms;
    under: Mesh;
    underAlpha: { value: number };
    covers: Cover[];
    field: DataTexture | null;
    fitted: string;
    origin: { left: number; top: number };
    faces: Map<number, { of: Texture; front: Texture; back: Texture }>;
    lost: boolean;
    onLost: () => void;
  };
  type Flight = {
    slot: number;
    state: HandoffState;
    alpha: number; // the mesh's own alpha on its seat (the hidden mesh reads 0)
    e: number; // as last drawn
    rect: Rect | null; // the slot, as last given
    lastSlot: FlightPose | null;
    pose: FlightPose | null; // as last drawn
    gap: number; // how far the last drawn pose was from the seat
  };
  let overlay: Overlay | null = null;
  let flight: Flight | null = null;
  let prewarm = 0;

  function createOverlay(): Overlay | null {
    try {
      const flownCanvas = document.createElement("canvas");
      const flownRenderer = new WebGLRenderer({
        canvas: flownCanvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      flownRenderer.outputColorSpace = LinearSRGBColorSpace;
      flownRenderer.setClearColor(new Color(0, 0, 0), 0);
      flownRenderer.autoClear = false;
      flownRenderer.setPixelRatio(1);
      flownCanvas.style.position = "fixed";
      flownCanvas.style.pointerEvents = "none";
      flownCanvas.style.display = "block";
      const flownShared: SharedCardUniforms = {
        uField: { value: null },
        uView: { value: new Vector4(0, 0, 1, 1) },
        uInk: { value: new Color() },
        uPaper: { value: new Color() },
        uSheen: { value: 0 },
        uSeam: { value: FIELD.seamFade },
      };
      const geometry = cardGeometry;
      // The card: blended, so its soft edge and its alpha show over the modal;
      // at full alpha it writes exactly what the coil's opaque card writes.
      const { material, uniforms } = createCardMaterial(flownShared);
      material.transparent = true;
      material.depthWrite = true;
      const card = new Mesh(geometry, material);
      card.frustumCulled = false;
      card.renderOrder = 1;
      // The same card again, only where a nearer card covers it, fading in
      // as the card leaves the coil.
      const underAlpha = { value: 0 };
      const under = new Mesh(
        geometry,
        new ShaderMaterial({
          vertexShader: material.vertexShader,
          fragmentShader: material.fragmentShader,
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
          depthFunc: GreaterDepth,
          uniforms: { ...(uniforms as unknown as Record<string, { value: unknown }>), uAlpha: underAlpha },
        }),
      );
      under.frustumCulled = false;
      under.renderOrder = 2;
      const flownScene = new Scene();
      flownScene.add(card, under);
      const created: Overlay = {
        canvas: flownCanvas,
        renderer: flownRenderer,
        camera: new PerspectiveCamera(COIL.camera.fovDeg, 1, 0.1, 100),
        scene: flownScene,
        shared: flownShared,
        card,
        cardUniforms: uniforms,
        under,
        underAlpha,
        covers: [],
        field: null,
        fitted: "",
        origin: { left: 0, top: 0 },
        faces: new Map(),
        lost: false,
        onLost: () => {
          created.lost = true;
        },
      };
      flownCanvas.addEventListener("webglcontextlost", created.onLost);
      return created;
    } catch {
      return null;
    }
  }

  function disposeOverlay(o: Overlay) {
    o.canvas.removeEventListener("webglcontextlost", o.onLost);
    o.canvas.remove();
    o.faces.forEach((face) => {
      face.front.dispose();
      face.back.dispose();
    });
    (o.card.material as ShaderMaterial).dispose();
    (o.under.material as ShaderMaterial).dispose();
    o.covers.forEach((cover) => (cover.mesh.material as ShaderMaterial).dispose());
    o.field?.dispose();
    o.renderer.dispose();
    o.renderer.forceContextLoss();
  }

  function liveOverlay() {
    if (overlay?.lost) {
      disposeOverlay(overlay);
      overlay = null;
    }
    overlay ??= createOverlay();
    return overlay;
  }

  // The flown card's own copies of a tile's two faces (a texture belongs to
  // the context that uploaded it), repainted faces included.
  function flownFaces(o: Overlay, tile: number) {
    const of = faces[tile].front;
    const held = o.faces.get(tile);
    if (held && held.of === of) return held;
    held?.front.dispose();
    held?.back.dispose();
    const copy = (source: Texture) => {
      const texture = new CanvasTexture(source.image as HTMLCanvasElement);
      texture.anisotropy = Math.min(8, o.renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
    const next = { of, front: copy(faces[tile].front), back: copy(faces[tile].back) };
    o.faces.set(tile, next);
    return next;
  }

  // The largest whole offset (in buffer px) up to `most` that is also a
  // whole number of device px; 0 when there is none near.
  function gridOffset(most: number, devicePerBuffer: number) {
    const from = Math.floor(most);
    for (let k = from; k > 0 && k > from - 64; k--) {
      const onDevice = k * devicePerBuffer;
      if (Math.abs(onDevice - Math.round(onDevice)) < 1e-4) return k;
    }
    return 0;
  }

  // The smallest whole size (in buffer px) from `least` up that is also a
  // whole number of device px, so the browser scales both canvases alike.
  function gridSize(least: number, devicePerBuffer: number) {
    const from = Math.max(1, Math.ceil(least));
    for (let k = from; k < from + 64; k++) {
      const onDevice = k * devicePerBuffer;
      if (Math.abs(onDevice - Math.round(onDevice)) < 1e-4) return k;
    }
    return from;
  }

  // The flown canvas covers the viewport, a whole number of the scene
  // canvas's buffer pixels from its origin, and looks through a window of the
  // scene camera's own projection: the two canvases share one pixel grid.
  function fitOverlay(o: Overlay) {
    if (!geoCamera) return;
    const rect = host.getBoundingClientRect();
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    const sx = buffer.x / view.width;
    const sy = buffer.y / view.height;
    // Both canvases also land on the same device pixels: the offset is a
    // whole number of device pixels too, or none at all.
    const device = window.devicePixelRatio || 1;
    const kx = gridOffset(-rect.left * sx, device / sx);
    const ky = gridOffset(-rect.top * sy, device / sy);
    const left = rect.left + kx / sx;
    const top = rect.top + ky / sy;
    const width = gridSize((window.innerWidth - left) * sx, device / sx);
    const height = gridSize((window.innerHeight - top) * sy, device / sy);
    o.origin = { left: rect.left, top: rect.top };
    const fitted = [left, top, width, height, buffer.x, buffer.y, view.width, view.height, lastFieldTime].join(",");
    if (fitted === o.fitted) return;
    o.fitted = fitted;
    o.renderer.setSize(width, height, false);
    o.canvas.style.left = `${left}px`;
    o.canvas.style.top = `${top}px`;
    o.canvas.style.width = `${width / sx}px`;
    o.canvas.style.height = `${height / sy}px`;
    o.camera.fov = camera.fov;
    o.camera.aspect = camera.aspect;
    o.camera.position.copy(camera.position);
    o.camera.quaternion.copy(camera.quaternion);
    o.camera.setViewOffset(buffer.x, buffer.y, kx, ky, width, height);
    o.camera.updateMatrixWorld();
    (o.shared.uView.value as Vector4).set(kx / buffer.x, (buffer.y - ky - height) / buffer.y, 1 / buffer.x, 1 / buffer.y);
    // The field as the scene last drew it: the recede and the seam read it.
    const w = fieldTarget.width;
    const h = fieldTarget.height;
    const bytes = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(fieldTarget, 0, 0, w, h, bytes);
    o.field?.dispose();
    const field = new DataTexture(bytes, w, h, RGBAFormat, UnsignedByteType);
    field.minFilter = LinearFilter;
    field.magFilter = LinearFilter;
    field.needsUpdate = true;
    o.field = field;
    o.shared.uField.value = field;
    (o.shared.uInk.value as Color).copy(shared.uInk.value as Color);
    (o.shared.uPaper.value as Color).copy(shared.uPaper.value as Color);
    o.shared.uSeam.value = shared.uSeam.value;
  }

  function placeFlown(mesh: Mesh, pose: FlightPose) {
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    basis.makeBasis(bx.set(...pose.basis.x), by.set(...pose.basis.y), bz.set(...pose.basis.z));
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.scale.setScalar(pose.scale);
  }

  // The cards nearer than the flown one, drawn to depth only at the poses the
  // scene last rendered: they cover the flown card as they covered the mesh.
  function placeCovers(o: Overlay, slot: number, on: boolean, mapF: Texture) {
    let used = 0;
    if (on && geo) {
      for (let j = 0; j < geo.slotCount; j++) {
        const pose = rendered[j];
        if (j === slot || !pose || pose.alpha < 0.995) continue;
        let cover = o.covers[used];
        if (!cover) {
          const uBend = { value: 0 };
          const uAxis = { value: new Vector2(0, 1) };
          const map = { value: null as Texture | null };
          const mesh = new Mesh(
            cardGeometry,
            new ShaderMaterial({
              vertexShader: CARD_VERT,
              fragmentShader: COVER_FRAG,
              side: DoubleSide,
              colorWrite: false,
              uniforms: { uBend, uAxis, mapF: map },
            }),
          );
          mesh.frustumCulled = false;
          mesh.renderOrder = 0;
          o.scene.add(mesh);
          cover = { mesh, uBend, uAxis, mapF: map };
          o.covers.push(cover);
        }
        placeFlown(cover.mesh, { ...pose } as FlightPose);
        cover.uBend.value = pose.bend;
        cover.uAxis.value.set(Math.sin(pose.beta), Math.cos(pose.beta));
        cover.mapF.value = mapF;
        cover.mesh.visible = true;
        used += 1;
      }
    }
    for (let i = used; i < o.covers.length; i++) o.covers[i].mesh.visible = false;
  }

  function drawFlown(o: Overlay, slot: number, pose: FlightPose) {
    fitOverlay(o);
    const textures = flownFaces(o, slots[slot].tile);
    const u = o.cardUniforms;
    u.mapF.value = textures.front;
    u.mapB.value = textures.back;
    u.uBend.value = pose.bend;
    (u.uAxis.value as Vector2).set(Math.sin(pose.beta), Math.cos(pose.beta));
    u.uFade.value = pose.fade;
    u.uBright.value = pose.bright;
    u.uAlpha.value = pose.alpha;
    u.uSeen.value = pose.seen;
    u.uShade.value = pose.shade;
    u.uSeamMix.value = pose.seam;
    u.uSoft.value = pose.soft;
    o.shared.uSheen.value = pose.sheen;
    placeFlown(o.card, pose);
    placeFlown(o.under, pose);
    const covered = pose.reveal < 1;
    o.underAlpha.value = pose.alpha * pose.reveal;
    o.under.visible = covered && pose.reveal > 0;
    placeCovers(o, slot, covered, textures.front);
    o.renderer.setRenderTarget(null);
    o.renderer.clear();
    o.renderer.render(o.scene, o.camera);
  }

  // The card on its seat, as the scene would draw it now.
  function seatOf(f: Flight): FlightPose | null {
    const pose = rendered[f.slot];
    const slot = slots[f.slot];
    if (!pose || !slot) return null;
    return seatPose(
      { ...pose, alpha: f.alpha },
      {
        bright: slot.uniforms.uBright.value,
        shade: slot.uniforms.uShade.value,
        sheen: shared.uSheen.value,
        seen: slot.uniforms.uSeen.value,
      },
    );
  }

  // Where the lift is heading: the scene's own hover rule, with the flown
  // card counted on its seat.
  function liftTarget(f: Flight) {
    const props = live.current;
    if (!geoCamera || !pointer.inside || !pointer.known || !props.interactive || props.input !== "fine") return 0;
    const seats = poses.map((pose, j) => (j === f.slot ? { ...pose, alpha: f.alpha } : pose));
    return pickCard(seats, rayThrough(geoCamera, pointer.x, pointer.y)) === f.slot ? 1 : 0;
  }

  function still() {
    update(0, lastTime);
    render(0);
    flightLog?.mark("scene-still", probeState());
  }

  function act(f: Flight, event: HandoffEvent) {
    const next = handoff(f.state, event);
    f.state = next.state;
    next.actions.forEach((action: HandoffAction) => {
      if (action === "draw-card") {
        const seat = seatOf(f);
        const o = liveOverlay();
        if (seat && o) {
          f.pose = seat;
          f.gap = 0;
          drawFlown(o, f.slot, seat);
          flightLog?.mark("clone-mount", { slot: f.slot });
        }
      } else if (action === "hide-mesh") {
        flightLog?.mark("mesh-hide", { slot: f.slot });
        hiddenSlot = f.slot;
        still();
      } else if (action === "show-mesh") {
        flightLog?.mark("mesh-show", { slot: f.slot, gap: f.gap });
        hiddenSlot = null;
        still();
      } else if (action === "clear-card") {
        if (overlay && !overlay.lost) {
          overlay.renderer.setRenderTarget(null);
          overlay.renderer.clear();
          // Its buffers go back until the next flight.
          overlay.renderer.setSize(1, 1, false);
          overlay.fitted = "";
        }
        overlay?.canvas.remove();
        flightLog?.mark("clone-unmount", { slot: f.slot });
      } else if (action === "resume") {
        // The loop is already stepping this frame (one frame's step, see wake).
        flightLog?.mark("unfreeze", probeState());
      }
    });
  }

  function layoutStamp() {
    const rect = host.getBoundingClientRect();
    return [view.width, view.height, view.dpr, rect.left, rect.top].join(",");
  }

  // The flown card at its progress, between the seat as the scene would draw
  // it now and the slot as last given. Returns the flat card's corners.
  function flightDraw(f: Flight, o: Overlay): Quad | null {
    if (!geoCamera || f.state === "landed" || f.state === "rest") return null;
    const seat = seatOf(f);
    if (!seat) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    if (f.rect) f.lastSlot = slotPose(geoCamera, f.rect, origin);
    const pose = flightPoseAt(seat, f.lastSlot ?? seat, f.e);
    f.pose = pose;
    f.gap = poseGap(pose, seat);
    drawFlown(o, f.slot, pose);
    return projectQuad({ ...pose, bend: 0 }, geoCamera, origin);
  }

  // The scene drew a still frame (a resize re-laid it out): the card in
  // flight is drawn again through the new layout, in the same frame.
  function flightStill() {
    if (flight && flight.pose && overlay && !overlay.lost) flightDraw(flight, overlay);
  }

  // The frame after a landing is the scene's first live one.
  function flightFrame() {
    if (!flight || flight.state !== "landed") return;
    act(flight, "frame");
    flight = null;
  }

  function flownApi(): CoilFlownApi {
    return {
      beginFlight(slot, mount) {
        const pose = rendered[slot];
        if (!ready || contextLost || disposed || !geoCamera || !pose || !slots[slot] || pose.alpha <= 0.01) return null;
        const o = liveOverlay();
        if (!o) return null;
        if (flight) act(flight, "abort");
        frozenByApi = true;
        landedAhead = false;
        stop();
        const f: Flight = { slot, state: "rest", alpha: pose.alpha, e: 0, rect: null, lastSlot: null, pose: null, gap: 0 };
        flight = f;
        mount.appendChild(o.canvas);
        act(f, "open");
        if (!f.pose) {
          flight = null;
          return null;
        }
        const finish = (event: "land" | "abort") => {
          if (flight !== f || (f.state !== "home" && event === "land")) return;
          act(f, event);
          if (f.state !== "landed") return;
          // A landing resumes the scene itself, on the next frame, ahead of
          // the props (the modal has closed; the flight was the one thing
          // holding it). A flight torn down under an open modal stays frozen.
          frozenByApi = false;
          landedAhead = event === "land";
          wake();
          // No frame to come (a modal is open, the hero is off screen): done.
          if (!raf) {
            act(f, "frame");
            flight = null;
          }
        };
        return {
          draw(e, rect, dt) {
            if (flight !== f || liveOverlay() !== o) return null;
            if (f.state === "home" && dt > 0) {
              // The lift follows the pointer on the way home, at the scene's
              // own rate, so the card lands as the scene would draw it next.
              const lifted = slots[f.slot];
              lifted.hover += (liftTarget(f) - lifted.hover) * (1 - Math.exp(-Math.min(dt, COIL.lab.maxFrameSeconds) * HOVER_RATE));
              update(0, lastTime);
            }
            f.e = e;
            if (rect) f.rect = rect;
            return flightDraw(f, o);
          },
          stamp: layoutStamp,
          arrive() {
            if (flight === f) act(f, "arrive");
          },
          close() {
            if (flight === f) act(f, "close");
          },
          land() {
            flightLog?.mark("clone-landed", { slot: f.slot, gap: f.gap });
            finish("land");
          },
          abort() {
            finish("abort");
          },
        };
      },
    };
  }

  function flownDispose() {
    if (prewarm) window.clearTimeout(prewarm);
    if (overlay) disposeOverlay(overlay);
    overlay = null;
    flight = null;
  }

  // The flown canvas and its program are made ahead of the first click.
  function warmOverlay() {
    prewarm = window.setTimeout(() => {
      prewarm = 0;
      // Only a fine pointer flies cards (a tap opens its modal directly).
      if (disposed || contextLost || overlay || live.current.input !== "fine") return;
      const o = liveOverlay();
      if (o) o.renderer.compile(o.scene, o.camera);
    }, 1200);
  }

  if (flightLog) {
    // The flown card as last drawn: its corners, its outline and its face grid.
    flightLog.scene.flown = () => (flight?.pose ? probePoseInfo(flight.pose) : null);
    flightLog.scene.flight = () => (flight ? { slot: flight.slot, state: flight.state, gap: flight.gap, pose: flight.pose } : null);
  }
  // ---- end fx-flight ----

  // ---- slice 7: the coarse pointer's drag-to-spin ----
  // The hero is touch-action: pan-y, so the browser keeps every vertical swipe
  // (a swipe starting on a card scrolls the page, never hijacked) and hands
  // horizontal ones to this Observer, which locks each gesture to its first
  // axis. A horizontal drag moves the conveyor's target under the finger (the
  // front card follows it); the release throws it, and the throw coasts
  // through the same smoothing stage and speed cap and settles on a card. A
  // new touch catches a coasting coil. Nothing before the entrance ends, while
  // frozen or unwound, or on a fine pointer (its wheel and hover do the work).
  let pressScrollY = 0;
  function canDrag() {
    const props = live.current;
    return ready && props.interactive && props.input === "coarse" && !props.frozen && !frozenByApi && !unwind.on;
  }
  // Cards per px of horizontal finger travel: the front card's arc per card,
  // across the screen.
  function dragCardsPerPx() {
    if (!geo) return 0;
    return 1 / Math.max(1, geo.step * geo.cardPx * Math.cos(geo.axisRad));
  }
  const dragObserver = Observer.create({
    target: host,
    type: "touch",
    lockAxis: true,
    dragMinimum: DRAG_MINIMUM_PX,
    onPress: () => {
      pressScrollY = window.scrollY;
      pressCaughtCoil = coast !== null;
      if (coast) {
        conveyor.target = conveyor.offset;
        coast = null;
      }
    },
    onDrag: (self) => {
      // The page moved: the browser took this gesture as a vertical pan.
      if (self.axis !== "x" || Math.abs(window.scrollY - pressScrollY) > 2 || !canDrag()) return;
      dragging = true;
      conveyor.glide = null;
      conveyor.target += self.deltaX * dragCardsPerPx();
      wake();
    },
    onRelease: (self) => {
      if (!dragging) return;
      dragging = false;
      if (!canDrag()) return;
      const cap = COIL.spinCapCardsPerSecond;
      const velocity = Math.min(cap, Math.max(-cap, self.velocityX * dragCardsPerPx()));
      coast = { rest: Math.round(conveyor.target + velocity * COAST_TAU_S) };
      wake();
    },
  });
  if (debug) {
    (debug as DebugStats & { drag?: () => object }).drag = () => ({
      dragging,
      coast: coast?.rest ?? null,
      offset: conveyor.offset,
      target: conveyor.target,
      velocity: conveyor.velocity,
      cardsPerPx: dragCardsPerPx(),
    });
  }
  // ---- end slice 7 ----

  // ---- boot: the name's face and every card's sources, then the first frame
  const style = getComputedStyle(document.documentElement);
  nameFamily = style.getPropertyValue("--font-display").trim() || "sans-serif";
  const withTimeout = <T,>(promise: Promise<T>, fallback: T) =>
    Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), TEXTURE_TIMEOUT_MS))]);
  const logoFor = (slug: string) => siteContent.workItems.find((item) => item.slug === slug)?.logo ?? null;
  // Slice 4: each card source (or its timeout) moves the loader's tally.
  let texturesSettled = 0;
  const countTexture = (source: CardSource) => {
    texturesSettled += 1;
    reportHomeLoad("textures", texturesSettled / tileCount);
    return source;
  };

  Promise.all([
    withTimeout(
      document.fonts.load(`900 100px ${nameFamily}`).then(() => undefined),
      undefined,
    ),
    Promise.all(
      tiles.map((tile) =>
        withTimeout<CardSource>(
          loadCardSource(tile, logoFor, budget.textureSize),
          tile.kind === "photo" ? { kind: "photo", key: tile.key, image: null } : { kind: "work", key: tile.key, logo: null },
        ).then(countTexture), // slice 4: the loader's tally
      ),
    ),
  ])
    .then(([, loaded]) => {
      if (disposed) return;
      sources = loaded;
      const seen = getSeen();
      tiles.forEach((tile, i) => {
        seenLevel[i] = seen.has(tile.key) ? 1 : 0;
      });
      applyTheme();
      tiles.forEach((_, i) => paintTile(i));
      ready = true;
      const box = pendingSize ?? host.getBoundingClientRect();
      layout(box.width, box.height);
      wake();
      warmOverlay(); // fx-flight
    })
    .catch((error) => {
      if (!disposed) live.current.onError(error);
    });

  // Slice 7: an input change (a tablet gaining a trackpad, emulation) moves
  // the budget: re-lay out at the new DPR cap and repaint every card at the
  // new texture size, a few per frame as a theme change does.
  function sync() {
    // fx-flight freeze: the props have caught up with the landing (or name a new modal).
    landedAhead = false;
    const next = budgetFor(live.current.input);
    if (!sameBudget(next, budget)) {
      budget = next;
      if (ready && !contextLost && !disposed) {
        layout(view.width, view.height);
        repaints.enqueue(tiles.map((_, i) => i));
        if (!raf) renderStill();
      }
    }
    wake();
  }

  return {
    wake,
    sync,
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stopWatchingTheme();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      host.removeEventListener("wheel", onWheel);
      window.removeEventListener("wheel", onWindowWheel); // fx-input
      window.removeEventListener(COIL_FX_EVENT, onFx); // fx-hero
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      slice5Dispose();
      flownDispose(); // fx-flight
      dragObserver.kill(); // slice 7
      repaints.clear();
      setSceneHover(false);
      live.current.overlay.current?.nudge(null);
      if (live.current.api && live.current.api.current === api) live.current.api.current = null;
      faces.forEach((face) => {
        face.front.dispose();
        face.back.dispose();
      });
      slots.forEach((slot) => (slot.mesh.material as ShaderMaterial).dispose());
      cardGeometry.dispose();
      quad.dispose();
      fieldMaterial.dispose();
      compMaterial.dispose();
      nameTexture?.dispose();
      repelTexture.dispose(); // fx-hero
      fieldTarget.dispose();
      renderer.dispose();
      if (debug) delete (window as unknown as { __coil?: DebugStats }).__coil;
    },
  };
}
