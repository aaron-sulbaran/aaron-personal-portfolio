import { COIL } from "@/lib/coil/constants";
import { afterPause, resumeStep } from "@/lib/coil/flight";
import { runRender, runUpdate, type RenderSteps, type UpdateSteps } from "@/lib/coil/frame";
import { setSceneHover } from "@/lib/cursor/hover";
import { pushStat, throwFrameAt as throwFrameAtFromTokens } from "./debug";
import type { SceneCtx, SceneFrame } from "./state";

// The loop: one requestAnimationFrame chain that runs the frame's steps in
// the order lib/coil/frame.ts fixes, and only when it needs to. It never
// runs while the scene is not ready, disposed, lost, off screen, in a hidden
// tab, or frozen (a modal, or the flight's freeze); anything that may need a
// frame calls wake(). A stopped scene holds its clocks, and the first frame
// after a stop steps one frame at most. Still frames (a resize while frozen)
// run the same steps once with no time passing. Reduced motion never mounts
// the scene at all (CoilStage).

export type RenderFrame = { dt: number };

export type LoopHooks = {
  // The frame after a flight landed is the scene's first live one.
  flightFrame: () => void;
  // A card in flight follows a still frame's new layout.
  flightStill: () => void;
  // What the flight probe's marks carry.
  probeState: () => object;
};

export function createLoop(
  ctx: SceneCtx,
  updateSteps: UpdateSteps<SceneFrame>,
  renderSteps: RenderSteps<RenderFrame>,
  hooks: LoopHooks,
) {
  const { st, host, live, debug, flightLog } = ctx;
  const { conveyor, unwind } = st;
  // Slice 7, QA only: ?coildebug=throw=frame throws from the loop a second in.
  const throwFrameAt = throwFrameAtFromTokens();

  function update(dt: number, now: number) {
    if (!st.geo || !st.geoCamera) return;
    if (now > throwFrameAt) throw new Error("coildebug: scene frame");
    runUpdate(updateSteps, {
      dt,
      now,
      props: live.current,
      geo: st.geo,
      camera: st.geoCamera,
      helix: null,
      clock: null,
      realElapsedMs: 0,
      rebuilt: 1,
      shapePull: 1,
      listProgress: 0,
    });
  }

  function render(dt: number) {
    runRender(renderSteps, { dt });
  }

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
    hooks.flightFrame();
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
      pushStat(debug.intervals, interval);
      pushStat(debug.work, performance.now() - started);
    }
    // ---- fx-flight debug ----
    flightLog?.mark("scene-frame", { dt, interval, ...hooks.probeState() });
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

  // ---- fx-flight freeze ----
  // A stopped scene holds its clocks: whatever runs from a start time (the
  // hover-jump's glide, the unwind, the rebuild fade) carries on from where
  // the stop caught it, and the first frame steps one frame at most.
  function holdClocks(stoppedMs: number) {
    st.resuming = true;
    if (!st.ready || !(stoppedMs > 0)) return;
    conveyor.glide = afterPause(conveyor.glide, stoppedMs);
    if (unwind.latched) unwind.startMs += stoppedMs;
    if (st.rebuildAt !== null) st.rebuildAt += stoppedMs;
  }
  // ---- end fx-flight freeze ----

  function wake() {
    if (st.raf || !shouldRun()) return;
    // ---- fx-flight freeze: a stopped scene holds its clocks ----
    holdClocks(performance.now() - st.lastTime);
    // ---- end fx-flight freeze ----
    st.lastTime = performance.now();
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
    hooks.flightStill();
    flightLog?.mark("scene-still", hooks.probeState());
    // ---- end fx-flight ----
  }

  // The hero on screen (IntersectionObserver) and the tab visible: both wake the loop.
  function observeVisibility() {
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
    return {
      disconnect: () => intersectionObserver.disconnect(),
      unlisten: () => document.removeEventListener("visibilitychange", onVisibility),
    };
  }

  return { update, render, shouldRun, stop, wake, renderStill, observeVisibility };
}

export type Loop = ReturnType<typeof createLoop>;
