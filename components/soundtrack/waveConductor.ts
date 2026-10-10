import { getSoundtrackPlayer } from "@/lib/audio";
import { getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";
import { createLeveller, levelColumns } from "@/lib/waveform/level";
import { BREATH, PLUCK, SHIMMER, SPECTRUM_BINS, TRAIN_FADE } from "@/lib/wavepath/constants";
import { createHead, stepHead, tailStart, type HeadState } from "@/lib/wavepath/head";
import { createMusic, stepMusic } from "@/lib/wavepath/music";
import type { DotFrame } from "@/lib/wavepath/paint";
import { createNear, createPlucks, createPointer, movePointer, notePointer, stepPlucks, type Near, type PointerTrack } from "@/lib/wavepath/pluck";
import { attachProbe, pathProbe } from "@/lib/wavepath/probe";

// The wave's one engine (the engine split): once per frame it steps the
// clocks, the levelled music, the head and the plucks into one frame, and
// views (the band's run, the path's tiles) only paint it. The loop runs while
// the head moves, or while a view shows and the music, the run's breath or a
// ripple moves; it caps at 60fps and sleeps at rest. Before the visitor
// answers the band, the line is static: no breath, no pluck, so the loop
// sleeps. After either answer it breathes and follows; peaks and the music
// need "Play it". Freezing stops the clocks, the music and the plucks; the
// head still follows the scroll. Reduced motion (`still`) never loops: views
// paint the whole line on layout, theme and probe calls. One conductor per
// page, ref counted.

const FRAME_MS = 1000 / 60 - 2;
const MAX_STEP_S = 0.1;

export interface WaveFrame extends DotFrame {
  scrollY: number;
  decided: boolean; // lib/soundtrack.ts: anything but "before"
  length: number;
  runFlat: number;
  state: HeadState; // views write target and gateTarget in prepare()
  pointer: PointerTrack; // client px
  near: Near; // views offer their nearest drawn column in prepare()
}
export type Changed = { head: boolean; music: boolean; breath: boolean; plucks: boolean };
export interface WaveView {
  breathes: boolean;
  prepare(f: WaveFrame): void;
  paint(f: WaveFrame, changed: Changed | null): void; // null: paint what shows, now
  active(): boolean;
  countVisible(f: WaveFrame): number;
}
export interface PathGeometry { runLen: number; length: number; train: number | null; runFlat: number }
export interface WaveConductor {
  frame: WaveFrame;
  attach(view: WaveView): void;
  detach(view: WaveView): void;
  setPath(geometry: PathGeometry, snap: boolean): void;
  setFrozen(frozen: boolean): void;
  wake(): void;
  release(): void;
}

type Instance = { conductor: WaveConductor; still: boolean; refs: number; destroy: () => void };
let live: Instance | null = null;

export function acquireWaveConductor(still: boolean): WaveConductor {
  if (live && live.still !== still) {
    live.destroy();
    live = null;
  }
  if (!live) live = createInstance(still);
  live.refs++;
  return live.conductor;
}

function createInstance(still: boolean): Instance {
  const player = getSoundtrackPlayer();
  const leveller = createLeveller(SPECTRUM_BINS);
  const levelled = new Float32Array(SPECTRUM_BINS);
  const views: WaveView[] = [];
  const probe = pathProbe();
  let frozen = false, destroyed = false, snap = false, raf = 0, last = 0, breathClock = 0;
  const frame: WaveFrame = {
    head: 0, tail: -Infinity, train: null, runLen: 0, gate: 0, breath: 0, shimmer: 0,
    music: createMusic(), plucks: createPlucks(), still, scrollY: window.scrollY,
    decided: getSoundtrackState() !== "before", length: 0, runFlat: 0,
    state: createHead(), pointer: createPointer(), near: createNear(),
  };

  const sync = () => {
    frame.head = frame.state.head;
    frame.gate = frame.state.gate;
    frame.tail = frame.train === null ? -Infinity : tailStart(frame.head, frame.train, frame.train * TRAIN_FADE, frame.runLen);
  };

  // Reduced motion and the probe: the head lands on its target, every view paints.
  const paintAll = () => {
    for (const v of views) v.prepare(frame);
    stepHead(frame.state, 0, true);
    sync();
    for (const v of views) v.paint(frame, null);
  };

  const step = (t: number, dt: number): boolean => {
    for (const v of views) v.prepare(frame);
    if (snap) {
      frame.state.head = frame.state.target;
      snap = false;
    }
    const before = frame.state.head;
    const moving = stepHead(frame.state, dt, false);
    let music = false, breath = false, plucks = false;
    if (!frozen) {
      if (frame.pointer.moved) {
        if (frame.decided) {
          const near = frame.near;
          notePointer(frame.plucks, near.d2 < PLUCK.radius ** 2 ? near.j : -1, near.side, near.s, frame.pointer.speed);
        }
      } else frame.pointer.speed *= Math.exp(-dt / 0.07);
      frame.shimmer += dt * SHIMMER.rate;
      // Static until the visitor answers; the clock starts at 0 then, so the breath eases in from 0.
      if (frame.decided) {
        breathClock += dt;
        frame.breath = Math.sin(breathClock * BREATH.rate);
      }
      levelColumns(leveller, player.sample(t, SPECTRUM_BINS).means, dt, levelled);
      music = stepMusic(frame.music, dt, getSoundtrackState() === "on", levelled);
      plucks = stepPlucks(frame.plucks, dt);
      breath = frame.decided && views.some((v) => v.breathes && v.active());
    }
    frame.pointer.moved = false;
    frame.near.d2 = Infinity;
    sync();
    const changed = { head: moving || frame.state.head !== before, music, breath, plucks };
    for (const v of views) if (v.active()) v.paint(frame, changed);
    if (probe) probe.ticks++;
    return moving || (views.some((v) => v.active()) && (music || breath || plucks));
  };

  const tick = (t: number) => {
    raf = 0;
    if (destroyed || document.hidden) return;
    if (last && t - last < FRAME_MS) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    if (step(t, dt)) raf = requestAnimationFrame(tick);
    else last = 0;
  };

  const wake = () => {
    if (destroyed) return;
    if (still) return paintAll();
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  };

  const onScroll = () => {
    frame.scrollY = window.scrollY;
    if (!still) wake();
  };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    movePointer(frame.pointer, event.clientX, event.clientY, event.timeStamp);
    wake();
  };
  const onLeave = () => {
    frame.pointer.on = false;
    frame.plucks.nearJ = -1;
  };
  const onSoundtrack = () => {
    frame.decided = getSoundtrackState() !== "before";
    wake();
  };

  const conductor: WaveConductor = {
    frame,
    attach(view) {
      if (!views.includes(view)) views.push(view);
      wake();
    },
    detach(view) {
      const i = views.indexOf(view);
      if (i >= 0) views.splice(i, 1);
    },
    setPath(geometry, first) {
      frame.runLen = geometry.runLen;
      frame.length = geometry.length;
      frame.runFlat = geometry.runFlat;
      frame.train = still ? null : geometry.train;
      if (first) snap = true;
      wake();
    },
    setFrozen(next) {
      frozen = next;
      wake();
    },
    wake,
    release() {
      if (destroyed) return;
      instance.refs--;
      if (instance.refs <= 0) destroy();
    },
  };

  const fine = !still && window.matchMedia("(pointer: fine)").matches;
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", wake);
  if (fine) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  const unsubscribe = subscribeSoundtrack(onSoundtrack);
  const detachProbe = attachProbe({
    frame: () => ({ head: frame.head, target: frame.state.target, length: frame.length, runLen: frame.runLen, train: frame.train, decided: frame.decided, runFlat: frame.runFlat }),
    visibleDots: () => views.reduce((n, v) => n + v.countVisible(frame), 0),
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("pointermove", onPointer);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    unsubscribe();
    detachProbe();
    views.length = 0;
    if (live === instance) live = null;
  };
  const instance: Instance = { conductor, still, refs: 0, destroy };
  return instance;
}
