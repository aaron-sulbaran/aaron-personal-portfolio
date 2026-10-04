import { getSoundtrackPlayer } from "@/lib/audio";
import { getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";
import { createConveyor, feedScroll, stepConveyor, type ConveyorState } from "@/lib/waveform/conveyor";
import { FLOOR, createField, regimeOf, stepField, type Field, type Regime } from "@/lib/waveform/field";

// The waveform's one engine: the field, the loop, the audio sample, the
// regime, the clock, the scroll conveyor and the sweep. Views (waveView.ts)
// attach to it and paint the field it steps; they own their canvas, colors,
// weights and cursor. The math lives in lib/waveform; this file only feeds it.
//
// One conductor per page, ref counted: the first acquire creates it, the last
// release destroys it. A change of `still` while it is held destroys it and
// starts a fresh one, since every caller remounts on `still` anyway; a stale
// holder's release then only touches its own, already destroyed, instance.
//
// The loop runs only while a view is in view (or easing), the tab is visible
// and the wave is not frozen. It eases by elapsed time, so a 120Hz display
// neither burns twice the frames nor runs the transitions faster; it caps at
// 60fps, and at 30fps while nothing moves fast (the calm regimes with the
// conveyor and the sweep at rest). Once the field settles (the still regime,
// "Maybe later") with the conveyor and the sweep at rest, the loop stops until
// the music, the scroll, the cursor or a view wakes it. `still` (reduced
// motion) never loops: the views draw one flat line.

const FAST_FRAME_MS = 1000 / 60 - 2;
const SLOW_FRAME_MS = 1000 / 30 - 2;
const MAX_STEP_S = 0.1;

// Stand-in until the sweep lands in Task 5, which steps it by dt here.
type SweepState = { value: number; target: number };
const stepSweep = (): boolean => false;

export interface WaveView {
  // Called once per conductor frame before the field steps: sync the cursor,
  // blend the weights from the field's current levels, and raise
  // `conductor.carve` to this view's carve targets (the field sees the max).
  prepare(): void;
  // Called once per conductor frame after the field steps; paint the field.
  paint(time: number): void;
  // True while this view should be painted (in view, not frozen).
  active(): boolean;
  // True if this view has anything still easing of its own; keeps the loop awake.
  busy(): boolean;
}

export interface WaveConductor {
  field: Field; // sized to the widest attached view
  columns: number;
  carve: Float32Array; // this frame's carve targets, the max over the views
  conveyor: ConveyorState;
  sweep: SweepState; // { value: 0, target: 0 } until Task 5
  time: number; // seconds, last stepped
  attach(view: WaveView): void;
  detach(view: WaveView): void;
  // A view asks for at least this many columns; the field keeps the max over
  // the views that asked (`from` keys the request, so a view that shrinks or
  // detaches gives its columns back).
  setColumns(columns: number, from?: WaveView): void;
  setSweepTarget(target: number, snap?: boolean): void;
  setFrozen(frozen: boolean): void;
  subscribe(listener: () => void): () => void; // fires after each step
  wake(): void;
  release(): void; // ref counted; the last release destroys it
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
  const views: WaveView[] = [];
  const requests = new Map<WaveView | null, number>();
  const listeners = new Set<() => void>();
  let frozen = false;
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let minFrameMs = FAST_FRAME_MS;

  // The band reads "off" as the still line. Once the wave is mostly on the
  // horizon (sweep past half) a declined visitor gets the calm idle drift
  // instead, travelling with the scroll as a quiet background.
  const regimeNow = (): Regime => {
    const state = getSoundtrackState();
    return conductor.sweep.value > 0.5 && state === "off" ? "idle" : regimeOf(state);
  };

  const resize = () => {
    let columns = 0;
    requests.forEach((n) => (columns = Math.max(columns, n)));
    if (columns === conductor.columns) return;
    const previous = conductor.field;
    const field = createField(columns);
    field.levels = previous.levels;
    field.mag.set(previous.mag.subarray(0, Math.min(previous.mag.length, columns)));
    if (still) field.mag.fill(FLOOR);
    conductor.field = field;
    conductor.columns = columns;
    conductor.carve = new Float32Array(columns);
  };

  // One step of the field; returns true once everything has come to rest.
  const step = (t: number, dt: number): boolean => {
    const time = t / 1000; // the rAF clock is ms; every wave sine runs in seconds
    conductor.time = time;
    const regime = regimeNow();
    conductor.carve.fill(0);
    for (const view of views) if (view.active()) view.prepare();
    const frame = player.sample(t, conductor.columns);
    const idle = regime === "idle" && !still;
    const { moving } = stepConveyor(conductor.conveyor, dt, idle);
    const sweeping = stepSweep();
    const { settled } = stepField(conductor.field, {
      time,
      dt,
      regime,
      bands: frame.bands,
      audioLevel: frame.level,
      carve: conductor.carve,
      phase: conductor.conveyor.phase,
    });
    for (const view of views) if (view.active()) view.paint(time);
    listeners.forEach((listener) => listener());
    const calm = regime !== "reactive" && !moving && !sweeping;
    minFrameMs = calm ? SLOW_FRAME_MS : FAST_FRAME_MS;
    return settled && !moving && !sweeping && !views.some((view) => view.busy());
  };

  const running = () =>
    !destroyed && !still && !frozen && !document.hidden && views.some((view) => view.active() || view.busy());

  const tick = (t: number) => {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(tick);
    if (last && t - last < minFrameMs) return;
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    if (step(t, dt)) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const wake = () => {
    if (raf || !running()) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  // Page scroll feeds the conveyor as a delta per event, read from scrollY
  // (as the Coil's scene input does), so every source of scroll counts.
  let lastScrollY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    feedScroll(conductor.conveyor, y - lastScrollY);
    lastScrollY = y;
    wake();
  };

  const conductor: WaveConductor = {
    field: createField(0, regimeOf(getSoundtrackState())),
    columns: 0,
    carve: new Float32Array(0),
    conveyor: createConveyor(),
    sweep: { value: 0, target: 0 },
    time: 0,
    attach(view) {
      if (!views.includes(view)) views.push(view);
      wake();
    },
    detach(view) {
      const index = views.indexOf(view);
      if (index >= 0) views.splice(index, 1);
      if (requests.delete(view)) resize();
    },
    setColumns(columns, from) {
      const key = from ?? null;
      requests.set(key, from ? columns : Math.max(requests.get(key) ?? 0, columns));
      resize();
    },
    setSweepTarget(target, snap = false) {
      conductor.sweep.target = target;
      if (snap) conductor.sweep.value = target;
      wake();
    },
    setFrozen(next) {
      frozen = next;
      wake();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    wake,
    release() {
      if (destroyed) return;
      instance.refs--;
      if (instance.refs <= 0) destroy();
    },
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", wake);
    unsubscribe();
    views.length = 0;
    listeners.clear();
    if (live === instance) live = null;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", wake);
  const unsubscribe = subscribeSoundtrack(wake);

  const instance: Instance = { conductor, still, refs: 0, destroy };
  return instance;
}
