import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { coilPose, helixRotation, mod, restHelix, solveGeometry, type CardPose } from "@/lib/coil/geometry";
import {
  createUnwind,
  latchPositions,
  settleUnwind,
  toggleUnwind,
  unwindDurationMs,
  unwindPose,
  unwindProgress,
  unwindTileProgress,
  type UnwindColumn,
  type UnwindState,
} from "@/lib/coil/unwind";

const N = 14;
const geo = solveGeometry({ width: 1440, height: 900 }, N);
const helix = restHelix(geo);
const OFFSET = 3.37;

// Every slot's pose and the tile it shows at the offset.
function slots(offset: number) {
  return Array.from({ length: geo.slotCount }, (_, j) => {
    const pose = coilPose(helix, j, offset);
    return { pose: pose as CardPose, tile: mod(pose.strandPosition, N), strandPosition: pose.strandPosition };
  });
}

// A column of rows down the right of the pane, one per tile.
function column(): UnwindColumn {
  return {
    axisCenter: helix.center,
    axisDirection: helixRotation(helix).y,
    targets: Array.from({ length: N }, (_, i) => ({ position: [1.2, 1.6 - i * 0.22, 0] as const, scale: 0.2 })),
  };
}

function unwound(start = 1000): UnwindState {
  const state = createUnwind();
  toggleUnwind(state, start, OFFSET, N, true);
  state.column = column();
  return state;
}

const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe("unwind latch", () => {
  it("latches each tile's copy nearest the strand's center", () => {
    const latched = latchPositions(OFFSET, N);
    latched.forEach((p, i) => {
      expect(mod(p, N)).toBe(i);
      expect(Math.abs(p + OFFSET)).toBeLessThanOrEqual(N / 2);
    });
    // Every latched copy is on screen in the window.
    const inWindow = new Set(slots(OFFSET).map((s) => s.strandPosition));
    latched.forEach((p) => expect(inWindow.has(p)).toBe(true));
  });

  it("stays the identity at rest", () => {
    const state = createUnwind();
    expect(unwindProgress(state, 5000)).toBe(0);
    slots(OFFSET).forEach(({ pose, tile }) => expect(unwindPose(pose, tile, state, 5000)).toBe(pose));
  });
});

describe("unwind timing", () => {
  it("runs 580ms per card with an 8ms stagger along the strand", () => {
    const state = unwound(0);
    const latched = state.latched!;
    const first = latched.indexOf(Math.min(...latched));
    const last = latched.indexOf(Math.max(...latched));
    expect(unwindDurationMs(N)).toBe(COIL.unwind.perCardMs + COIL.unwind.staggerMs * (N - 1));
    expect(unwindTileProgress(state, first, 0)).toBe(0);
    expect(unwindTileProgress(state, first, COIL.unwind.perCardMs)).toBe(1);
    expect(unwindTileProgress(state, last, COIL.unwind.staggerMs * (N - 1))).toBe(0);
    expect(unwindTileProgress(state, last, unwindDurationMs(N) - 1)).toBeLessThan(1);
    expect(unwindTileProgress(state, last, unwindDurationMs(N))).toBe(1);
    expect(unwindProgress(state, unwindDurationMs(N))).toBe(1);
  });

  it("rises monotonically with no overshoot", () => {
    const state = unwound(0);
    let previous = 0;
    for (let t = 0; t <= unwindDurationMs(N) + 50; t += 4) {
      const p = unwindProgress(state, t);
      expect(p).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(p).toBeLessThanOrEqual(1);
      previous = p;
    }
  });

  it("reverses mid-flight from where each card is, with no jump", () => {
    const state = unwound(0);
    const before = Array.from({ length: N }, (_, i) => unwindTileProgress(state, i, 300));
    toggleUnwind(state, 300, OFFSET, N, false);
    const after = Array.from({ length: N }, (_, i) => unwindTileProgress(state, i, 300));
    expect(close(before, after)).toBe(true);
  });
});

describe("unwind poses", () => {
  it("lands every latched card flat, facing the camera, in its row", () => {
    const state = unwound(0);
    const end = unwindDurationMs(N);
    slots(OFFSET).forEach(({ pose, tile, strandPosition }) => {
      const out = unwindPose(pose, tile, state, end);
      if (strandPosition !== state.latched![tile]) {
        expect(out.alpha).toBe(0);
        return;
      }
      const row = state.column!.targets[tile]!;
      expect(close(out.position, row.position)).toBe(true);
      expect(out.scale).toBeCloseTo(row.scale, 12);
      expect(close(out.basis.x, [1, 0, 0])).toBe(true);
      expect(close(out.basis.y, [0, 1, 0])).toBe(true);
      expect(close(out.basis.z, [0, 0, 1])).toBe(true);
      expect(out.bend).toBe(0);
      expect(out.beta).toBe(0);
      expect(out.fade).toBe(0);
      expect(out.alpha).toBe(1);
    });
  });

  it("dissolves every other copy by 35 percent of its card's clock", () => {
    const state = unwound(0);
    const latched = state.latched!;
    slots(OFFSET).forEach(({ pose, tile, strandPosition }) => {
      if (strandPosition === latched[tile]) return;
      const start = (latched[tile] - Math.min(...latched)) * COIL.unwind.staggerMs;
      let t = start;
      while (unwindTileProgress(state, tile, t) < 0.35) t += 1;
      expect(unwindPose(pose, tile, state, t).alpha).toBeCloseTo(0, 6);
    });
  });

  it("returns to exactly the rest pose once wound back, and lets go", () => {
    const state = unwound(0);
    toggleUnwind(state, unwindDurationMs(N) + 200, OFFSET, N, false);
    const home = unwindDurationMs(N) * 2 + 200;
    expect(unwindProgress(state, home)).toBe(0);
    slots(OFFSET).forEach(({ pose, tile }) => {
      const out = unwindPose(pose, tile, state, home);
      expect(out).toBe(pose);
    });
    expect(settleUnwind(state, home - 1)).toBe(false);
    expect(settleUnwind(state, home)).toBe(true);
    expect(state.latched).toBeNull();
    expect(unwindProgress(state, home + 1000)).toBe(0);
  });

  it("moves continuously: no 4ms step jumps a card more than 4 percent of the pane", () => {
    const state = unwound(0);
    const latched = state.latched!;
    const entry = slots(OFFSET).find(({ tile, strandPosition }) => strandPosition === latched[tile])!;
    let last = unwindPose(entry.pose, entry.tile, state, 0).position;
    for (let t = 4; t <= unwindDurationMs(N); t += 4) {
      const p = unwindPose(entry.pose, entry.tile, state, t).position;
      expect(Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2])).toBeLessThan(0.04 * 2 * COIL.lab.viewHalfHeight);
      last = p;
    }
  });
});
