import { entranceClock, entranceHelix, isRested } from "@/lib/coil/entrance";
import { clamp01, type HelixFrame } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import type { Name } from "./name";
import type { SceneCtx, SceneFrame } from "./state";

// The entrance's wiring (slice 4): its clock on the scene's own time, the
// strand held at its start until the band opens, the band itself
// (lib/coil/entrance.ts, pure), the name's fades, and the end reported once.
// Also the rebuild fade (slice 7): after a rotation or a remount the cards
// and the name fade back in rather than pop.

// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over this, so nothing pops.
const REBUILD_FADE_MS = 450;

export function createEntrance(ctx: SceneCtx, name: Name) {
  const { st, live, flags } = ctx;
  const { conveyor } = st;
  const { pinned, forcedEntranceMs } = flags;
  // ---- slice 4 state: the entrance clock ----
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

  // ---- slice 4 wiring block: the entrance ----
  // Update step.
  function entrance(f: SceneFrame) {
    const { now, props } = f;
    const realElapsedMs = pinned ? Number.POSITIVE_INFINITY : entranceElapsedMs(now);
    const clock = entranceClock(forcedEntranceMs ?? realElapsedMs);
    f.realElapsedMs = realElapsedMs;
    f.clock = clock;
    if (!isRested(clock)) {
      // Idle, wheel and page scroll wait for the entrance: the strand holds
      // still at its start until the band has opened.
      conveyor.offset = 0;
      conveyor.target = 0;
      conveyor.velocity = 0;
      conveyor.excessVelocity = 0;
      conveyor.glide = null;
      st.coast = null; // slice 7
    }
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
      elapsedMs: entranceBase === null ? null : performance.now() - entranceBase,
      ended: entranceEnded,
    };
  }

  return { entrance, rebuild, clockState };
}

export type Entrance = ReturnType<typeof createEntrance>;
