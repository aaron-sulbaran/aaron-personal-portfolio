import { isRested, pullHelix } from "@/lib/coil/entrance";
import type { HelixFrame } from "@/lib/coil/geometry";
import { createShapeClock, isSwitching, shapePull, stepShapeClock } from "@/lib/coil/shape";
import type { SceneCtx, SceneFrame } from "./state";
// The Coil and Band toggle: the helix pulled toward the entrance's closed band
// by one value on the pull curve (lib/coil/shape.ts). The shape is a prop
// (CoilStage holds the choice); a scene mounted in the band starts there. It
// waits for the entrance to rest; a stopped scene holds it (no time passes).
// Mid-switch it holds the strand where the switch began, as the entrance and
// the unwind do: the seam's two ends sit apart, so a crossing card would jump.
export function createShape(ctx: SceneCtx) {
  const { live, st } = ctx;
  const clock = createShapeClock(live.current.shape ?? "coil");
  let angStep = 0;
  let held: number | null = null;
  // Update step, after the entrance.
  function step(f: SceneFrame) {
    if (f.clock && !isRested(f.clock)) {
      f.shapePull = 1;
    } else {
      stepShapeClock(clock, f.props.shape ?? "coil", f.dt);
      if (isSwitching(clock)) {
        held ??= st.conveyor.offset;
        Object.assign(st.conveyor, { offset: held, target: held, velocity: 0, excessVelocity: 0, glide: null });
        st.coast = null;
      } else held = null;
      f.shapePull = shapePull(clock);
      f.helix = pullHelix(f.helix as HelixFrame, f.geo, f.shapePull);
    }
    angStep = (f.helix as HelixFrame).angStep;
  }
  function state() {
    return { target: live.current.shape ?? "coil", progress: clock.progress, pull: shapePull(clock), angStep };
  }
  return { step, state };
}
export type Shape = ReturnType<typeof createShape>;
