import { describe, expect, it } from "vitest";
import { SLOT_CLOSED, SLOT_KEY, slotInitScript } from "@/lib/home/slotInit";
import { HOME_SCROLL_KEY } from "@/lib/scroll";

// The head script, run against a stub of the page.
type Page = { reduced?: boolean; path?: string; hash?: string; savedY?: number | null; slotState?: string | null; height?: number; webgl2?: boolean };

function run({ reduced = false, path = "/", hash = "", savedY = null, slotState = null, height = 800, webgl2 = true }: Page = {}) {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const window = { matchMedia: () => ({ matches: reduced }), innerHeight: height };
  const location = { pathname: path, hash };
  const sessionStorage = {
    getItem: (key: string) => (key === HOME_SCROLL_KEY && savedY !== null ? String(savedY) : key === SLOT_KEY ? slotState : null),
  };
  new Function("document", "window", "location", "sessionStorage", "WebGL2RenderingContext", slotInitScript())(document, window, location, sessionStorage, webgl2 ? class {} : undefined);
  return attrs;
}

describe("the ribbon slot's head script", () => {
  it("closes the slot before paint on a link into the cards section", () => {
    expect(run({ hash: "#work" }).get("data-slot")).toBe("closed");
  });

  it("leaves it open for the pages whose loads do not deal, page 1's own hash, the skip link's hash and a plain load", () => {
    for (const hash of ["#numbers", "#connect", "#about"]) expect(run({ hash }).has("data-slot"), hash).toBe(false);
    expect(run({ hash: "#main" }).has("data-slot")).toBe(false);
    expect(run().has("data-slot")).toBe(false);
  });

  it("closes it on a reload deep in the page only when the saved position was saved with the slot closed", () => {
    expect(run({ savedY: 1600, slotState: SLOT_CLOSED }).get("data-slot")).toBe("closed");
    expect(run({ savedY: 1600, slotState: "open" }).has("data-slot")).toBe(false);
    expect(run({ savedY: 1600 }).has("data-slot")).toBe(false);
    expect(run({ savedY: 300, slotState: SLOT_CLOSED, height: 800 }).has("data-slot")).toBe(false);
  });

  it("lets a hash decide over the saved position", () => {
    expect(run({ hash: "#about", savedY: 1600, slotState: SLOT_CLOSED }).has("data-slot")).toBe(false);
    expect(run({ hash: "#work", savedY: 0 }).get("data-slot")).toBe("closed");
  });

  it("predicts nothing where the scene cannot come: reduced motion, no WebGL 2 API, any page but the home", () => {
    expect(run({ hash: "#work", reduced: true }).has("data-slot")).toBe(false);
    expect(run({ hash: "#work", webgl2: false }).has("data-slot")).toBe(false);
    expect(run({ hash: "#work", path: "/quick" }).has("data-slot")).toBe(false);
  });

  it("does not throw when the page cannot answer (it must never break the page)", () => {
    const document = { documentElement: { setAttribute: () => { throw new Error("blocked"); } } };
    const window = { matchMedia: () => ({ matches: false }), innerHeight: 800 };
    const location = { pathname: "/", hash: "#work" };
    const storage = { getItem: () => null };
    expect(() => new Function("document", "window", "location", "sessionStorage", "WebGL2RenderingContext", slotInitScript())(document, window, location, storage, class {})).not.toThrow();
  });

  it("holds no em dash", () => {
    expect(slotInitScript()).not.toContain("\u2014");
  });
});
