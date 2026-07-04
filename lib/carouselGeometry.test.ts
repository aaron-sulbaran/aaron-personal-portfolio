import { describe, expect, it } from "vitest";
import {
  CAROUSEL,
  arcSlot,
  cardState,
  collapseTransform,
  heroSeat,
  lerpState,
  moveEase,
  norm180,
  projectCollapse,
  shortestDeltaDeg,
  spinEase,
  tiltRamp,
  toCollapse,
  wrap,
  type SeatPx,
  type Viewport,
} from "./carouselGeometry";

const VP: Viewport = { vw: 1440, vh: 900, vmin: 900 };

// TileRing's seats memo, replicated: angle = -90 + i*18 deg, radius 41vmin,
// tangent = angle + 90.
function seatPx(i: number, vp: Viewport): SeatPx {
  const angle = -Math.PI / 2 + (i / CAROUSEL.N) * Math.PI * 2;
  const radiusPx = (CAROUSEL.RING_RADIUS_VMIN / 100) * vp.vmin;
  return {
    seatX: Math.cos(angle) * radiusPx,
    seatY: Math.sin(angle) * radiusPx,
    rotateDeg: (angle * 180) / Math.PI + 90,
  };
}

describe("wrap", () => {
  it("wraps card offsets into [-N/2, N/2)", () => {
    expect(wrap(0, 0)).toBe(0);
    expect(wrap(19, 0)).toBe(-1);
    expect(wrap(10, 0)).toBe(-10);
    expect(wrap(3, 2.5)).toBeCloseTo(0.5, 12);
    expect(wrap(0, 0.5)).toBeCloseTo(-0.5, 12);
  });

  it("is periodic in N", () => {
    for (let i = 0; i < CAROUSEL.N; i++) {
      expect(wrap(i + CAROUSEL.N, 3.7)).toBeCloseTo(wrap(i, 3.7), 12);
    }
  });
});

describe("shortestDeltaDeg", () => {
  it("takes the short way around", () => {
    expect(shortestDeltaDeg(350, 10)).toBe(20);
    expect(shortestDeltaDeg(10, 350)).toBe(-20);
    expect(shortestDeltaDeg(0, 180)).toBe(180);
  });

  it("never exceeds 180 in magnitude and lands on the target angle", () => {
    for (let from = -720; from <= 720; from += 37) {
      for (let to = -720; to <= 720; to += 53) {
        const d = shortestDeltaDeg(from, to);
        expect(Math.abs(d)).toBeLessThanOrEqual(180);
        expect(norm180(from + d - to)).toBeCloseTo(0, 9);
      }
    }
  });
});

describe("heroSeat", () => {
  it("matches TileRing's seats exactly at eSpin 0, rotation 0", () => {
    for (let i = 0; i < CAROUSEL.N; i++) {
      const seat = seatPx(i, VP);
      const state = heroSeat(wrap(i, 0), 0, VP);
      expect(state.x).toBeCloseTo(VP.vw / 2 + seat.seatX, 9);
      expect(state.y).toBeCloseTo(VP.vh / 2 + seat.seatY, 9);
      expect(state.scale).toBe(1);
      expect(state.z).toBe(0);
      expect(norm180(state.rotZ - seat.rotateDeg)).toBeCloseTo(0, 9);
    }
  });

  it("converts to an identity collapse at the hero rest state", () => {
    for (let i = 0; i < CAROUSEL.N; i++) {
      const seat = seatPx(i, VP);
      const { c } = toCollapse(heroSeat(wrap(i, 0), 0, VP), seat, VP);
      expect(c.dx).toBeCloseTo(0, 9);
      expect(c.dy).toBeCloseTo(0, 9);
      expect(c.scale).toBeCloseTo(1, 12);
      expect(norm180(c.rotZ)).toBeCloseTo(0, 9);
      expect(c.rotX).toBe(0);
      expect(c.tz).toBe(0);
    }
  });
});

describe("arcSlot", () => {
  it("puts the focused card at (0.70vw, vh/2) with the documented pop and scale", () => {
    const s = arcSlot(0, VP);
    expect(s.x).toBeCloseTo(0.7 * VP.vw, 9); // cos(180) folds the radius back out
    expect(s.y).toBeCloseTo(VP.vh / 2, 9);
    expect(s.z).toBe(CAROUSEL.FOCUS_POP_PX);
    expect(s.rotX).toBe(0);
    expect(s.rotZ).toBe(0);
    // (0.35 * 900) / (0.12 * 900) * 1.06 = 2.91667 * 1.06
    expect(s.scale).toBeCloseTo(((0.35 * VP.vh) / (0.12 * VP.vmin)) * 1.06, 9);
    expect(s.scale).toBeCloseTo(3.0916667, 6);
    expect(s.opacity).toBe(1);
  });

  it("fades on the 70..110 deg window multiplied by the depth dim", () => {
    // 70 deg away (off = 70/27): fade still 1, dim = 1 - 0.1 * 2.5926
    expect(arcSlot(70 / 27, VP).opacity).toBeCloseTo(1 - 0.1 * (70 / 27), 9);
    // 90 deg away: fade 0.5, dim floored at min(|off|, 3) -> 0.7
    expect(arcSlot(90 / 27, VP).opacity).toBeCloseTo(0.5 * 0.7, 9);
    // 110 deg away and beyond: fully faded
    expect(arcSlot(110 / 27, VP).opacity).toBeCloseTo(0, 9);
    expect(arcSlot(5, VP).opacity).toBe(0);
    // off = 3 (81 deg): fade 0.725, dim 0.7
    expect(arcSlot(3, VP).opacity).toBeCloseTo(0.725 * 0.7, 9);
  });

  it("clamps the rotX tilt at +-24 deg", () => {
    expect(arcSlot(1, VP).rotX).toBe(20);
    expect(arcSlot(2, VP).rotX).toBe(24);
    expect(arcSlot(-2, VP).rotX).toBe(-24);
  });
});

describe("tiltRamp (wheel-radius near-center easing)", () => {
  it("is identity at and beyond one step, zero at the center", () => {
    expect(tiltRamp(0)).toBe(0);
    expect(tiltRamp(1)).toBe(1);
    expect(tiltRamp(-1)).toBe(-1);
    expect(tiltRamp(2.5)).toBe(2.5);
    expect(tiltRamp(-3)).toBe(-3);
  });

  it("flattens near the center: t^2(2 - t) sits well under the linear ramp", () => {
    expect(tiltRamp(0.5)).toBeCloseTo(0.375, 9);
    expect(tiltRamp(0.3)).toBeCloseTo(0.09 * 1.7, 9); // 0.153 vs 0.3 linear
    expect(tiltRamp(0.1)).toBeCloseTo(0.019, 9); // near-zero slope at 0
    expect(tiltRamp(-0.5)).toBeCloseTo(-0.375, 9);
  });

  it("rejoins the linear ramp continuously at |off| = 1", () => {
    expect(tiltRamp(0.999)).toBeCloseTo(0.999, 3);
    // arc rotations inherit the shaping: a near-focus card is almost flat
    expect(arcSlot(0.3, VP).rotX).toBeCloseTo(0.153 * CAROUSEL.ARC_TILT_DEG, 9);
    expect(arcSlot(0.3, VP).rotZ).toBeCloseTo(
      0.153 * CAROUSEL.STEP_DEG * CAROUSEL.ARC_SPREAD * 0.5,
      9,
    );
    // settled neighbors are numerically unchanged by the shaping
    expect(arcSlot(1, VP).rotZ).toBeCloseTo(CAROUSEL.STEP_DEG * CAROUSEL.ARC_SPREAD * 0.5, 9);
  });
});

describe("transition clocks", () => {
  it("spin fills the front 62%, move fills the back 72%, overlapping", () => {
    expect(spinEase(0)).toBe(0);
    expect(spinEase(CAROUSEL.SPIN_WINDOW)).toBe(1);
    expect(spinEase(1)).toBe(1);
    expect(moveEase(CAROUSEL.MOVE_START)).toBe(0);
    expect(moveEase(0)).toBe(0);
    expect(moveEase(1)).toBe(1);
    expect(spinEase(0.5)).toBeGreaterThan(0);
    expect(spinEase(0.5)).toBeLessThan(1);
    expect(moveEase(0.5)).toBeGreaterThan(0);
    expect(moveEase(0.5)).toBeLessThan(1);
  });
});

describe("lerpState rotation path", () => {
  it("never spins the long way from a hero tangent to its arc slot", () => {
    // Card i=18 (off -2): hero tangent 324 deg, arc rotZ -27 deg. The short
    // path is -9 deg of travel via 324 -> 315; the long way would sweep 351.
    const a = heroSeat(-2, 0, VP);
    const b = arcSlot(-2, VP);
    expect(norm180(a.rotZ)).toBeCloseTo(-36, 9);
    expect(b.rotZ).toBeCloseTo(-27, 9);
    const mid = lerpState(a, b, 0.5);
    expect(Math.abs(shortestDeltaDeg(a.rotZ, mid.rotZ))).toBeLessThanOrEqual(
      Math.abs(shortestDeltaDeg(a.rotZ, b.rotZ)),
    );
    const end = lerpState(a, b, 1);
    expect(norm180(end.rotZ - b.rotZ)).toBeCloseTo(0, 9);
  });
});

describe("toCollapse round trip vs computeHomeRect's projection", () => {
  const viewports: Viewport[] = [VP, { vw: 1024, vh: 1280, vmin: 1024 }];

  it("projects back to the authored screen position and size", () => {
    for (const vp of viewports) {
      for (const i of [0, 1, 2, 18, 19]) {
        const off = wrap(i, 0);
        const state = arcSlot(off, vp);
        const seat = seatPx(i, vp);
        const { c } = toCollapse(state, seat, vp);
        const rect = projectCollapse(c, seat, vp);
        const kTz = CAROUSEL.PERSPECTIVE_PX / (CAROUSEL.PERSPECTIVE_PX - state.z);
        expect(rect.cx).toBeCloseTo(state.x, 6);
        expect(rect.cy).toBeCloseTo(state.y, 6);
        expect(rect.w).toBeCloseTo((CAROUSEL.TILE_W_VMIN / 100) * vp.vmin * state.scale * kTz, 6);
        expect(rect.h).toBeCloseTo((CAROUSEL.TILE_H_VMIN / 100) * vp.vmin * state.scale * kTz, 6);
      }
    }
  });

  it("reproduces the worked example from the geometry note (off +2 at 1440x900)", () => {
    const state = arcSlot(2, VP);
    const seat = seatPx(2, VP);
    const { c, cxCard, cyCard } = toCollapse(state, seat, VP);
    expect(state.x).toBeCloseTo(1378.993, 3);
    expect(state.y).toBeCloseTo(-278.115, 3);
    expect(c.rotZ).toBeCloseTo(-9, 9);
    expect(c.tz).toBe(-640);
    expect(cxCard).toBeCloseTo(960.247, 2);
    expect(cyCard).toBeCloseTo(-1060.968, 2);
    // homeTangentDeg = seat.rotate + c.rotZ = absolute slot rotation
    expect(seat.rotateDeg + c.rotZ).toBeCloseTo(27, 9);
  });

  it("holds at mid-transition states too", () => {
    for (const i of [0, 5, 13]) {
      const off = wrap(i, 0);
      const state = cardState(off, 0.5, VP);
      const seat = seatPx(i, VP);
      const { c } = toCollapse(state, seat, VP);
      const rect = projectCollapse(c, seat, VP);
      expect(rect.cx).toBeCloseTo(state.x, 6);
      expect(rect.cy).toBeCloseTo(state.y, 6);
    }
  });
});

describe("collapseTransform", () => {
  it("emits the deck transform chain with rotateX in the rotateY slot", () => {
    const seat = seatPx(0, VP);
    const { c, cxCard, cyCard } = toCollapse(arcSlot(0, VP), seat, VP);
    const t = collapseTransform(cxCard, cyCard, c, seat);
    expect(t).toMatch(
      /^translate\(.+px, .+px\) translateZ\(.+px\) rotateX\(.+deg\) scale\(.+\) rotate\(.+deg\) translate\(.+px, .+px\)$/,
    );
    expect(t).toContain("translateZ(60px)");
    expect(t).toContain("rotateX(0deg)");
  });
});
