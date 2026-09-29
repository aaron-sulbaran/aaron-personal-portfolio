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
import { fieldTime } from "@/lib/coil/drift";
import type { InputDriver } from "@/lib/coil/drivers";
import { COMPOSITE_FRAG, COMPOSITE_VERT, FIELD, FIELD_FRAG, FULLSCREEN_VERT } from "@/lib/coil/field.glsl";
import { createCardGeometry, createCardMaterial, type CardUniforms, type SharedCardUniforms } from "@/lib/coil/material";
import { loadCardSource, paintCard, paintNameMask, type CardSource } from "@/lib/coil/textures";
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
import { setSceneHover } from "@/lib/cursor/hover";
import type { HeroOverlayHandle } from "./HeroOverlay";
// Slice 4: the loader's tally and the name handoff.
import { reportHomeLoad } from "@/lib/loader/progress";
import type { NameTarget } from "@/lib/loader/handoff";

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

export type CoilCardRef = { key: string; slot: number };

// For slices 4 and 5 (the entrance and the flight): the live scene, read
// without a React render.
export type CoilSceneApi = {
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
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(props);
  const runtimeRef = useRef<CoilRuntime | null>(null);

  useEffect(() => {
    liveRef.current = props;
    runtimeRef.current?.wake();
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

type CoilRuntime = { wake: () => void; dispose: () => void };

const TEXTURE_TIMEOUT_MS = 6000; // the loader's give-up time: a slow photo paints the plain pane
const GESTURE_GAP_MS = 260; // wheel events closer than this are one gesture (the lab's value)
const CLICK_SLOP_PX = 6;
const HOVER_RATE = 6.5; // 1/s, the lift's soft approach (no overshoot)
const SEEN_RATE = 8;
const HOVER_SCALE = 0.045;
const HOVER_BRIGHT = 0.05;
const HOVER_UNFADE = 0.6;
// A theme repaint starts no new card past this much of a frame (at most 4).
const REPAINT_BUDGET_MS = 6;

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
  api?: CoilSceneApi;
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

  // ---- passes
  const orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const camera = new PerspectiveCamera(COIL.camera.fovDeg, 1, 0.1, 100);
  const fieldScene = new Scene();
  const compScene = new Scene();
  const cardScene = new Scene();
  const fieldTarget = new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const uView = { value: new Vector4(0, 0, 1, 1) };
  const quad = new PlaneGeometry(2, 2);

  const fieldMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {
      uT: { value: fieldTime(0) },
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
    const painted = paintCard(sources[tile], theme);
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
  let overCardsSince: number | null = null;
  let capturing = false;
  let lastCaptureAt = -Infinity;
  let capturedSeconds = 0;
  let fieldElapsed = 0;
  let lastFieldTime = Number.NaN;
  let lastScrollY = window.scrollY;
  let lastTime = performance.now();
  let raf = 0;
  let ready = false;
  let disposed = false;
  let visible = true;
  let frozenByApi = false;
  let contextLost = false;
  let firstFrameSent = false;
  // ---- slice 4 state: the entrance clock and the name handoff ----
  let nameBox: { left: number; baseline: number; inkWidth: number; size: number; maskTop: number; maskHeight: number } | null =
    null;
  let entranceBase: number | null = null; // when this scene's entrance clock reads 0
  let entranceEnded = false;
  let nameLanded = false;
  // ?coildebug=entrance=<ms> freezes the drawn entrance at that moment (the
  // real clock still ends it, so the page unlocks).
  const forcedEntrance = debugMode?.match(/^entrance=(-?\d+(?:\.\d+)?)$/);
  const forcedEntranceMs = forcedEntrance ? Number(forcedEntrance[1]) : null;

  // Real milliseconds since the entrance started (-Infinity before it,
  // Infinity for a fast start). A start the scene first sees late (it was
  // still loading) begins at that first sight, so no part of it is skipped.
  function entranceElapsedMs(now: number) {
    const entrance = live.current.entrance;
    if (!entrance) return Number.NEGATIVE_INFINITY;
    if (entranceBase === null) {
      entranceBase = Number.isFinite(entrance.startMs) ? Math.max(entrance.startMs, now) : Number.NEGATIVE_INFINITY;
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
        capturing: () => capturing,
      }
    : null;
  if (debug) (window as unknown as { __coil?: DebugStats }).__coil = debug;
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
    const mask = paintNameMask(siteContent.hero.name, nameFamily, size, Math.min(2, window.devicePixelRatio || 1));
    nameTexture?.dispose();
    const texture = new CanvasTexture(mask.canvas);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    nameTexture = texture;
    const inkWidth = mask.width - 2 * mask.pad;
    const capTop = H / 2 - mask.ascent / 2;
    const left = (W - inkWidth) / 2;
    const cu = compMaterial.uniforms;
    cu.uName.value = texture;
    cu.uNameRect.value.set(left - mask.pad, capTop - mask.pad, mask.width, mask.height);
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (mask.height * view.dpr)));
    cu.uNameA.value = posterMode ? 0 : 1;
    // Slice 4: the name's geometry for the loader's handoff (canvas px).
    nameBox = {
      left,
      baseline: capTop + mask.ascent,
      inkWidth,
      size,
      maskTop: capTop - mask.pad,
      maskHeight: mask.height,
    };

    // The greeting and the control ride the name (lab 842-859): the greeting
    // just above the cap line, the control's text flush with the name's
    // right edge, on the same line.
    const greetingPx = narrow ? 16 : Math.min(21, Math.max(16, W * 0.0125));
    const greetingCapTop = capTop - greetingPx * 1.05 - mask.ascent * 0.07;
    const greetingLeft = left + size * 0.02;
    live.current.overlay.current?.layout(
      posterMode
        ? null
        : {
            left: greetingLeft,
            // Inter's cap line sits about 0.14em below a 1.0 line box's top.
            top: greetingCapTop - 0.14 * greetingPx,
            width: left + inkWidth - greetingLeft,
            greetingPx,
            controlPx: Math.round(greetingPx * 0.86),
          },
    );
  }

  function layout(width: number, height: number) {
    view.width = Math.max(1, width);
    view.height = Math.max(1, height);
    view.dpr = Math.min(window.devicePixelRatio || 1, COIL.lab.dprCap);
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
    lastFieldTime = Number.NaN;
    geo = solveGeometry(view, tileCount);
    ensureSlots(geo.slotCount);
    poses.length = geo.slotCount;
    rendered.length = geo.slotCount;
    if (debug) debug.geo = geo;
    layoutName();
  }

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

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.known = true;
    updatePointerLocal();
    pointer.inside = pointerOverHero(event.target);
    // Capture ends the moment the pointer itself leaves the card set; a card
    // passing out from under a still pointer does not end it.
    const over = pointer.inside && live.current.input === "fine" ? pickAt(pointer.x, pointer.y) >= 0 : false;
    if (!over) {
      overCardsSince = null;
      if (capturing && debug) debug.released += 1;
      capturing = false;
    } else if (overCardsSince === null) {
      overCardsSince = performance.now();
    }
    wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    pointer.inside = false;
    pointer.known = false;
    overCardsSince = null;
    capturing = false;
  };

  // Wheel capture, decided per event (lab 1383-1394, plus the 400ms hover
  // intent the lab lacked). A new gesture spins the coil only with the page
  // at the top, the hero ready, the pointer on a card, and the pointer resting
  // on the cards for the intent delay; an ongoing captured gesture (events
  // under 260ms apart, trackpad inertia included) keeps the coil while the
  // pointer stays inside the helix, so the page never scrolls mid-spin.
  // Everything else is native page scroll.
  const onWheel = (event: WheelEvent) => {
    const props = live.current;
    if (!ready || props.frozen || frozenByApi || !props.interactive || props.input !== "fine" || event.ctrlKey) {
      capturing = false;
      return;
    }
    if (window.scrollY > 2 || unwind.on) {
      capturing = false;
      return;
    }
    const now = performance.now();
    // Some synthesized wheels carry no position (0, 0); the last pointer
    // position stands in, as in the lab.
    if (event.clientX !== 0 || event.clientY !== 0 || !pointer.known) {
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
    }
    updatePointerLocal();
    if (capturing && now - lastCaptureAt >= GESTURE_GAP_MS) capturing = false;
    const inGesture = capturing;
    let capture = false;
    if (inGesture) {
      capture = sil !== null && insideSilhouette(sil, pointer.x, pointer.y);
    } else {
      const intent = overCardsSince !== null && now - overCardsSince >= COIL.capture.hoverIntentMs;
      capture = intent && pickAt(pointer.x, pointer.y) >= 0;
    }
    if (!capture) {
      if (capturing && debug) debug.released += 1;
      capturing = false;
      return;
    }
    event.preventDefault();
    if (!capturing && debug) debug.captured += 1;
    capturing = true;
    lastCaptureAt = now;
    addWheel(conveyor, wheelPixels(event.deltaX, event.deltaY, event.deltaMode, view.height));
    wake();
  };

  let downAt: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    downAt = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = downAt;
    downAt = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    if (!ready || hoveredSlot < 0 || live.current.input !== "fine") return;
    const slot = slots[hoveredSlot];
    const tile = tiles[slot.tile];
    // Slice 5 wiring block (the flight): the handler freezes, projects the
    // card's quad through the api and opens the modal. Until then it is unset.
    live.current.onCardClick?.({ key: tile.key, slot: hoveredSlot });
  };

  // ---- the frame
  function update(dt: number, now: number) {
    if (!geo || !geoCamera) return;
    const props = live.current;
    const scrollY = window.scrollY;
    const scrollDelta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    updatePointerLocal();

    const previous = conveyor.offset;
    if (!posterMode) {
      stepConveyor(conveyor, {
        dt,
        nowMs: now,
        idleWeight: 1,
        pageScrollPx: props.interactive ? scrollDelta : 0,
      });
      stepEnvelope(envelope, conveyor.excessVelocity, dt);
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
      if (entrance && !entranceEnded && realElapsedMs >= clock.durationS * 1000) {
        entranceEnded = true;
        props.onEntranceEnd?.();
      }
    }
    // ---- end slice 4 block ----
    // ---- slice 5 wiring block: the unwind (progress 0 until then) ----
    const listProgress = unwindProgress(unwind, now);
    // ---- end slice 5 block ----

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
      if (posterMode || j === hiddenSlot) pose = { ...pose, alpha: 0 };
      poses[j] = pose;

      slot.hover += ((j === hoveredSlot ? 1 : 0) - slot.hover) * hoverStep;
      const lift = slot.hover > 0.001 ? slot.hover : 0;
      const shown: CardPose = lift
        ? { ...pose, scale: pose.scale * (1 + HOVER_SCALE * lift), fade: pose.fade * (1 - HOVER_UNFADE * lift) }
        : pose;
      rendered[j] = shown;
      applyPose(slot, shown, HOVER_BRIGHT * lift);
      slot.uniforms.uSeen.value = seenLevel[tile];
    }
    sil = silhouette(helix, geoCamera, poses);

    // Hover: picked every frame, since cards move under a still pointer.
    const pickable = pointer.inside && pointer.known && props.interactive && props.input === "fine";
    const nextHover = pickable ? pickAt(pointer.x, pointer.y) : -1;
    hoveredSlot = nextHover;
    setSceneHover(nextHover >= 0);
    if (nextHover >= 0) overCardsSince ??= now;
    else if (!capturing && now - lastCaptureAt > 600) overCardsSince = null;

    // The nudge: after 2.6s of captured wheeling with the pointer still on the
    // helix, a caret by the cursor points off it; it goes when the pointer leaves.
    const onHelix = pickable && scrollY <= 2 && sil !== null && insideSilhouette(sil, pointer.x, pointer.y);
    if (!onHelix) capturedSeconds = 0;
    else if (now - lastCaptureAt < GESTURE_GAP_MS) capturedSeconds += dt;
    const overlay = props.overlay.current;
    if (onHelix && capturedSeconds * 1000 > COIL.capture.nudgeAfterMs && sil) {
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

    repaints.drain(paintTile, REPAINT_BUDGET_MS);
  }

  function render(dt: number) {
    if (!posterMode) fieldElapsed += dt;
    // The poster is the live field's first frame, so the scene picks up where it left off.
    const t = fieldTime(posterMode ? 0 : fieldElapsed);
    fieldMaterial.uniforms.uT.value = t;
    renderer.setRenderTarget(null);
    renderer.clear();
    if (t !== lastFieldTime) {
      renderer.setRenderTarget(fieldTarget);
      renderer.render(fieldScene, orthoCamera);
      renderer.setRenderTarget(null);
      lastFieldTime = t;
    }
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
      !live.current.frozen &&
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
    const dt = Math.min(Math.max(interval, 0) / 1000, COIL.lab.maxFrameSeconds);
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
    lastTime = performance.now();
    // A return from off screen or a hidden tab must not read as one huge scroll.
    lastScrollY = window.scrollY;
    raf = requestAnimationFrame(frame);
  }

  // One frame outside the loop (a resize while frozen or off screen), so
  // the canvas never shows a stretched stale buffer.
  function renderStill() {
    if (!ready || contextLost || disposed) return;
    update(0, performance.now());
    render(0);
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
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointerup", onPointerUp);

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

  // ---- the api for slices 4 and 5
  const api: CoilSceneApi = {
    freeze(on) {
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
          loadCardSource(tile, logoFor),
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
    })
    .catch((error) => {
      if (!disposed) live.current.onError(error);
    });

  return {
    wake,
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
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("webglcontextlost", onContextLost);
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
      fieldTarget.dispose();
      renderer.dispose();
      if (debug) delete (window as unknown as { __coil?: DebugStats }).__coil;
    },
  };
}
