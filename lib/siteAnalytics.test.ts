import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAnalytics } from "@/components/SiteAnalytics";

describe("ensureAnalytics", () => {
  const appended: unknown[] = [];

  beforeEach(() => {
    appended.length = 0;
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      head: { querySelector: () => null, appendChild: (node: unknown) => appended.push(node) },
      createElement: () => ({ dataset: {} }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defines window.va so track() has somewhere to queue when the layout never mounted", () => {
    expect((window as { va?: unknown }).va).toBeUndefined();
    ensureAnalytics();
    expect(typeof (window as { va?: unknown }).va).toBe("function");
  });

  it("is safe to call twice", () => {
    ensureAnalytics();
    expect(() => ensureAnalytics()).not.toThrow();
    expect(typeof (window as { va?: unknown }).va).toBe("function");
  });
});
