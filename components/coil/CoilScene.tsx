"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
  type Texture,
} from "three";
import { siteContent, strandTiles } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import {
  insideSilhouette,
  isNarrow,
  projectPoint,
  projectQuad,
  restHelix,
  type Camera,
  type CardPose,
  type Quad,
} from "@/lib/coil/geometry";
import {
  addWheel,
  stepConveyor,
  stepEnvelope,
  stretchedDy,
  wheelPixels,
} from "@/lib/coil/motion";
import { entranceClock, entranceHelix, isRested } from "@/lib/coil/entrance";
import { runRender, runUpdate, type RenderSteps, type UpdateSteps } from "@/lib/coil/frame";
import { unwindProgress } from "@/lib/coil/unwind";
import { budgetFor, sameBudget } from "@/lib/coil/drivers";
import { Observer } from "@/lib/gsap";
import { FIELD } from "@/lib/coil/field.glsl";
import { createCardMaterial, type CardUniforms, type SharedCardUniforms } from "@/lib/coil/material";
import { loadCardSource, type CardSource } from "@/lib/coil/textures";
import { readCoilTheme, watchTheme } from "@/lib/coil/theme";
import {
  createDebugStats,
  debugTokens,
  pushStat,
  readDebugFlags,
  removeDebugStats,
  throwFrameAt as throwFrameAtFromTokens,
} from "./scene/debug";
import { HOVER_RATE, createCards } from "./scene/cards";
import { createField } from "./scene/field";
import { createHover, heroVisible } from "./scene/hover";
import { createName, createNameFill } from "./scene/name";
import { createLayout, createPasses, createRenderer, observeResize, watchContext } from "./scene/renderer";
import { createSceneState, type LoopLink, type SceneCtx, type SceneFrame } from "./scene/state";
// ---- fx-input imports: wheel ownership and the row hold ----
import { decideWheel, feedsPageScroll, gestureOwner, nudgeShown, pointerMoved } from "@/lib/coil/capture";
import { rowHoldWeight } from "@/lib/coil/motion";
// ---- end fx-input imports ----
import { setSceneHover } from "@/lib/cursor/hover";
// Slice 4: the loader's tally and the name handoff.
import { reportHomeLoad } from "@/lib/loader/progress";
// ---- slice 5 imports: the book, the unwind egg and the flight ----
import { clamp01, helixRotation, smoothstep01, unprojectToPlane, type HelixFrame } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { settleUnwind, toggleUnwind, unwindDurationMs } from "@/lib/coil/unwind";
// ---- end slice 5 imports ----
// ---- fx-hero imports: the greeting in the name, the name's fill and repel, the drift presets ----
// (DataTexture, RGBAFormat and UnsignedByteType come in with the fx-flight imports.)
import { NAME_FILLS } from "@/lib/coil/field.glsl";
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

import type { CoilFlightApi, CoilFlownApi, CoilRuntime, CoilSceneApi, CoilSceneProps } from "./scene/types";

export type {
  CoilCardFaces,
  CoilCardRef,
  CoilEntrance,
  CoilFlightApi,
  CoilFlightHandle,
  CoilFlownApi,
  CoilSceneApi,
  CoilSceneProps,
} from "./scene/types";

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

// Slice 7, the touch drag: a released flick coasts on this time constant (an
// exponential throw, distance = velocity * tau) and settles on a card.
const COAST_TAU_S = 0.325;
const COAST_SETTLED_CARDS = 0.002;
const DRAG_MINIMUM_PX = 4;
// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over this, so nothing pops.
const REBUILD_FADE_MS = 450;
const TEXTURE_TIMEOUT_MS = 6000; // the loader's give-up time: a slow photo paints the plain pane
const CLICK_SLOP_PX = 6;

function startCoil(host: HTMLElement, canvas: HTMLCanvasElement, live: RefObject<CoilSceneProps>): CoilRuntime {
  const flags = readDebugFlags();
  const { posterMode, forcedEntranceMs } = flags;

  const renderer = createRenderer(canvas);

  const tiles = strandTiles;
  const tileCount = tiles.length;
  // The state more than one part of the scene reads (scene/state.ts).
  const st = createSceneState(readCoilTheme(), budgetFor(live.current.input));
  const debug = createDebugStats(flags, {
    offset: () => st.conveyor.offset,
    hovered: () => st.hoveredSlot,
    // ---- fx-input debug ----
    capturing: () => gestureOwner(st.capture, performance.now()) === "coil",
    owner: () => gestureOwner(st.capture, performance.now()) ?? "none",
    silhouette: () => st.sil,
    // ---- end fx-input debug ----
  });
  // ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
  const flightLog = flightProbe();
  const ctx: SceneCtx = { host, canvas, live, tiles, tileCount, flags, debug, flightLog, st };
  // The loop's entry points for the parts made before it.
  const loop: LoopLink = {
    wake: () => wake(),
    stop: () => stop(),
    renderStill: () => renderStill(),
    shouldRun: () => shouldRun(),
    update: (dt, now) => update(dt, now),
    render: (dt) => render(dt),
  };

  // ---- passes
  const gl = createPasses(renderer);
  const { camera, fieldTarget, quad } = gl;

  // ---- fx-hero: the name's fill and repel buffer, made before the composite that holds them ----
  const nameFx = createNameFill(flags.nameParam);
  const field = createField(ctx, gl, { mode: NAME_FILLS.indexOf(nameFx.fill), repel: nameFx.repelTexture });
  const { compMaterial } = field;
  const heroName = createName(ctx, compMaterial, nameFx, loop);

  // ---- cards
  const cards = createCards(ctx, gl);
  const { shared, cardGeometry, slots, faces } = cards;

  function applyTheme() {
    field.applyTheme();
    cards.applyTheme();
    st.lastFieldTime = Number.NaN;
  }

  // ---- state
  // ---- slice 4 state: the entrance clock and the name handoff ----
  let entranceBase: number | null = null; // when this scene's entrance clock reads 0
  let entranceEnded = false;

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
      if (rebuilt) st.rebuildAt = now;
    }
    return now - entranceBase;
  }
  // ---- end slice 4 state ----
  if (debug) {
    debug.budget = () => {
      const buffer = renderer.getDrawingBufferSize(new Vector2());
      const sizes = cards.textureSizes();
      return {
        input: live.current.input,
        dprCap: st.budget.dprCap,
        devicePixelRatio: window.devicePixelRatio,
        dpr: st.view.dpr,
        css: [st.view.width, st.view.height],
        buffer: [buffer.x, buffer.y],
        field: [fieldTarget.width, fieldTarget.height],
        textures: [...sizes],
        narrow: st.geo?.narrow ?? null,
        slots: st.geo?.slotCount ?? null,
        cards: tileCount,
      };
    };
    // Slice 7: every visible card's bent corners in viewport px (for the
    // header and greeting overlap checks).
    debug.visibleQuads = () => {
      if (!st.geoCamera) return [];
      const rect = host.getBoundingClientRect();
      return st.rendered
        .filter((pose) => pose && pose.alpha > 0.01)
        .map((pose) => projectQuad(pose, st.geoCamera as Camera, { left: rect.left, top: rect.top }));
    };
  }
  const push = pushStat;

  // ---- layout
  const layout = createLayout(
    ctx,
    gl,
    {
      resizePasses: field.resizePasses,
      ensureSlots: cards.ensureSlots,
      layoutName: heroName.layoutName,
    },
    loop,
  );

  if (debug) {
    debug.nameFx = () => {
      const fx = heroName.fx();
      return { nameFill: fx.nameFill, driftPreset: field.driftPreset(), repelActive: fx.repelActive, repelMax: fx.repelMax, nameClock: fx.nameClock };
    };
  }

  // ---- picking and the pointer
  const hover = createHover(ctx, cards, loop);

  function updatePointerLocal() {
    st.pointer.x = st.pointer.clientX - (st.view.docLeft - window.scrollX);
    st.pointer.y = st.pointer.clientY - (st.view.docTop - window.scrollY);
  }

  // Only the canvas itself counts: the overlay's control, the mark, the Menu
  // pill and its scrim all sit over the hero and must never pick a card.
  function pointerOverHero(target: EventTarget | null) {
    if (!(target instanceof Node) || !host.contains(target)) return false;
    return st.pointer.x >= 0 && st.pointer.x <= st.view.width && st.pointer.y >= 0 && st.pointer.y <= st.view.height;
  }

  // ---- fx-input: wheel ownership (lib/coil/capture.ts) ----
  // The hero may take a wheel gesture: ready, entrance over, not frozen, not
  // unwound, a fine pointer, and not a pinch (ctrl + wheel).
  function wheelInteractive(event: WheelEvent) {
    const props = live.current;
    return (
      st.ready &&
      !props.frozen &&
      !st.frozenByApi &&
      props.interactive &&
      props.input === "fine" &&
      !event.ctrlKey &&
      !st.unwind.on
    );
  }

  // The pointer over the canvas and inside the helix's projected hull (gaps
  // between cards included), from the last rendered frame.
  function pointerInsideHelix() {
    return st.pointer.inside && st.sil !== null && insideSilhouette(st.sil, st.pointer.x, st.pointer.y);
  }

  function setCapture(next: typeof st.capture, nowMs: number) {
    if (debug && gestureOwner(st.capture, nowMs) === "coil" && next.owner === "page") debug.released += 1;
    st.capture = next;
  }

  // Only a real move counts: a card or a gap passing under a still pointer is
  // not a move, so it never releases a coil gesture.
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const moved = !st.pointer.known || event.clientX !== st.pointer.clientX || event.clientY !== st.pointer.clientY;
    st.pointer.clientX = event.clientX;
    st.pointer.clientY = event.clientY;
    st.pointer.known = true;
    updatePointerLocal();
    st.pointer.inside = pointerOverHero(event.target);
    const now = performance.now();
    if (moved) setCapture(pointerMoved(st.capture, { nowMs: now, insideSilhouette: pointerInsideHelix() }), now);
    wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    st.pointer.inside = false;
    st.pointer.known = false;
    const now = performance.now();
    setCapture(pointerMoved(st.capture, { nowMs: now, insideSilhouette: false }), now);
  };

  // Decided once per gesture (events under COIL.capture.gestureGapMs apart,
  // trackpad inertia included): a gesture that starts inside the helix with
  // the hero at least half in view spins the coil from its first event, in
  // both directions, and the page does not move; any other gesture scrolls
  // the page natively. The coil responds on the frame after the event (one
  // smoothing stage and the spin cap, nothing before the first motion).
  const onWheel = (event: WheelEvent) => {
    const now = performance.now();
    const fresh = gestureOwner(st.capture, now) === null;
    if (fresh) {
      // Some synthesized wheels carry no position (0, 0); the last pointer
      // position stands in, as in the lab.
      if (event.clientX !== 0 || event.clientY !== 0 || !st.pointer.known) {
        st.pointer.clientX = event.clientX;
        st.pointer.clientY = event.clientY;
      }
      updatePointerLocal();
      st.pointer.inside = pointerOverHero(event.target);
    }
    setCapture(
      decideWheel(st.capture, {
        nowMs: now,
        interactive: wheelInteractive(event),
        heroVisible: fresh ? heroVisible(host) : 1,
        insideSilhouette: fresh ? pointerInsideHelix() : true,
      }),
      now,
    );
    if (st.capture.owner !== "coil") return;
    event.preventDefault();
    if (fresh && debug) debug.captured += 1;
    addWheel(st.conveyor, wheelPixels(event.deltaX, event.deltaY, event.deltaMode, st.view.height));
    wake();
  };

  // Wheels elsewhere on the page (the host never sees them) still belong to
  // the running gesture: a gesture that left the hero stays the page's, and
  // one that began outside it never becomes the coil's on arrival.
  const onWindowWheel = (event: WheelEvent) => {
    if (event.target instanceof Node && host.contains(event.target)) return;
    const now = performance.now();
    setCapture(decideWheel(st.capture, { nowMs: now, interactive: false, heroVisible: 0, insideSilhouette: false }), now);
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
      if (!st.ready || st.dragging || st.pressCaughtCoil || !props.interactive || props.frozen || st.frozenByApi || st.unwind.on) return;
      const card = api.cardAt(event.clientX, event.clientY);
      if (card) props.onCardClick?.({ ...card, tap: true });
      return;
    }
    // ---- end slice 7 ----
    if (!st.ready || st.hoveredSlot < 0 || live.current.input !== "fine") return;
    const slot = slots[st.hoveredSlot];
    const tile = tiles[slot.tile];
    // Slice 5 wiring block (the flight): the handler freezes, projects the
    // card's quad through the api and opens the modal. Until then it is unset.
    live.current.onCardClick?.({ key: tile.key, slot: st.hoveredSlot });
  };

  // ---- the frame
  // Slice 7, QA only: ?coildebug=throw=frame throws from the loop a second in.
  const throwFrameAt = throwFrameAtFromTokens();
  type Frame = SceneFrame;

  function update(dt: number, now: number) {
    if (!st.geo || !st.geoCamera) return;
    if (now > throwFrameAt) throw new Error("coildebug: scene frame");
    runUpdate(updateSteps, {
      dt,
      now,
      props: live.current,
      geo: st.geo,
      camera: st.geoCamera,
      scrollDelta: 0,
      helix: null,
      clock: null,
      realElapsedMs: 0,
      rebuilt: 1,
      listProgress: 0,
    });
  }

  const updateSteps: UpdateSteps<Frame> = {
    scroll(f) {
      const scrollY = window.scrollY;
      f.scrollDelta = scrollY - st.lastScrollY;
      st.lastScrollY = scrollY;
      updatePointerLocal();
    },
    conveyor(f) {
      const { dt, now, props } = f;
      const previous = st.conveyor.offset;
      if (!posterMode) {
        // Slice 7: a released drag's throw decays into the target, which the
        // one smoothing stage and the speed cap then carry, as for the wheel.
        if (st.coast) st.conveyor.target += (st.coast.rest - st.conveyor.target) * (1 - Math.exp(-dt / COAST_TAU_S));
        // ---- fx-input: the conveyor's feeds ----
        // A held book row stills the idle drift and the page-scroll feed (and
        // eases them back after it lets go); page scroll turns the coil only
        // during page gestures, keyboard and scrollbar scrolling.
        const holdWeight = rowHoldWeight(st.rowHold, now);
        const pageFeed = props.interactive && feedsPageScroll(st.capture, now) ? f.scrollDelta * holdWeight : 0;
        stepConveyor(st.conveyor, {
          dt,
          nowMs: now,
          // The idle drift waits while a finger holds or throws the coil, so
          // the coast lands exactly on its card.
          idleWeight: st.dragging || st.coast ? 0 : holdWeight,
          pageScrollPx: pageFeed,
        });
        // ---- end fx-input ----
        stepEnvelope(st.envelope, st.conveyor.excessVelocity, dt);
        if (st.coast && Math.abs(st.coast.rest - st.conveyor.offset) < COAST_SETTLED_CARDS) st.coast = null;
      }
      if (debug) {
        push(debug.steps, st.conveyor.offset - previous);
        push(debug.envelope, st.envelope.value);
      }
    },
    helix(f) {
      const helix = restHelix(f.geo, st.theme.card.recede);
      f.helix = { ...helix, dy: stretchedDy(helix.dy, st.envelope) };
    },
    // ---- slice 4 wiring block: the entrance ----
    entrance(f) {
      const { now, props } = f;
      const realElapsedMs = posterMode ? Number.POSITIVE_INFINITY : entranceElapsedMs(now);
      const clock = entranceClock(forcedEntranceMs ?? realElapsedMs);
      f.realElapsedMs = realElapsedMs;
      f.clock = clock;
      if (!isRested(clock)) {
        // Idle, wheel and page scroll wait for the entrance: the strand holds
        // still at its start until the band has opened.
        st.conveyor.offset = 0;
        st.conveyor.target = 0;
        st.conveyor.velocity = 0;
        st.conveyor.excessVelocity = 0;
        st.conveyor.glide = null;
        st.coast = null; // slice 7
      }
      f.helix = entranceHelix(f.helix as HelixFrame, f.geo, clock);
      heroName.entranceFade(f);
      const entrance = props.entrance;
      if (entrance && !entranceEnded && realElapsedMs >= clock.durationS * 1000) {
        entranceEnded = true;
        props.onEntranceEnd?.();
      }
    },
    // ---- end slice 4 block ----
    // Slice 7: the rebuild fade (1 when none is running).
    rebuild(f) {
      if (st.rebuildAt === null) return;
      const rebuilt = siteEase(clamp01((f.now - st.rebuildAt) / REBUILD_FADE_MS));
      f.rebuilt = rebuilt;
      if (rebuilt >= 1) st.rebuildAt = null;
      heroName.fade(rebuilt);
    },
    // ---- slice 5 wiring block: the unwind ----
    // While latched the conveyor holds still, so every latched copy keeps its
    // slot and the wind-back lands on the exact pose it left.
    unwind(f) {
      const { now } = f;
      if (settleUnwind(st.unwind, now)) st.unwind.column = null;
      if (st.unwind.latched) {
        st.conveyor.offset = st.unwind.offset;
        st.conveyor.target = st.unwind.offset;
        st.conveyor.glide = null;
        st.unwind.column = measureColumn(f.helix as HelixFrame);
      }
      f.listProgress = unwindProgress(st.unwind, now);
      unwindFrame(f.listProgress);
    },
    // ---- end slice 5 block ----
    name(f) {
      heroName.stepNameFill(f.dt, f.listProgress); // fx-hero: the fill's idle clock and the repel
    },
    seen: cards.seen,
    slots: cards.poseSlots,
    silhouette: (f) => cards.hull(f, heroName),
    // Hover: picked every frame, since cards move under a still pointer.
    picking: hover.picking,
    // ---- fx-input: the nudge ----
    // Only while a coil gesture has been held 2.6s; gone the instant the
    // gesture ends or passes to the page. A caret by the cursor points off
    // the helix.
    nudge(f) {
      const overlay = f.props.overlay.current;
      if (st.sil && st.pointer.known && nudgeShown(st.capture, f.now)) {
        const px = st.pointer.x - st.sil.ax;
        const py = st.pointer.y - st.sil.ay;
        const along = px * st.sil.dx + py * st.sil.dy;
        let nx = px - along * st.sil.dx;
        let ny = py - along * st.sil.dy;
        const length = Math.hypot(nx, ny);
        if (length < 1) {
          nx = -st.sil.dy;
          ny = st.sil.dx;
        } else {
          nx /= length;
          ny /= length;
        }
        overlay?.nudge({ x: st.pointer.x, y: st.pointer.y, angle: Math.atan2(ny, nx) });
      } else {
        overlay?.nudge(null);
      }
    },
    // ---- end fx-input ----
    repaint: cards.repaint,
  };

  function render(dt: number) {
    runRender(renderSteps, { dt });
  }

  const renderSteps: RenderSteps<{ dt: number }> = {
    field: field.field,
    composite: field.composite,
    cards: cards.draw,
  };

  function shouldRun() {
    return (
      st.ready &&
      !st.disposed &&
      !st.contextLost &&
      st.visible &&
      !document.hidden &&
      // fx-flight freeze: a landed flight resumes the scene itself, ahead of
      // the props that still name it.
      (!live.current.frozen || st.landedAhead) &&
      !st.frozenByApi
    );
  }

  function frame(now: number) {
    st.raf = 0;
    if (!shouldRun()) {
      setSceneHover(false);
      return;
    }
    st.raf = requestAnimationFrame(frame);
    const interval = now - st.lastTime;
    // ---- fx-flight freeze: the first frame after a freeze steps one frame at most ----
    const step = Math.min(Math.max(interval, 0) / 1000, COIL.lab.maxFrameSeconds);
    const dt = st.resuming ? resumeStep(step) : step;
    st.resuming = false;
    flightFrame();
    // ---- end fx-flight freeze ----
    st.lastTime = now;
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
    if (!st.firstFrameSent) {
      st.firstFrameSent = true;
      live.current.onFirstFrame();
    }
  }

  function stop() {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
  }

  function wake() {
    if (st.raf || !shouldRun()) return;
    // ---- fx-flight freeze: a stopped scene holds its clocks ----
    holdClocks(performance.now() - st.lastTime);
    // ---- end fx-flight freeze ----
    st.lastTime = performance.now();
    // A return from off screen or a hidden tab must not read as one huge scroll.
    st.lastScrollY = window.scrollY;
    st.raf = requestAnimationFrame(frame);
  }

  // One frame outside the loop (a resize while frozen or off screen), so
  // the canvas never shows a stretched stale buffer.
  function renderStill() {
    if (!st.ready || st.contextLost || st.disposed) return;
    // fx-flight freeze: a still frame of a stopped scene is drawn at the moment it stopped.
    update(0, st.raf ? performance.now() : st.lastTime);
    render(0);
    // ---- fx-flight: a card in flight follows the new layout in the same frame ----
    flightStill();
    flightLog?.mark("scene-still", probeState());
    // ---- end fx-flight ----
  }

  // ---- observers and listeners
  const unobserveResize = observeResize(ctx, layout, loop);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      st.visible = entries[entries.length - 1]?.isIntersecting ?? true;
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
  const unlistenFx = heroName.listenFx(field.setDrift); // fx-hero
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointerup", onPointerUp);
  host.addEventListener("pointercancel", onPointerCancel);

  const unwatchContext = watchContext(ctx, loop);

  const stopWatchingTheme = watchTheme((next) => {
    st.theme = next;
    applyTheme();
    cards.repaintAll();
    wake();
  });

  // ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
  let probeSlot = -1; // the slot the harness follows
  function probePoseInfo(pose: CardPose) {
    if (!st.geoCamera) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    const camera = st.geoCamera;
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
    const pose = st.rendered[j];
    const drawn = pose ? probePoseInfo(pose) : null;
    if (!slot || !pose || !drawn) return null;
    const tile = tiles[slot.tile];
    return {
      ...drawn,
      slot: j,
      key: tile?.key,
      kind: tile?.kind,
      hover: slot.hover,
      hovered: st.hoveredSlot === j,
      hidden: st.hiddenSlot === j,
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
    const pose = probeSlot >= 0 ? st.rendered[probeSlot] : null;
    return {
      offset: st.conveyor.offset,
      target: st.conveyor.target,
      glide: st.conveyor.glide !== null,
      envelope: st.envelope.value,
      hoveredSlot: st.hoveredSlot,
      hiddenSlot: st.hiddenSlot,
      frozenByApi: st.frozenByApi,
      frozenByProps: live.current.frozen,
      looping: st.raf !== 0,
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
        Array.from({ length: st.geo?.slotCount ?? 0 }, (_, j) => probeSlotInfo(j)).filter(
          (info) => info !== null && info.alpha > 0.5,
        ),
      // Shows or hides a slot's mesh and redraws, with no other side effect.
      hide: ((j: number | null) => {
        st.hiddenSlot = j;
        if (!st.raf) {
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
      st.frozenByApi = on;
      if (on) stop();
      else wake();
    },
    cardAt: hover.cardAt,
    quadOf: cards.quadOf,
    hideSlot(slot) {
      flightLog?.mark(slot === null ? "mesh-show" : "mesh-hide", { slot }); // fx-flight debug
      st.hiddenSlot = slot;
      if (!st.raf) renderStill();
    },
    // ---- slice 4: the loader's continuity exit ----
    nameRect: heroName.nameRect,
    landName: heroName.landName,
    // ---- end slice 4 ----
  };
  if (live.current.api) live.current.api.current = api;
  if (debug) debug.api = api;
  // Slice 4: the entrance clock and the name, for QA behind ?coildebug.
  if (debug) {
    debug.entrance = () => ({
      base: entranceBase,
      elapsedMs: entranceBase === null ? null : performance.now() - entranceBase,
      ended: entranceEnded,
      nameLanded: heroName.landed(),
      nameA: compMaterial.uniforms.uNameA.value,
      offset: st.conveyor.offset,
    });
  }

  // ---- slice 5: the book, the unwind egg and the flight ----
  // Hover-jump from a book row, the double-click unwind into a column beside
  // the overlay's rows (the name moves to the list's lead), and the flight
  // source for a card click. The frame work runs in update()'s slice 5 block.
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
      flightQuadOf: cards.flightQuadOf,
      facesOf: cards.facesOf,
      slotOfKey: cards.slotOfKey,
      focusCard: hover.focusCard,
      unwind(on) {
        const next = on ?? !st.unwind.on;
        if (next === st.unwind.on) return;
        if (next && !canUnwind()) return;
        toggleUnwind(st.unwind, performance.now(), st.conveyor.offset, tileCount, next);
        if (debug) debug.unwindAt?.push(performance.now());
        wake();
      },
    };
  }

  function canUnwind() {
    const props = live.current;
    return st.ready && props.interactive && props.input === "fine" && !props.frozen && !st.frozenByApi && window.scrollY <= 2;
  }

  // Double-click open hero space (not a card, not a control) with the page at
  // the top: the helix unwinds in place; again, it winds back.
  const onDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || !host.contains(event.target)) return;
    const x = event.clientX - (st.view.docLeft - window.scrollX);
    const y = event.clientY - (st.view.docTop - window.scrollY);
    if (hover.pickAt(x, y) >= 0) return;
    if (!st.unwind.on && !canUnwind()) return;
    api.unwind(!st.unwind.on);
  };
  host.addEventListener("dblclick", onDoubleClick);
  const slice5Dispose = () => host.removeEventListener("dblclick", onDoubleClick);
  if (debug) {
    Object.assign(debug, {
      unwindAt: [] as number[],
      unwindState: () => ({ on: st.unwind.on, latched: st.unwind.latched !== null, progress: unwindProgress(st.unwind, performance.now()) }),
      unwindMs: () => unwindDurationMs(tileCount),
      focusKey: hover.focusKey,
    });
  }

  // The rows' card boxes, measured from the overlay each latched frame (it
  // moves with the page and relayouts on resize), onto the z = 0 plane.
  function measureColumn(helix: HelixFrame) {
    if (!st.geoCamera) return null;
    const boxes = live.current.overlay.current?.listTargets();
    if (!boxes) return null;
    const rect = host.getBoundingClientRect();
    const camera = st.geoCamera;
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
    live.current.overlay.current?.unwindFrame(progress, st.unwind.on);
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
      cu.uLod.value = maskHeight ? Math.max(0, Math.log2(maskHeight / (rect.w * st.view.dpr))) : nameRestLod;
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
    probe.font = `900 100px ${st.nameFamily}`;
    const w100 = probe.measureText(name).width || 1;
    const restSize = ((st.view.width * (isNarrow(st.view) ? 0.9 : 0.7)) / w100) * 100;
    const pad = Math.ceil(restSize * 0.04);
    const k = slot.fontPx / restSize;
    probe.font = `900 ${slot.fontPx}px ${st.nameFamily}`;
    const m = probe.measureText(name);
    const hostRect = host.getBoundingClientRect();
    const left = slot.rect.left - hostRect.left - m.actualBoundingBoxLeft;
    const baseline =
      slot.rect.top - hostRect.top + (slot.fontPx - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const inkTop = baseline - m.actualBoundingBoxAscent;
    // fx-hero: the mask carries the greeting's band above the name's pad.
    return new Vector4(left - pad * k, inkTop - (pad + heroName.greetBlock()) * k, nameRest.z * k, nameRest.w * k);
  }
  // ---- end slice 5 ----

  // ---- fx-flight freeze ----
  // A stopped scene holds its clocks: whatever runs from a start time (the
  // hover-jump's glide, the unwind, the rebuild fade) carries on from where
  // the stop caught it, and the first frame steps one frame at most.
  function holdClocks(stoppedMs: number) {
    st.resuming = true;
    if (!st.ready || !(stoppedMs > 0)) return;
    st.conveyor.glide = afterPause(st.conveyor.glide, stoppedMs);
    if (st.unwind.latched) st.unwind.startMs += stoppedMs;
    if (st.rebuildAt !== null) st.rebuildAt += stoppedMs;
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
    if (!st.geoCamera) return;
    const rect = host.getBoundingClientRect();
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    const sx = buffer.x / st.view.width;
    const sy = buffer.y / st.view.height;
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
    const fitted = [left, top, width, height, buffer.x, buffer.y, st.view.width, st.view.height, st.lastFieldTime].join(",");
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

  const placeFlown = cards.placeMesh;

  // The cards nearer than the flown one, drawn to depth only at the poses the
  // scene last rendered: they cover the flown card as they covered the mesh.
  function placeCovers(o: Overlay, slot: number, on: boolean, mapF: Texture) {
    let used = 0;
    if (on && st.geo) {
      for (let j = 0; j < st.geo.slotCount; j++) {
        const pose = st.rendered[j];
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
    const pose = st.rendered[f.slot];
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
  function still() {
    update(0, st.lastTime);
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
        st.hiddenSlot = f.slot;
        still();
      } else if (action === "show-mesh") {
        flightLog?.mark("mesh-show", { slot: f.slot, gap: f.gap });
        st.hiddenSlot = null;
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
    return [st.view.width, st.view.height, st.view.dpr, rect.left, rect.top].join(",");
  }

  // The flown card at its progress, between the seat as the scene would draw
  // it now and the slot as last given. Returns the flat card's corners.
  function flightDraw(f: Flight, o: Overlay): Quad | null {
    if (!st.geoCamera || f.state === "landed" || f.state === "rest") return null;
    const seat = seatOf(f);
    if (!seat) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    if (f.rect) f.lastSlot = slotPose(st.geoCamera, f.rect, origin);
    const pose = flightPoseAt(seat, f.lastSlot ?? seat, f.e);
    f.pose = pose;
    f.gap = poseGap(pose, seat);
    drawFlown(o, f.slot, pose);
    return projectQuad({ ...pose, bend: 0 }, st.geoCamera, origin);
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
        const pose = st.rendered[slot];
        if (!st.ready || st.contextLost || st.disposed || !st.geoCamera || !pose || !slots[slot] || pose.alpha <= 0.01) return null;
        const o = liveOverlay();
        if (!o) return null;
        if (flight) act(flight, "abort");
        st.frozenByApi = true;
        st.landedAhead = false;
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
          st.frozenByApi = false;
          st.landedAhead = event === "land";
          wake();
          // No frame to come (a modal is open, the hero is off screen): done.
          if (!st.raf) {
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
              lifted.hover += (hover.liftTarget(f.slot, f.alpha) - lifted.hover) * (1 - Math.exp(-Math.min(dt, COIL.lab.maxFrameSeconds) * HOVER_RATE));
              update(0, st.lastTime);
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
      if (st.disposed || st.contextLost || overlay || live.current.input !== "fine") return;
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
    return st.ready && props.interactive && props.input === "coarse" && !props.frozen && !st.frozenByApi && !st.unwind.on;
  }
  // Cards per px of horizontal finger travel: the front card's arc per card,
  // across the screen.
  function dragCardsPerPx() {
    if (!st.geo) return 0;
    return 1 / Math.max(1, st.geo.step * st.geo.cardPx * Math.cos(st.geo.axisRad));
  }
  const dragObserver = Observer.create({
    target: host,
    type: "touch",
    lockAxis: true,
    dragMinimum: DRAG_MINIMUM_PX,
    onPress: () => {
      pressScrollY = window.scrollY;
      st.pressCaughtCoil = st.coast !== null;
      if (st.coast) {
        st.conveyor.target = st.conveyor.offset;
        st.coast = null;
      }
    },
    onDrag: (self) => {
      // The page moved: the browser took this gesture as a vertical pan.
      if (self.axis !== "x" || Math.abs(window.scrollY - pressScrollY) > 2 || !canDrag()) return;
      st.dragging = true;
      st.conveyor.glide = null;
      st.conveyor.target += self.deltaX * dragCardsPerPx();
      wake();
    },
    onRelease: (self) => {
      if (!st.dragging) return;
      st.dragging = false;
      if (!canDrag()) return;
      const cap = COIL.spinCapCardsPerSecond;
      const velocity = Math.min(cap, Math.max(-cap, self.velocityX * dragCardsPerPx()));
      st.coast = { rest: Math.round(st.conveyor.target + velocity * COAST_TAU_S) };
      wake();
    },
  });
  if (debug) {
    debug.drag = () => ({
      dragging: st.dragging,
      coast: st.coast?.rest ?? null,
      offset: st.conveyor.offset,
      target: st.conveyor.target,
      velocity: st.conveyor.velocity,
      cardsPerPx: dragCardsPerPx(),
    });
  }
  // ---- end slice 7 ----

  // ---- boot: the name's face and every card's sources, then the first frame
  const style = getComputedStyle(document.documentElement);
  st.nameFamily = style.getPropertyValue("--font-display").trim() || "sans-serif";
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
      document.fonts.load(`900 100px ${st.nameFamily}`).then(() => undefined),
      undefined,
    ),
    Promise.all(
      tiles.map((tile) =>
        withTimeout<CardSource>(
          loadCardSource(tile, logoFor, st.budget.textureSize),
          tile.kind === "photo" ? { kind: "photo", key: tile.key, image: null } : { kind: "work", key: tile.key, logo: null },
        ).then(countTexture), // slice 4: the loader's tally
      ),
    ),
  ])
    .then(([, loaded]) => {
      if (st.disposed) return;
      cards.setSources(loaded);
      applyTheme();
      tiles.forEach((_, i) => cards.paintTile(i));
      st.ready = true;
      const box = st.pendingSize ?? host.getBoundingClientRect();
      layout(box.width, box.height);
      wake();
      warmOverlay(); // fx-flight
    })
    .catch((error) => {
      if (!st.disposed) live.current.onError(error);
    });

  // Slice 7: an input change (a tablet gaining a trackpad, emulation) moves
  // the budget: re-lay out at the new DPR cap and repaint every card at the
  // new texture size, a few per frame as a theme change does.
  function sync() {
    // fx-flight freeze: the props have caught up with the landing (or name a new modal).
    st.landedAhead = false;
    const next = budgetFor(live.current.input);
    if (!sameBudget(next, st.budget)) {
      st.budget = next;
      if (st.ready && !st.contextLost && !st.disposed) {
        layout(st.view.width, st.view.height);
        cards.repaintAll();
        if (!st.raf) renderStill();
      }
    }
    wake();
  }

  return {
    wake,
    sync,
    dispose() {
      st.disposed = true;
      stop();
      unobserveResize();
      intersectionObserver.disconnect();
      stopWatchingTheme();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      host.removeEventListener("wheel", onWheel);
      window.removeEventListener("wheel", onWindowWheel); // fx-input
      unlistenFx(); // fx-hero
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      unwatchContext();
      slice5Dispose();
      flownDispose(); // fx-flight
      dragObserver.kill(); // slice 7
      setSceneHover(false);
      live.current.overlay.current?.nudge(null);
      if (live.current.api && live.current.api.current === api) live.current.api.current = null;
      cards.dispose();
      quad.dispose();
      field.dispose();
      heroName.dispose();
      fieldTarget.dispose();
      renderer.dispose();
      removeDebugStats(debug);
    },
  };
}
