"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Vector2 } from "three";
import { siteContent, strandTiles } from "@/lib/content";
import { projectQuad, type Camera } from "@/lib/coil/geometry";
import { budgetFor, sameBudget } from "@/lib/coil/drivers";
import { loadCardSource, type CardSource } from "@/lib/coil/textures";
import { readCoilTheme, watchTheme } from "@/lib/coil/theme";
import { createDebugStats, debugTokens, readDebugFlags, removeDebugStats } from "./scene/debug";
import { createCards } from "./scene/cards";
import { createEntrance } from "./scene/entrance";
import { createProbe } from "./scene/debugProbe";
import { createField } from "./scene/field";
import { createLoop } from "./scene/loop";
import { createFlight } from "./scene/flight";
import { createFlightOverlay } from "./scene/flightOverlay";
import { createUnwindWiring } from "./scene/unwind";
import { createInput } from "./scene/input";
import { createHover } from "./scene/hover";
import { createName, createNameFill } from "./scene/name";
import { createLayout, createPasses, createRenderer, observeResize, watchContext } from "./scene/renderer";
import { createSceneState, type LoopLink, type SceneCtx } from "./scene/state";
// ---- fx-input imports: wheel ownership and the row hold ----
import { gestureOwner } from "@/lib/coil/capture";
// ---- end fx-input imports ----
import { setSceneHover } from "@/lib/cursor/hover";
// Slice 4: the loader's tally and the name handoff.
import { reportHomeLoad } from "@/lib/loader/progress";
// ---- slice 5 imports: the book, the unwind egg and the flight ----
// ---- end slice 5 imports ----
// ---- fx-hero imports: the greeting in the name, the name's fill and repel, the drift presets ----
// (DataTexture, RGBAFormat and UnsignedByteType come in with the fx-flight imports.)
import { NAME_FILLS } from "@/lib/coil/field.glsl";
// ---- end fx-hero imports ----
// ---- fx-flight imports ----
import { flightProbe } from "@/lib/coil/flightProbe";
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

import type { CoilFlightApi, CoilRuntime, CoilSceneApi, CoilSceneProps } from "./scene/types";

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

const TEXTURE_TIMEOUT_MS = 6000; // the loader's give-up time: a slow photo paints the plain pane

function startCoil(host: HTMLElement, canvas: HTMLCanvasElement, live: RefObject<CoilSceneProps>): CoilRuntime {
  const flags = readDebugFlags();

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
    wake: () => core.wake(),
    stop: () => core.stop(),
    renderStill: () => core.renderStill(),
    shouldRun: () => core.shouldRun(),
    update: (dt, now) => core.update(dt, now),
    render: (dt) => core.render(dt),
  };

  // ---- passes
  const gl = createPasses(renderer);
  const { fieldTarget, quad } = gl;

  // ---- fx-hero: the name's fill and repel buffer, made before the composite that holds them ----
  const nameFx = createNameFill(flags.nameParam);
  const field = createField(ctx, gl, { mode: NAME_FILLS.indexOf(nameFx.fill), repel: nameFx.repelTexture });
  const { compMaterial } = field;
  const heroName = createName(ctx, compMaterial, nameFx, loop);

  // ---- cards
  const cards = createCards(ctx, gl);

  function applyTheme() {
    field.applyTheme();
    cards.applyTheme();
    st.lastFieldTime = Number.NaN;
  }

  // ---- the entrance (slice 4) and the rebuild fade (slice 7)
  const entrance = createEntrance(ctx, heroName);

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

  const input = createInput(ctx, cards, hover, loop);
  const probe = createProbe(ctx, cards, loop);
  // ---- fx-flight: the flown card's canvas and the handoff ----
  const flyer = createFlight(ctx, cards, hover, createFlightOverlay(ctx, gl, cards), probe, loop);
  const unwinder = createUnwindWiring(ctx, compMaterial, heroName, hover, loop);

  // ---- the frame: which part runs each step (lib/coil/frame.ts fixes the order)
  const core = createLoop(
    ctx,
    {
      scroll: input.scroll,
      conveyor: input.conveyor,
      helix: cards.helix,
      entrance: entrance.entrance,
      rebuild: entrance.rebuild,
      unwind: unwinder.step,
      name: heroName.step,
      seen: cards.seen,
      slots: cards.poseSlots,
      silhouette: (f) => cards.hull(f, heroName),
      picking: hover.picking,
      nudge: input.nudge,
      repaint: cards.repaint,
    },
    { field: field.field, composite: field.composite, cards: cards.draw },
    { flightFrame: flyer.flightFrame, flightStill: flyer.flightStill, probeState: probe.state },
  );
  const { wake, stop, renderStill } = core;

  // ---- observers and listeners
  const unobserveResize = observeResize(ctx, layout, loop);

  const visibility = core.observeVisibility();
  const unlistenPointer = input.listenPointer();
  const unlistenFx = heroName.listenFx(field.setDrift); // fx-hero
  const unlistenTaps = input.listenTaps();

  const unwatchContext = watchContext(ctx, loop);

  const stopWatchingTheme = watchTheme((next) => {
    st.theme = next;
    applyTheme();
    cards.repaintAll();
    wake();
  });

  // ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
  probe.install();
  // ---- end fx-flight debug ----

  // ---- the api for slices 4 and 5
  const api: CoilSceneApi = {
    ...slice5Api(),
    beginFlight: flyer.beginFlight, // fx-flight
    freeze: flyer.freeze,
    cardAt: hover.cardAt,
    quadOf: cards.quadOf,
    hideSlot: flyer.hideSlot,
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
      ...entrance.clockState(),
      nameLanded: heroName.landed(),
      nameA: compMaterial.uniforms.uNameA.value,
      offset: st.conveyor.offset,
    });
  }

  // ---- slice 5: the book, the unwind egg and the flight ----
  // Hover-jump from a book row, the double-click unwind into a column beside
  // the overlay's rows (the name moves to the list's lead), and the flight
  // source for a card click. The frame work runs in update()'s slice 5 block.
  function slice5Api(): CoilFlightApi {
    return {
      flightQuadOf: cards.flightQuadOf,
      facesOf: cards.facesOf,
      slotOfKey: cards.slotOfKey,
      focusCard: hover.focusCard,
      unwind: unwinder.unwind,
    };
  }

  const slice5Dispose = unwinder.listen();
  if (debug) {
    Object.assign(debug, {
      unwindAt: [] as number[],
      unwindState: unwinder.unwindState,
      unwindMs: unwinder.unwindMs,
      focusKey: hover.focusKey,
    });
  }

  // ---- end slice 5 ----


  // ---- fx-flight: the flown card ----
  probe.installFlight(flyer.current); // fx-flight debug
  // ---- end fx-flight ----

  // ---- slice 7: the coarse pointer's drag-to-spin ----
  const unlistenDrag = input.listenDrag();
  if (debug) debug.drag = input.dragState;
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
      flyer.warm(); // fx-flight
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
      visibility.disconnect();
      stopWatchingTheme();
      visibility.unlisten();
      unlistenPointer();
      unlistenFx(); // fx-hero
      unlistenTaps();
      unwatchContext();
      slice5Dispose();
      flyer.dispose(); // fx-flight
      unlistenDrag(); // slice 7
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
