import { describe, expect, it } from "vitest";
import { heldFieldS, parseDebugFlags } from "@/lib/coil/debugFlags";

describe("scene debug flags", () => {
  it("reads nothing without the query", () => {
    expect(parseDebugFlags("")).toMatchObject({ debugMode: null, posterMode: false, stillMode: false, pinned: false, heldAt: null });
  });
  it("poster: the empty field, pinned", () => {
    expect(parseDebugFlags("?coildebug=poster")).toMatchObject({ posterMode: true, stillMode: false, pinned: true });
  });
  it("still: the scene at rest with its cards and name, pinned like the poster", () => {
    expect(parseDebugFlags("?coildebug=still")).toMatchObject({
      debugMode: "still", posterMode: false, stillMode: true, pinned: true, hideCards: false, hideName: false,
    });
    expect(parseDebugFlags("?coildebug=handoff, still").stillMode).toBe(true);
    expect(parseDebugFlags("?coildebug=stillness").stillMode).toBe(false);
  });
  it("still takes the conveyor's offset in cards: plain still holds 0, still=<offset> holds that", () => {
    expect(parseDebugFlags("").stillOffset).toBeNull();
    expect(parseDebugFlags("?coildebug=poster").stillOffset).toBeNull();
    expect(parseDebugFlags("?coildebug=still").stillOffset).toBe(0);
    expect(parseDebugFlags("?coildebug=still=0.375")).toMatchObject({ stillMode: true, pinned: true, stillOffset: 0.375 });
    expect(parseDebugFlags("?coildebug=still=-1.25")).toMatchObject({ stillMode: true, pinned: true, stillOffset: -1.25 });
  });
  it("a malformed still offset is not still mode", () => {
    expect(parseDebugFlags("?coildebug=still=abc")).toMatchObject({ stillMode: false, pinned: false, stillOffset: null });
    expect(parseDebugFlags("?coildebug=still=").stillMode).toBe(false);
  });
  it("still=<offset> combines with the other tokens", () => {
    expect(parseDebugFlags("?coildebug=still=0.5,nocards")).toMatchObject({ stillMode: true, stillOffset: 0.5, hideCards: true });
    expect(parseDebugFlags("?coildebug=still,nocards")).toMatchObject({ stillMode: true, stillOffset: 0, hideCards: true });
  });
  it("keeps the other tokens", () => {
    expect(parseDebugFlags("?coildebug=at=3,ink=150,entrance=-200,nocards&drift=calm")).toMatchObject({
      heldAt: 3, inkOverride: 1, forcedEntranceMs: -200, hideCards: true, driftParam: "calm",
    });
  });
  it("holds the field clock at 0 for the poster and the still, else at= or the live clock", () => {
    expect(heldFieldS(parseDebugFlags("?coildebug=still"), 7)).toBe(0);
    expect(heldFieldS(parseDebugFlags("?coildebug=poster"), 7)).toBe(0);
    expect(heldFieldS(parseDebugFlags("?coildebug=at=3"), 7)).toBe(3);
    expect(heldFieldS(parseDebugFlags(""), 7)).toBe(7);
  });
});
