import { describe, expect, it } from "vitest";
import { dealInitScript } from "@/lib/home/dealInit";

// The head script, run against a stub of the page.
function run(reduced: boolean) {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const window = { matchMedia: () => ({ matches: reduced }) };
  new Function("document", "window", dealInitScript())(document, window);
  return attrs;
}

describe("the deal's head script", () => {
  it("marks the cards section pending before the first paint", () => {
    expect(run(false).get("data-deal")).toBe("pending");
  });

  it("does nothing under reduced motion, so nothing is ever closed", () => {
    expect(run(true).has("data-deal")).toBe(false);
  });

  it("does not throw when the page cannot answer (it must never break the page)", () => {
    const document = { documentElement: { setAttribute: () => { throw new Error("blocked"); } } };
    const window = { matchMedia: () => ({ matches: false }) };
    expect(() => new Function("document", "window", dealInitScript())(document, window)).not.toThrow();
  });

  it("holds no em dash", () => {
    expect(dealInitScript()).not.toContain("—");
  });
});
