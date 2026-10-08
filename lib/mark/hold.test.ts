import { describe, expect, it } from "vitest";
import { HOLD } from "@/lib/mark/constants";
import { HOLD_IDLE, advance, cancel, click, press, release, sample, settle } from "@/lib/mark/hold";

const held = press(HOLD_IDLE, 0, "pointer");

describe("the mark's hold", () => {
  it("carries Aaron's numbers", () => {
    expect(HOLD).toMatchObject({ holdMs: 650, drainMs: 260, minFill: 0.3, tasteMs: 200 });
  });

  it("fills linearly over 650ms, discharges for 140ms, then fires", () => {
    expect(sample(held, 325).fill).toBeCloseTo(0.5, 5);
    expect(advance(held, 650).phase).toBe("discharging");
    expect(sample(held, 650)).toEqual({ fill: 1, spent: 0 });
    expect(sample(held, 720).spent).toBeCloseTo(0.125, 5);
    expect(advance(held, 790).phase).toBe("fired");
    expect(sample(held, 790)).toEqual({ fill: 0, spent: 0 });
  });

  it("gives a quick tap a taste: 0.3 within 90ms, held 200ms, then drained", () => {
    const tap = release(held, 10);
    expect(sample(tap, 100).fill).toBeCloseTo(0.3, 5);
    expect(sample(tap, 299).fill).toBeCloseTo(0.3, 5);
    expect(advance(tap, 300).phase).toBe("draining");
    expect(sample(tap, 339).fill).toBeCloseTo(0.2625, 4);
    expect(advance(tap, 378).phase).toBe("idle");
  });

  it("keeps a longer release's own fill for the taste and drains it in proportion", () => {
    const fill = 300 / 650;
    const late = release(held, 300);
    expect(sample(late, 450).fill).toBeCloseTo(fill, 5);
    expect(advance(late, 500).phase).toBe("draining");
    expect(advance(late, 500 + 260 * fill).phase).toBe("idle");
  });

  it("cancels into a drain with no taste, and ignores release, cancel and press once it has completed", () => {
    const left = cancel(held, 200);
    expect(left.phase).toBe("draining");
    expect(sample(left, 200).fill).toBeCloseTo(200 / 650, 5);
    expect(release(held, 700).phase).toBe("discharging");
    expect(cancel(held, 700).phase).toBe("discharging");
    expect(press(held, 700, "pointer").phase).toBe("discharging");
  });

  it("resumes a press from the fill it finds", () => {
    const tasting = release(held, 10);
    const again = press(tasting, 50, "pointer");
    expect(again.from).toBeCloseTo(sample(tasting, 50).fill, 5);
    expect(sample(again, 375).fill).toBeCloseTo(again.from + 0.5, 5);
  });

  it("swallows one click after a completed pointer hold, none after a keyboard hold, and a new press clears it", () => {
    const fired = settle(advance(held, 800));
    const first = click(fired);
    expect(first.swallow).toBe(true);
    expect(click(first.state).swallow).toBe(false);
    expect(press(fired, 900, "pointer").swallowClick).toBe(false);
    expect(click(settle(advance(press(HOLD_IDLE, 0, "key"), 800))).swallow).toBe(false);
    expect(click(advance(held, 651)).swallow).toBe(true);
  });
});
