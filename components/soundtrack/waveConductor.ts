import { getSoundtrackPlayer } from "@/lib/audio";
import { getRestoredSoundtrack, getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";
import { createLeveller, levelColumns } from "@/lib/waveform/level";
import { pressOf, swells } from "@/lib/wavepath/answer";
import { BREATH, PLUCK, RELEASE_LINE, SHIMMER, SPECTRUM_BINS, TRAIN_FADE } from "@/lib/wavepath/constants";
import { createHead, stepHead, tailStart, type HeadState } from "@/lib/wavepath/head";
import { bandAway, checkRelease, createWaveHold, pressAnswer, wavefollows, type HoldResult } from "@/lib/wavepath/hold";
import { createMusic, stepMusic } from "@/lib/wavepath/music";
import type { DotFrame } from "@/lib/wavepath/paint";
import { createNear, createPlucks, createPointer, movePointer, notePointer, stepPlucks, type Near, type PointerTrack } from "@/lib/wavepath/pluck";
import { attachProbe, pathProbe } from "@/lib/wavepath/probe";
import { createRipple, rippleHeight, startRipple, stepRipple } from "@/lib/wavepath/ripple";

// The wave's one engine (the engine split): once per frame it steps the
// clocks, the levelled music, the head and the plucks into one frame, and
// views (the band's run, the path's tiles) only paint it. The loop runs while
// the head moves, or while a view shows and the music, the run's breath or a
// ripple moves; it caps at 60fps and sleeps at rest. The line is one line: the
// head follows the scroll only once the band's bottom edge is above the release
// line (RELEASE_LINE), in both directions, and until then only the band's own
// run is drawn, breathing, with the head waiting at its end. Pressing an answer
// while the band is still in view holds the wave there
// (lib/wavepath/hold): no following, no ripple, until the band has
// scrolled away; then the answer takes effect and its ripple goes out from the
// buttons (a live press only; a restored choice sends none). The hold keeps the line from following and the ripple back, never
// the music: "Play it" shapes the band's run at once, with no scroll (Aaron, 2026-11-06). A Not now is
// answered at once instead, in the band: a gentle swell (SWELL) rolls out from
// the buttons across the run, then the wave settles into its idle motion, and
// no ripple follows at the release. After either
// answer the whole line breathes and follows; peaks and the music need
// "Play it". While no music shapes the line (paused or declined) an idle
// ripple (lib/wavepath/idle) travels through it, so it is never dead flat.
// Freezing stops the clocks, the music, the plucks, the idle ripple and the
// ripple; the head still follows the scroll. Reduced motion (`still`) never
// loops: views paint the whole line on layout, theme and probe calls. One
// conductor per page, ref counted.

const FRAME_MS = 1000 / 60 - 2;
const MAX_STEP_S = 0.1;

export interface WaveFrame extends DotFrame {
  scrollY: number;
  dt: number; // seconds this frame steps
  decided: boolean; // the wave follows the reader: an answer whose hold has ended, or the band scrolled away unanswered (lib/wavepath/hold)
  gated: boolean; // the band is below the release line, so the head waits at the run's end
  idleGain: number; // the idle ripple's strength now: 1 with no music, fading out as the music shapes the line, 0 when still
  idleClock: number; // seconds the idle ripple has run
  length: number;
  runFlat: number;
  state: HeadState; // views write target and gateTarget in prepare()
  pointer: PointerTrack; // client px
  near: Near; // views offer their nearest drawn column in prepare()
}
export type Changed = { head: boolean; music: boolean; breath: boolean; plucks: boolean; ripple: boolean };
export interface WaveView {
  breathes: boolean;
  prepare(f: WaveFrame): void;
  paint(f: WaveFrame, changed: Changed | null): void; // null: paint what shows, now
  active(): boolean;
  countVisible(f: WaveFrame): number;
  rippleOrigin?(): number; // the arc s an answer's ripple starts at, measured at layout
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
  const hold = createWaveHold();
  let frozen = false, destroyed = false, snap = false, raf = 0, last = 0, breathClock = 0;
  const frame: WaveFrame = {
    head: 0, tail: -Infinity, train: null, runLen: 0, gate: 0, breath: 0, shimmer: 0,
    music: createMusic(), plucks: createPlucks(), ripple: createRipple(), still, scrollY: window.scrollY, dt: 1 / 60,
    decided: getSoundtrackState() !== "before", gated: false, idleGain: 0, idleClock: 0, length: 0, runFlat: 0,
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
    frame.dt = dt;
    refreshGate();
    for (const v of views) v.prepare(frame);
    if (snap) {
      frame.state.head = frame.state.target;
      snap = false;
    }
    const before = frame.state.head;
    const moving = stepHead(frame.state, dt, false);
    let music = false, breath = false, plucks = false, ripple = false;
    if (!frozen) {
      if (frame.pointer.moved) {
        if (frame.decided) {
          const near = frame.near;
          notePointer(frame.plucks, near.d2 < PLUCK.radius ** 2 ? near.j : -1, near.side, near.s, frame.pointer.speed);
        }
      } else frame.pointer.speed *= Math.exp(-dt / 0.07);
      frame.shimmer += dt * SHIMMER.rate;
      breathClock += dt;
      frame.breath = Math.sin(breathClock * BREATH.rate);
      levelColumns(leveller, player.sample(t, SPECTRUM_BINS).means, dt, levelled);
      music = stepMusic(frame.music, dt, getSoundtrackState() === "on", levelled);
      frame.idleClock += dt;
      plucks = stepPlucks(frame.plucks, dt);
      // A crest that ends this frame still repaints once, to clear it.
      ripple = frame.ripple.live;
      stepRipple(frame.ripple, dt);
      breath = views.some((v) => v.breathes && v.active());
    }
    frame.pointer.moved = false;
    frame.near.d2 = Infinity;
    // The idle ripple is what the music has not taken: it fades out as the music shapes the line and back in when it stops.
    frame.idleGain = still ? 0 : 1 - frame.music.share;
    sync();
    const changed = { head: moving || frame.state.head !== before, music, breath, plucks, ripple };
    for (const v of views) if (v.active()) v.paint(frame, changed);
    if (probe) probe.ticks++;
    return moving || (!frozen && frame.ripple.live) || (views.some((v) => v.active()) && (music || breath || plucks));
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

  const bandIsAway = () => {
    const band = document.getElementById("listen");
    return band ? bandAway(band.getBoundingClientRect(), window.innerHeight, RELEASE_LINE) : true;
  };
  // The head waits at the run's end while the band is below the release line. Once it is above it the wave follows the reader, whether
  // they answered or not: scrolling on past an unanswered prompt counts as a Not now for the wave alone (lib/wavepath/hold's
  // wavefollows). The soundtrack stays "before", so the "Music?" pill still arrives.
  const refreshGate = () => {
    const away = bandIsAway();
    frame.gated = !still && !away;
    frame.decided = wavefollows(getSoundtrackState() !== "before", hold.on, away);
  };
  // The hold ends: the answer takes effect (the line follows, the music shapes it) and the kept ripple goes out.
  const released = (result: { released: boolean; startRipple: boolean }) => {
    if (!result.released) return;
    refreshGate();
    if (result.startRipple && !frozen) startRipple(frame.ripple, rippleOrigin());
    wake();
  };
  const onScroll = () => {
    frame.scrollY = window.scrollY;
    if (hold.on) released(checkRelease(hold, bandIsAway()));
    refreshGate();
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
  // A live press is answered, a restore is not (lib/wavepath/answer): a yes with a ripple, once the band has scrolled away, and a
  // Not now at once, in the band, with a gentle swell.
  const rippleOrigin = () => {
    for (const v of views) if (v.rippleOrigin) return v.rippleOrigin();
    return frame.runLen / 2;
  };
  let lastState = getSoundtrackState();
  const onSoundtrack = () => {
    const next = getSoundtrackState();
    const press = pressOf(lastState, next, getRestoredSoundtrack());
    const answer: HoldResult | null = !still && press ? pressAnswer(hold, bandIsAway(), press) : null;
    refreshGate();
    if (answer?.startRipple && !frozen) startRipple(frame.ripple, rippleOrigin());
    if (swells(press, still, frozen)) startRipple(frame.ripple, rippleOrigin(), "swell");
    lastState = next;
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
      // Undecided the target is always the run's end: land there, never ease.
      if (first || !frame.decided) snap = true;
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
    frame: () => ({ head: frame.head, target: frame.state.target, cap: frame.state.cap, length: frame.length, runLen: frame.runLen, train: frame.train, decided: frame.decided, gated: frame.gated, idle: frame.idleGain, runFlat: frame.runFlat, ripple: rippleHeight(frame.ripple), music: frame.music.share }),
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
