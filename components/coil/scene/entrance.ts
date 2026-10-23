import { dealOffsetAt, dealOmega, dealSpeedOf, integrateDealSpeed, sceneMs } from "@/lib/coil/dealSpeed";
import { entranceClock, entranceHelix, fieldMask, tunedConstants, type EntranceTuning } from "@/lib/coil/entrance";
import { FIELD } from "@/lib/coil/field.glsl";
import { clamp01, type HelixFrame } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { ribbonCardsPerSecond } from "@/lib/coil/ribbon";
import { entranceTuningOf, getKnobs, type DealKnobs } from "@/lib/home/dealKnobs";
import type { Name } from "./name";
import type { SceneCtx, SceneFrame } from "./state";
import type { CoilEntrance } from "./types";

// The deal's wiring (hero rework, slices 4a and 4c): the ribbon drifting on the
// first screen until the click, the deal's one clock (the director's timeline,
// read each frame), the strand's offset from the integrated speed curve, the
// frame (lib/coil/entrance.ts, pure), the field's mask, the name's fades, and
// the end reported once. Also the rebuild fade (slice 7): after a rotation or a
// remount the cards and the name fade back in rather than pop.
//
// This step is the one owner of the conveyor's offset while the deal has not
// ended: the ribbon's slow drift before the click and through the condense (a
// card rate, negative: the row moves left), then s(ms) from the speed curve,
// built once per deal from the ribbon's own pace so the click has no step. From
// the first rested frame the conveyor carries on at the idle pace the curve
// ended at.
//
// Two clocks meet here: the director's is milliseconds since the click, and the
// scene's own (lib/coil/entrance.ts) zero is the end of the condense, condenseMs
// later; `ms` below is the scene's and negative through the condense.

// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over this, so nothing pops.
const REBUILD_FADE_MS = 450;

type Curve = { table: Float32Array; firstMs: number; base: number; atPull: number };
type Tuned = ReturnType<typeof tunedConstants>;

export function createEntrance(ctx: SceneCtx, name: Name) {
  const { st, live, flags } = ctx;
  const { conveyor, view } = st;
  const { pinned } = flags;
  // ---- slice 4 state: the entrance clock ----
  let entranceBase: number | null = null; // when this scene's entrance clock reads 0 (no shared clock)
  let entranceEnded = false;
  let lastElapsedMs = Number.NEGATIVE_INFINITY;
  // The entrance object this clock follows. A new one (the deal plays on the
  // click, and the lab can replay it) restarts the clock; the same one keeps it running.
  let followed: CoilEntrance | null | undefined;
  // ---- the ribbon before the ring begins, and the deal's curve ----
  let turned: number | null = null; // where the ribbon's drift has the strand, in cards
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

  // The deal's speed curve for these constants, built once per deal: the ribbon's
  // own pace at its start, integrated to a table; `base` is the strand's offset
  // at `firstMs`.
  function curveFor(c: Tuned, rate: number, base: number, firstMs: number, coarse: boolean) {
    if (!curve) {
      const table = integrateDealSpeed(dealSpeedOf(rate, c, coarse), sceneMs(c));
      curve = { table, firstMs, base, atPull: dealOffsetAt(table, c.deal.timeline.pullStartMs) };
    }
    return curve;
  }

  // The strand's turn: the ribbon's own drift before the ring begins (the
  // click's condense included), the speed curve from it. Returns how far the
  // strand has turned since the pull began.
  function turn(f: SceneFrame, ms: number, c: Tuned) {
    const rate = ribbonCardsPerSecond(f.geo, c);
    const coarse = f.props.input === "coarse";
    const speed = dealSpeedOf(rate, c, coarse);
    if (flags.forcedEntranceMs !== null) {
      // A pinned frame (?coildebug=entrance=): the same however it was reached,
      // counted from the strand's start, and held there even past the end.
      const start = flags.stillOffset ?? 0;
      if (ms < 0) {
        hold(Number.isFinite(ms) ? start + (rate * ms) / 1000 : start, rate);
        return 0;
      }
      const forced = curveFor(c, rate, start, 0, coarse);
      hold(forced.base + dealOffsetAt(forced.table, ms), dealOmega(ms, speed));
      return ms > c.deal.timeline.pullStartMs ? dealOffsetAt(forced.table, ms) - forced.atPull : 0;
    }
    if (ms < 0) {
      turned = (turned ?? conveyor.offset) + rate * f.dt;
      hold(turned, rate);
      return 0;
    }
    const k = curveFor(c, rate, turned ?? conveyor.offset, ms, coarse);
    const here = dealOffsetAt(k.table, ms);
    hold(k.base + here - dealOffsetAt(k.table, k.firstMs), dealOmega(ms, speed));
    return ms > c.deal.timeline.pullStartMs ? here - k.atPull : 0;
  }

  // The bottom seam's height: the canvas's bottom edge only meets the page once
  // the stage lets go of its rail (it is stuck at the top of the screen before,
  // and the ribbon sits right down there), so the seam grows over the last
  // seamFade of the canvas's height before that, and is whole from it on.
  let rail: Element | null | undefined;
  function seam(): number {
    if (rail === undefined) rail = ctx.host.closest("[data-coil-rail]");
    if (!rail) return FIELD.seamFade;
    const left = rail.getBoundingClientRect().bottom - ctx.host.getBoundingClientRect().bottom;
    const full = FIELD.seamFade * view.height;
    return (FIELD.seamFade * clamp01((full - left) / Math.max(1, full)));
  }

  // ---- slice 4 wiring block: the entrance ----
  // Update step.
  function entrance(f: SceneFrame) {
    const { now, props } = f;
    const c = tunedConstants(props.entrance?.tuning ?? labTuning());
    const lead = c.deal.timeline.condenseMs;
    // Both as the scene's clock reads them: zero at the end of the condense.
    const realElapsedMs = pinned ? Number.POSITIVE_INFINITY : entranceElapsedMs(now) - lead;
    const ms = flags.forcedEntranceMs !== null ? flags.forcedEntranceMs - lead : realElapsedMs;
    lastElapsedMs = ms;
    f.realElapsedMs = realElapsedMs;
    const rested = ms >= sceneMs(c);
    const drift = rested && flags.forcedEntranceMs === null ? 0 : turn(f, ms, c);
    const clock = entranceClock(ms, c, drift);
    f.clock = clock;
    st.seam = seam();
    st.open = fieldMask(clock, view, c, name.origin() ?? undefined);
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

  // QA: the entrance clock (the scene's own: zero at the end of the condense).
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
