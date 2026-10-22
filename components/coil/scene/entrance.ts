import { dealOffsetAt, dealOmega, dealSpeedOf, integrateDealSpeed, sceneMs } from "@/lib/coil/dealSpeed";
import { entranceClock, entranceHelix, fieldMask, tunedConstants, wheelPlacement, wheelSlideProgress, type EntranceTuning } from "@/lib/coil/entrance";
import { clamp01, type HelixFrame } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { entranceTuningOf, getKnobs, type DealKnobs } from "@/lib/home/dealKnobs";
import type { Name } from "./name";
import type { SceneCtx, SceneFrame } from "./state";
import type { CoilEntrance } from "./types";

// The deal's wiring (hero rework, slice 4a): the wheel turning in the teaser
// until the click, the deal's one clock (the director's timeline, read each
// frame), the strand's offset from the integrated speed curve, the band
// (lib/coil/entrance.ts, pure), the field's mask, the name's fades, and the end
// reported once. Also the rebuild fade (slice 7): after a rotation or a
// remount the cards and the name fade back in rather than pop.
//
// This step is the one owner of the conveyor's offset while the deal has not
// ended: the wheel's slow turn before the click, then s(ms) from the speed
// curve, built once per deal from the wheel's own pace so the click has no
// step. From the first rested frame the conveyor carries on at the idle pace
// the curve ended at.

// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over this, so nothing pops.
const REBUILD_FADE_MS = 450;

// The wheel counts as in view, and slides in, once its center is above this
// share of the viewport's height (and not above its top).
const WHEEL_IN_VIEW_BELOW = 0.86;

type Curve = { table: Float32Array; firstMs: number; base: number; atPull: number };
type Tuned = ReturnType<typeof tunedConstants>;

export function createEntrance(ctx: SceneCtx, name: Name) {
  const { st, live, flags, host } = ctx;
  const { conveyor, view } = st;
  const { pinned, forcedEntranceMs } = flags;
  // ---- slice 4 state: the entrance clock ----
  let entranceBase: number | null = null; // when this scene's entrance clock reads 0 (no shared clock)
  let entranceEnded = false;
  let lastElapsedMs = Number.NEGATIVE_INFINITY;
  // The entrance object this clock follows. A new one (the deal plays on the
  // click, and the lab can replay it) restarts the clock; the same one keeps it running.
  let followed: CoilEntrance | null | undefined;
  // ---- the wheel before the click, and the deal's curve ----
  let turned: number | null = null; // where the wheel's turn has the strand, in cards
  let wheelInAt: number | null = null; // when the wheel was first in view
  let curve: Curve | null = null;

  // The lab's knobs as the entrance's tuning, remade only when they change.
  let knobsSeen: DealKnobs | null = null;
  let knobsTuning: EntranceTuning | undefined;
  function labTuning() {
    const knobs = getKnobs();
    if (knobs !== knobsSeen) {
      knobsSeen = knobs;
      knobsTuning = entranceTuningOf(knobs);
    }
    return knobsTuning;
  }

  // Real milliseconds since the click (-Infinity before it, Infinity for a
  // fast start). The director's shared clock when the entrance has one; else a
  // start the scene first sees late (it was still loading) begins at that
  // first sight, so no part of it is skipped.
  // Slice 7: a scene that mounts with the hero already interactive (reduced
  // motion switched off again, the remount after a lost context, a chunk
  // that arrived after the lock gave up) starts at rest: the entrance plays
  // once per load, never on a rebuild.
  function entranceElapsedMs(now: number) {
    const entrance = live.current.entrance;
    if (entrance !== followed) {
      followed = entrance;
      entranceBase = null;
      entranceEnded = false;
      curve = null;
    }
    if (!entrance) return Number.NEGATIVE_INFINITY;
    if (entrance.clockMs) return entrance.clockMs();
    if (entranceBase === null) {
      const played = Number.isFinite(entrance.startMs);
      const rebuilt = played && live.current.interactive;
      entranceBase = played && !rebuilt ? Math.max(entrance.startMs, now) : Number.NEGATIVE_INFINITY;
      // A rebuild fades its cards and name in over the poster (the rotation's fade).
      if (rebuilt) st.rebuildAt = now;
    }
    return now - entranceBase;
  }

  // How far the wheel has slid in: it waits transparent until it is first in
  // view (its center on screen, above the fold), slides in once, and a deal
  // that begins before it was ever seen brings it in during the spin-up.
  function wheelIn(f: SceneFrame, ms: number, c: Tuned) {
    if (forcedEntranceMs !== null) return 1;
    if (wheelInAt === null) {
      if (ms >= 0) wheelInAt = f.now;
      else {
        const rect = host.getBoundingClientRect();
        const center = wheelPlacement(f.geo, c).center;
        const y = rect.top + view.height / 2 - center[1] / f.geo.camera.worldPerPx;
        if (y > 0 && y < window.innerHeight * WHEEL_IN_VIEW_BELOW) wheelInAt = f.now;
      }
    }
    return wheelInAt === null ? 0 : wheelSlideProgress(f.now - wheelInAt, c);
  }

  // The strand held where the deal puts it: the idle drift, the wheel, a
  // glide and a coast all wait for it.
  function hold(offset: number, velocity: number) {
    conveyor.offset = offset;
    conveyor.target = offset;
    conveyor.velocity = velocity;
    conveyor.excessVelocity = 0;
    conveyor.glide = null;
    st.coast = null; // slice 7
  }

  // The strand's turn: the wheel's own pace before the click, the speed curve
  // from it. Returns how far the strand has turned since the pull began.
  function turn(f: SceneFrame, ms: number, c: Tuned) {
    const wheelPace = c.deal.wheel.idleCardsPerSecond;
    if (ms < 0) {
      turned = (turned ?? conveyor.offset) + wheelPace * f.dt;
      hold(turned, wheelPace);
      return 0;
    }
    if (!curve) {
      const table = integrateDealSpeed(dealSpeedOf(wheelPace, c), sceneMs(c));
      // A pinned frame counts from the click, so it is the same however it was reached.
      const forced = forcedEntranceMs !== null;
      curve = {
        table,
        firstMs: forced ? 0 : ms,
        base: forced ? conveyor.offset : (turned ?? conveyor.offset),
        atPull: dealOffsetAt(table, c.deal.timeline.pullStartMs),
      };
    }
    const here = dealOffsetAt(curve.table, ms);
    hold(curve.base + here - dealOffsetAt(curve.table, curve.firstMs), dealOmega(ms, dealSpeedOf(wheelPace, c)));
    return ms > c.deal.timeline.pullStartMs ? here - curve.atPull : 0;
  }

  // ---- slice 4 wiring block: the entrance ----
  // Update step.
  function entrance(f: SceneFrame) {
    const { now, props } = f;
    const c = tunedConstants(props.entrance?.tuning ?? labTuning());
    const realElapsedMs = pinned ? Number.POSITIVE_INFINITY : entranceElapsedMs(now);
    const ms = forcedEntranceMs ?? realElapsedMs;
    lastElapsedMs = ms;
    f.realElapsedMs = realElapsedMs;
    const rested = ms >= sceneMs(c);
    const drift = rested ? 0 : turn(f, ms, c);
    const clock = entranceClock(ms, c, rested ? 1 : wheelIn(f, ms, c), drift);
    f.clock = clock;
    st.open = fieldMask(clock, view, c);
    f.helix = entranceHelix(f.helix as HelixFrame, f.geo, clock);
    name.entranceFade(f);
    const entrance = props.entrance;
    if (entrance && !entranceEnded && realElapsedMs >= clock.durationS * 1000) {
      entranceEnded = true;
      props.onEntranceEnd?.();
    }
  }
  // ---- end slice 4 block ----

  // Update step. Slice 7: the rebuild fade (1 when none is running).
  function rebuild(f: SceneFrame) {
    if (st.rebuildAt === null) return;
    const rebuilt = siteEase(clamp01((f.now - st.rebuildAt) / REBUILD_FADE_MS));
    f.rebuilt = rebuilt;
    if (rebuilt >= 1) st.rebuildAt = null;
    name.fade(rebuilt);
  }

  // QA: the entrance clock.
  function clockState() {
    return {
      base: entranceBase,
      elapsedMs: Number.isFinite(lastElapsedMs) ? lastElapsedMs : null,
      ended: entranceEnded,
    };
  }

  return { entrance, rebuild, clockState };
}

export type Entrance = ReturnType<typeof createEntrance>;
