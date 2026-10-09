import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getVisited,
  markVisited,
  parseVisited,
  resetVisitedForTests,
  subscribeVisited,
  VISITED_STORAGE_KEY,
  VISITED_STYLE_ID,
  visitedId,
  visitedInitScript,
  visitedStyle,
} from "@/lib/inline/visited";

function fakeStorage(initial: Record<string, string> = {}, failWrites = false) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
  };
}

describe("parseVisited", () => {
  it("reads nothing from nothing, garbage or a non-list", () => {
    expect(parseVisited(null)).toEqual([]);
    expect(parseVisited("")).toEqual([]);
    expect(parseVisited("{not json")).toEqual([]);
    expect(parseVisited('{"def:product":true}')).toEqual([]);
  });
  it("keeps def, tip, pop and https external ids and drops everything else", () => {
    const stored = JSON.stringify(["def:product", "tip:killer-drones", "pop:matcha", "external:https://cal.com/aaron-sulbaran", 7, null, "def:", "def:a b", "def:x\"]{", "external:javascript:alert(1)", "external:https://a.com/\"x", "tip:a/b", "link:product"]);
    expect(parseVisited(stored)).toEqual(["def:product", "tip:killer-drones", "pop:matcha", "external:https://cal.com/aaron-sulbaran"]);
  });
  it("drops repeats and keeps the newest 200", () => {
    const ids = Array.from({ length: 230 }, (_, i) => `tip:key-${i}`);
    const parsed = parseVisited(JSON.stringify([...ids, "tip:key-229", "tip:key-229"]));
    expect(parsed).toHaveLength(200);
    expect(parsed[0]).toBe("tip:key-30");
    expect(parsed.at(-1)).toBe("tip:key-229");
    expect(new Set(parsed).size).toBe(200);
  });
});

describe("visitedId", () => {
  it("names a def, tip or pop by kind and key, and an external link by its href", () => {
    expect(visitedId({ kind: "def", key: "product", href: null })).toBe("def:product");
    expect(visitedId({ kind: "pop", key: "matcha", href: "https://maps.example/matcha" })).toBe("pop:matcha");
    expect(visitedId({ kind: "external", key: undefined, href: "https://cal.com/aaron-sulbaran" })).toBe("external:https://cal.com/aaron-sulbaran");
  });
  it("names nothing it cannot", () => {
    expect(visitedId({ kind: "def", key: undefined, href: null })).toBeNull();
    expect(visitedId({ kind: "external", key: undefined, href: null })).toBeNull();
    expect(visitedId({ kind: undefined, key: "x", href: null })).toBeNull();
  });
});

describe("visitedStyle", () => {
  it("is empty for no links", () => {
    expect(visitedStyle([])).toBe("");
  });
  it("fills every visited link with no tween, with one rule", () => {
    const css = visitedStyle(["def:product", "tip:killer-drones", "pop:matcha"]);
    expect(css).toBe(
      '.inline-link[data-inline="def"][data-inline-key="product"],.inline-link[data-inline="tip"][data-inline-key="killer-drones"],.inline-link[data-inline="pop"][data-inline-key="matcha"]{--inline-p:1;transition:none}',
    );
  });
  it("matches an external link by its exact href, escaping quotes and backslashes", () => {
    expect(visitedStyle(["external:https://cal.com/aaron-sulbaran"])).toContain('[data-inline="external"][href="https://cal.com/aaron-sulbaran"]');
    expect(visitedStyle(["external:https://a.com/x?q=1&r=2"])).toContain('[href="https://a.com/x?q=1&r=2"]');
    expect(visitedStyle(["external:https://a.com/\\\""])).toContain('[href="https://a.com/\\\\\\""]');
  });
});

describe("the visited store", () => {
  beforeEach(() => resetVisitedForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("starts empty with no storage at all", () => {
    expect(getVisited().size).toBe(0);
    markVisited("def:product");
    expect(getVisited().has("def:product")).toBe(true);
  });
  it("reads what an earlier visit stored", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [VISITED_STORAGE_KEY]: JSON.stringify(["def:product", "bogus"]) }));
    expect(Array.from(getVisited())).toEqual(["def:product"]);
  });
  it("persists a click, tells subscribers once, and ignores a repeat", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    const listener = vi.fn();
    const unsubscribe = subscribeVisited(listener);
    markVisited("pop:matcha");
    markVisited("pop:matcha");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data.get(VISITED_STORAGE_KEY)!)).toEqual(["pop:matcha"]);
    unsubscribe();
    markVisited("def:product");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data.get(VISITED_STORAGE_KEY)!)).toEqual(["pop:matcha", "def:product"]);
  });
  it("refuses an id the stylesheet could not match", () => {
    markVisited('def:x"]{');
    expect(getVisited().size).toBe(0);
  });
  it("degrades to this page view when storage throws, on read or on write", () => {
    vi.stubGlobal("localStorage", fakeStorage({}, true));
    expect(() => markVisited("tip:killer-drones")).not.toThrow();
    expect(getVisited().has("tip:killer-drones")).toBe(true);
    resetVisitedForTests();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } });
    expect(getVisited().size).toBe(0);
    expect(() => markVisited("def:product")).not.toThrow();
    expect(getVisited().has("def:product")).toBe(true);
  });
});

describe("visitedInitScript", () => {
  const run = (localStorage: unknown) => {
    const appended: Array<{ id: string; textContent: string }> = [];
    const document = {
      createElement: () => ({ id: "", textContent: "" }),
      head: { appendChild: (element: { id: string; textContent: string }) => void appended.push(element) },
    };
    runInNewContext(visitedInitScript, { localStorage, document });
    return appended;
  };
  it("writes the visited rule into the head before paint", () => {
    const [style] = run(fakeStorage({ [VISITED_STORAGE_KEY]: JSON.stringify(["def:product", "external:https://cal.com/aaron-sulbaran"]) }));
    expect(style.id).toBe(VISITED_STYLE_ID);
    expect(style.textContent).toBe(visitedStyle(["def:product", "external:https://cal.com/aaron-sulbaran"]));
  });
  it("writes nothing when nothing was clicked, and never throws on blocked storage", () => {
    expect(run(fakeStorage())).toEqual([]);
    expect(run({ getItem: () => { throw new Error("SecurityError"); } })).toEqual([]);
    expect(run(undefined)).toEqual([]);
  });
});
