import { describe, expect, it } from "vitest";
import { TIP_IDLE, tipMode, tipReducer, type TipEvent, type TipState } from "@/lib/inline/tipState";
const rango = { kind: "tip" as const, key: "aango" };
const matcha = { kind: "pop" as const, key: "matcha" };
const run = (...events: TipEvent[]) => events.reduce<TipState>(tipReducer, TIP_IDLE);
describe("tipReducer", () => {
  it("shows on hover, follows, and leaves with the pointer", () => {
    expect(run({ type: "hover", target: rango })).toEqual({ target: rango, via: "hover" });
    expect(tipMode(run({ type: "hover", target: rango }))).toBe("follow");
    expect(run({ type: "hover", target: rango }, { type: "unhover" })).toEqual(TIP_IDLE);
  });
  it("anchors on focus, keeps it under a passing mouse, hides on blur", () => {
    expect(tipMode(run({ type: "focus", target: rango }))).toBe("anchor");
    expect(run({ type: "focus", target: rango }, { type: "hover", target: rango }, { type: "unhover" })).toEqual({ target: rango, via: "focus" });
    expect(run({ type: "focus", target: rango }, { type: "blur" })).toEqual(TIP_IDLE);
  });
  it("toggles on a keyboard press", () => {
    expect(run({ type: "focus", target: rango }, { type: "press", target: rango })).toEqual(TIP_IDLE);
    expect(run({ type: "focus", target: rango }, { type: "dismiss" }, { type: "press", target: rango })).toEqual({ target: rango, via: "focus" });
  });
  it("pins on a tap until a second tap, moves to another tapped link, ignores hover and blur", () => {
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: matcha })).toEqual(TIP_IDLE);
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: rango })).toEqual({ target: rango, via: "tap" });
    expect(run({ type: "tap", target: matcha }, { type: "hover", target: rango }, { type: "blur" })).toEqual({ target: matcha, via: "tap" });
  });
  it("lets anything go on dismiss and keeps the same idle object", () => {
    expect(run({ type: "tap", target: matcha }, { type: "dismiss" })).toEqual(TIP_IDLE);
    expect(tipReducer(TIP_IDLE, { type: "dismiss" })).toBe(TIP_IDLE);
    expect(tipMode(TIP_IDLE)).toBeNull();
  });
});
