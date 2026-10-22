import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { dealInitScript } from "@/lib/home/dealInit";
import { settleScript, settleStartScale } from "@/lib/home/settle";

const margin = COIL.deal.settle.marginPx;
const ask = COIL.deal.settle.startScale;

describe("the name's settle start scale", () => {
  it("is the asked scale when there is room to spare", () => {
    expect(settleStartScale({ requested: ask, reachPx: 640, leftPx: 120, viewportWidth: 1440, marginPx: margin })).toBe(ask);
  });

  it("is capped so the ink never crosses the viewport's right edge", () => {
    const scale = settleStartScale({ requested: 2, reachPx: 300, leftPx: 23, viewportWidth: 390, marginPx: margin });
    expect(scale).toBeCloseTo((390 - margin - 23) / 300, 9);
    expect(23 + 300 * scale).toBeLessThanOrEqual(390 - margin + 1e-9);
  });

  it("never goes under 1x, even when the ink already fills the width", () => {
    expect(settleStartScale({ requested: 1.5, reachPx: 400, leftPx: 20, viewportWidth: 400, marginPx: margin })).toBe(1);
    expect(settleStartScale({ requested: 1.5, reachPx: 500, leftPx: 20, viewportWidth: 400, marginPx: margin })).toBe(1);
  });

  it("does not scale what it could not measure", () => {
    expect(settleStartScale({ requested: ask, reachPx: 0, leftPx: 20, viewportWidth: 400, marginPx: margin })).toBe(1);
  });
});

// The scripts, run against a stub of the page: the head script marks the deal
// pending (unless reduced motion), the body script sets the settle's scale by
// the same rule as settleStartScale.
type Stub = ReturnType<typeof stubPage>;

function stubPage({ reduced = false, deal = null as string | null, left = 100, reach = 600, clientWidth = 1440 } = {}) {
  const rootAttrs = new Map<string, string>();
  const rootVars = new Map<string, string>();
  if (deal) rootAttrs.set("data-deal", deal);
  const heading = {
    vars: new Map<string, string>(),
    attrs: new Map<string, string>(),
    style: { setProperty(name: string, value: string) { heading.vars.set(name, value); } },
    setAttribute(name: string, value: string) { heading.attrs.set(name, value); },
    getBoundingClientRect: () => ({ left, right: left + reach }),
  };
  const document = {
    documentElement: {
      clientWidth,
      getAttribute: (name: string) => rootAttrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => void rootAttrs.set(name, value),
      style: { setProperty: (name: string, value: string) => void rootVars.set(name, value) },
    },
    getElementById: (id: string) => (id === "intro-heading" ? heading : null),
    createRange: () => ({ selectNodeContents() {}, getBoundingClientRect: () => ({ left, right: left + reach }) }),
  };
  const window = { matchMedia: () => ({ matches: reduced }) };
  return { document, window, rootAttrs, rootVars, heading };
}

function run(script: string, page: Stub) {
  new Function("document", "window", script)(page.document, page.window);
}

describe("the deal's head script", () => {
  it("marks the cards section pending and sets the settle's timing", () => {
    const page = stubPage();
    run(dealInitScript(), page);
    expect(page.rootAttrs.get("data-deal")).toBe("pending");
    expect(page.rootVars.get("--settle-ms")).toBe(`${COIL.deal.settle.ms}ms`);
    expect(page.rootVars.get("--settle-delay")).toBe(`${COIL.deal.settle.delayMs}ms`);
  });

  it("does nothing under reduced motion", () => {
    const page = stubPage({ reduced: true });
    run(dealInitScript(), page);
    expect(page.rootAttrs.has("data-deal")).toBe(false);
  });

  it("holds no em dash", () => {
    expect(dealInitScript()).not.toContain("—");
    expect(settleScript()).not.toContain("—");
  });
});

describe("the settle script after the h1", () => {
  it("sets the asked scale and starts the settle when the ink has room", () => {
    const page = stubPage({ deal: "pending" });
    run(settleScript(), page);
    expect(page.heading.vars.get("--settle-from")).toBe(ask.toFixed(3));
    expect(page.heading.attrs.get("data-settle")).toBe("run");
  });

  it("caps the scale on a narrow page by the same rule as the function", () => {
    const page = stubPage({ deal: "pending", left: 23, reach: 360, clientWidth: 390 });
    run(settleScript(), page);
    const expected = settleStartScale({ requested: ask, reachPx: 360, leftPx: 23, viewportWidth: 390, marginPx: margin });
    expect(Number(page.heading.vars.get("--settle-from"))).toBeCloseTo(expected, 3);
    expect(expected).toBeLessThan(ask);
  });

  it("leaves the heading still when the deal is not pending (reduced motion, a client navigation)", () => {
    for (const deal of [null, "closed", "dealt"]) {
      const page = stubPage({ deal });
      run(settleScript(), page);
      expect(page.heading.attrs.has("data-settle")).toBe(false);
    }
  });
});
