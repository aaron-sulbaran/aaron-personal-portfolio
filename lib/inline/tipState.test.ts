import { describe, expect, it } from "vitest";
import { TIP_GRACE_MS, TIP_IDLE, tipMode, tipReducer, type TipEvent, type TipState } from "@/lib/inline/tipState";
const drones = { kind: "tip" as const, key: "killer-drones" };
const voltaage = { kind: "tip" as const, key: "voltaage" };
const matcha = { kind: "pop" as const, key: "matcha" };
const run = (...events: TipEvent[]) => events.reduce<TipState>(tipReducer, TIP_IDLE);
describe("tipReducer", () => {
  it("shows on hover, follows, and leaves with the pointer", () => {
    expect(run({ type: "hover", target: drones })).toEqual({ target: drones, via: "hover" });
    expect(tipMode(run({ type: "hover", target: drones }))).toBe("follow");
    expect(run({ type: "hover", target: drones }, { type: "unhover" })).toEqual(TIP_IDLE);
  });
  it("anchors on focus, keeps it under a passing mouse, hides on blur", () => {
    expect(tipMode(run({ type: "focus", target: drones }))).toBe("anchor");
    expect(run({ type: "focus", target: drones }, { type: "hover", target: drones }, { type: "unhover" })).toEqual({ target: drones, via: "focus" });
    expect(run({ type: "focus", target: drones }, { type: "blur" })).toEqual(TIP_IDLE);
  });
  it("toggles on a keyboard press", () => {
    expect(run({ type: "focus", target: drones }, { type: "press", target: drones })).toEqual(TIP_IDLE);
    expect(run({ type: "focus", target: drones }, { type: "dismiss" }, { type: "press", target: drones })).toEqual({ target: drones, via: "focus" });
  });
  it("pins on a tap until a second tap, moves to another tapped link, ignores hover and blur", () => {
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: matcha })).toEqual(TIP_IDLE);
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: drones })).toEqual({ target: drones, via: "tap" });
    expect(run({ type: "tap", target: matcha }, { type: "hover", target: drones }, { type: "blur" })).toEqual({ target: matcha, via: "tap" });
  });
  it("lets anything go on dismiss and keeps the same idle object", () => {
    expect(run({ type: "tap", target: matcha }, { type: "dismiss" })).toEqual(TIP_IDLE);
    expect(tipReducer(TIP_IDLE, { type: "dismiss" })).toBe(TIP_IDLE);
    expect(tipMode(TIP_IDLE)).toBeNull();
  });
  it("gives a linked tip's pointer a grace to reach the label: leaving starts it, arriving takes it back, expiry lets go", () => {
    const grace = run({ type: "hover", target: voltaage }, { type: "leave" });
    expect(grace).toEqual({ target: voltaage, via: "grace" });
    expect(run({ type: "hover", target: voltaage }, { type: "leave" }, { type: "hover", target: voltaage })).toEqual({ target: voltaage, via: "hover" });
    expect(tipReducer(grace, { type: "expire" })).toEqual(TIP_IDLE);
    expect(TIP_GRACE_MS).toBeGreaterThan(100);
    expect(TIP_GRACE_MS).toBeLessThan(500);
  });
  it("leaves graceless states alone: leave and expire only touch a hover and a grace", () => {
    const focused = run({ type: "focus", target: voltaage });
    const tapped = run({ type: "tap", target: voltaage });
    expect(tipReducer(focused, { type: "leave" })).toBe(focused);
    expect(tipReducer(tapped, { type: "leave" })).toBe(tapped);
    expect(tipReducer(focused, { type: "expire" })).toBe(focused);
    expect(tipReducer(TIP_IDLE, { type: "leave" })).toBe(TIP_IDLE);
    expect(run({ type: "hover", target: voltaage }, { type: "leave" }, { type: "dismiss" })).toEqual(TIP_IDLE);
  });
  it("keeps a linked tip under its word, hover included, while a plain tip trails the pointer", () => {
    expect(tipMode(run({ type: "hover", target: voltaage }), true)).toBe("anchor");
    expect(tipMode(run({ type: "hover", target: voltaage }, { type: "leave" }), true)).toBe("anchor");
    expect(tipMode(run({ type: "hover", target: drones }), false)).toBe("follow");
  });
});
