"use client";

import { useEffect, useRef, type RefObject } from "react";
import { strandTiles } from "@/lib/content";
import { budgetFor } from "@/lib/coil/drivers";
import { flightProbe } from "@/lib/coil/flightProbe";
import { readCoilTheme, watchTheme } from "@/lib/coil/theme";
import { setSceneHover } from "@/lib/cursor/hover";
import { createApi } from "./scene/api";
import { boot, resync } from "./scene/boot";
import { createCards } from "./scene/cards";
import { createDebugStats, debugReads, debugTokens, installSceneHooks, readDebugFlags, removeDebugStats } from "./scene/debug";
import { createProbe } from "./scene/debugProbe";
import { createEntrance } from "./scene/entrance";
import { createField } from "./scene/field";
import { createFlight } from "./scene/flight";
import { createFlightOverlay } from "./scene/flightOverlay";
import { createHover } from "./scene/hover";
import { createInput } from "./scene/input";
import { createLoop } from "./scene/loop";
import { createGlyphTargets, createName } from "./scene/name";
import { createNameProbe } from "./scene/nameProbe";
import { createNameSurface } from "./scene/nameSurface";
import { createLayout, createPasses, createRenderer, observeResize, watchContext } from "./scene/renderer";
import { createSceneState, type LoopLink, type SceneCtx } from "./scene/state";
import type { CoilRuntime, CoilSceneProps } from "./scene/types";
import { createUnwindWiring } from "./scene/unwind";

// The Coil scene: the dynamic chunk CoilStage imports after first paint. It
// owns the renderer, the two field passes, the helix of cards, the loop, the
// input and the picking; React only mounts it. Ported from hero lab 2 (518-531
// renderer, 1098-1316 update, 1362-1394 input, 1485-1514 frame). This file is
// the composition root: each concern is a module in ./scene (the map, and how
// to add a feature without growing this file: docs/coil-scene-modules.md).
//
// Frame order (lib/coil/frame.ts runs it; its test holds it): scroll delta,
// conveyor (idle, wheel, page scroll; one smoothing stage and the spin cap;
// the stretch envelope), helix frame, entrance, rebuild fade, unwind, name
// (the surface's clock and the wake), seen levels, slots (pose, entrance,
// unwind, header band, hover lift, seen ring), silhouette, picking, nudge,
// repaint; then field (only when its clock moved), the name's surface, the
// composite, cards.
//
// It renders only when needed: never while the tab is hidden, the hero is
// off screen, a modal holds the scene frozen, or the context is lost.

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

// The parts are created in the order the single closure they came from
// created them, so every three.js object keeps its id and every listener its
// registration order; each part takes the scene context (handles plus the
// shared state record) and the parts it calls.
function startCoil(host: HTMLElement, canvas: HTMLCanvasElement, live: RefObject<CoilSceneProps>): CoilRuntime {
  const flags = readDebugFlags();
  const renderer = createRenderer(canvas);
  const tiles = strandTiles;
  // The state more than one part of the scene reads (scene/state.ts).
  const st = createSceneState(readCoilTheme(), budgetFor(live.current.input));
  const debug = createDebugStats(flags, debugReads(st));
  // ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
  const flightLog = flightProbe();
  const ctx: SceneCtx = { host, canvas, live, tiles, tileCount: tiles.length, flags, debug, flightLog, st };
  // The loop's entry points for the parts made before it (none is called
  // before startCoil returns).
  const loop: LoopLink = {
    wake: () => core.wake(),
    stop: () => core.stop(),
    renderStill: () => core.renderStill(),
    shouldRun: () => core.shouldRun(),
    update: (dt, now) => core.update(dt, now),
    render: (dt) => core.render(dt),
  };

  // ---- the parts
  const gl = createPasses(renderer);
  // The name's surface and wake, made before the composite that reads them.
  const surface = createNameSurface(ctx, gl);
  const glyphTargets = createGlyphTargets();
  const field = createField(ctx, gl, { surface: surface.texture, wake: surface.wakeUniforms, glyph: glyphTargets[0].texture });
  const heroName = createName(ctx, gl, field.compMaterial, surface, glyphTargets, loop);
  const cards = createCards(ctx, gl);
  const entrance = createEntrance(ctx, heroName);
  const parts = { resizePasses: field.resizePasses, ensureSlots: cards.ensureSlots, layoutName: heroName.layoutName };
  const layout = createLayout(ctx, gl, parts, loop);
  const hover = createHover(ctx, cards, loop);
  const input = createInput(ctx, cards, hover, loop);
  const probe = createProbe(ctx, cards, loop);
  // fx-flight: the flown card's canvas and the handoff.
  const flyer = createFlight(ctx, cards, hover, createFlightOverlay(ctx, gl, cards), probe, loop);
  const unwinder = createUnwindWiring(ctx, field.compMaterial, heroName, hover, loop);
  const applyTheme = () => {
    field.applyTheme();
    surface.applyTheme();
    cards.applyTheme();
    st.lastFieldTime = Number.NaN;
  };

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
    { field: field.field, surface: heroName.renderSurface, composite: field.composite, cards: cards.draw },
    { flightFrame: flyer.flightFrame, flightStill: flyer.flightStill, probeState: probe.state },
  );

  // ---- observers and listeners, in their original order
  const unobserveResize = observeResize(ctx, layout, loop);
  const visibility = core.observeVisibility();
  const unlistenPointer = input.listenPointer();
  const unlistenTaps = input.listenTaps();
  const unwatchContext = watchContext(ctx, loop);
  const stopWatchingTheme = watchTheme((next) => {
    st.theme = next;
    applyTheme();
    cards.repaintAll();
    core.wake();
  });
  const unlistenDoubleClick = unwinder.listen(); // slice 5
  const unlistenDrag = input.listenDrag(); // slice 7

  // ---- the api for slices 4 and 5, and the QA hooks behind ?coildebug
  const api = createApi({ cards, hover, unwinder, flyer, name: heroName });
  if (live.current.api) live.current.api.current = api;
  probe.install();
  const nameProbe = createNameProbe(ctx, gl, field.compMaterial, heroName);
  installSceneHooks(ctx, { gl, cards, field, name: heroName, surface, probe: nameProbe, entrance, hover, input, unwinder, api });
  probe.installFlight(flyer.current);

  boot(ctx, cards, { applyTheme, layout, warm: flyer.warm }, loop);

  return {
    wake: core.wake,
    sync: () => resync(ctx, cards, layout, loop),
    dispose() {
      st.disposed = true;
      core.stop();
      unobserveResize();
      visibility.disconnect();
      stopWatchingTheme();
      visibility.unlisten();
      unlistenPointer();
      unlistenTaps();
      unwatchContext();
      unlistenDoubleClick();
      flyer.dispose(); // fx-flight
      unlistenDrag(); // slice 7
      setSceneHover(false);
      live.current.overlay.current?.nudge(null);
      if (live.current.api && live.current.api.current === api) live.current.api.current = null;
      cards.dispose();
      gl.quad.dispose();
      field.dispose();
      heroName.dispose();
      gl.fieldTarget.dispose();
      gl.surfaceTarget.dispose();
      renderer.dispose();
      removeDebugStats(debug);
    },
  };
}
