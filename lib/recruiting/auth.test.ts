import { describe, expect, it } from "vitest";
import { keyMatches, signSession, timingSafeEqual, verifySession } from "./auth";

const KEY = "correct-horse-battery-staple-2026";

describe("recruiting session cookie", () => {
  it("signs deterministically for one key and differently for another", async () => {
    const a = await signSession(KEY);
    const b = await signSession(KEY);
    const c = await signSession(KEY + "x");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(c).not.toBe(a);
  });

  it("verifies only the exact signature under the current key", async () => {
    const sig = await signSession(KEY);
    expect(await verifySession(sig, KEY)).toBe(true);
    expect(await verifySession(sig, "rotated-key")).toBe(false);
    expect(await verifySession(sig.slice(0, -1) + "0", KEY)).toBe(false);
    expect(await verifySession(sig.toUpperCase(), KEY)).toBe(false);
    expect(await verifySession(undefined, KEY)).toBe(false);
    expect(await verifySession("", KEY)).toBe(false);
  });

  it("never opens when the server has no key configured", async () => {
    const sig = await signSession(KEY);
    expect(await verifySession(sig, undefined)).toBe(false);
    expect(await verifySession(sig, "")).toBe(false);
    expect(keyMatches(KEY, undefined)).toBe(false);
    expect(keyMatches(KEY, "")).toBe(false);
  });

  it("matches the unlock key exactly", () => {
    expect(keyMatches(KEY, KEY)).toBe(true);
    expect(keyMatches(KEY + " ", KEY)).toBe(false);
    expect(keyMatches(KEY.slice(1), KEY)).toBe(false);
    expect(keyMatches(null, KEY)).toBe(false);
    expect(keyMatches("", KEY)).toBe(false);
  });

  it("timingSafeEqual handles unequal lengths without throwing", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "a")).toBe(false);
    expect(timingSafeEqual("a", "")).toBe(false);
  });
});
