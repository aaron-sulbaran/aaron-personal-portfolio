import { describe, expect, it } from "vitest";
import { introLoaderInitScript } from "@/lib/home/introLoaderInit";
import { HERO_LAB_KEY } from "@/lib/home/introLabKey";
import { HOME_SCROLL_KEY } from "@/lib/scroll";

// The head script, run against a stub of the page.
type Page = { reduced?: boolean; path?: string; hash?: string; savedY?: number | null; height?: number; lab?: string | null; dev?: boolean };

function run({ reduced = false, path = "/", hash = "", savedY = null, height = 800, lab = null, dev = false }: Page = {}) {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const window = { matchMedia: () => ({ matches: reduced }), innerHeight: height };
  const location = { pathname: path, hash };
  const sessionStorage = { getItem: (key: string) => (key === HOME_SCROLL_KEY && savedY !== null ? String(savedY) : null) };
  const localStorage = { getItem: (key: string) => (key === HERO_LAB_KEY ? lab : null) };
  new Function("document", "window", "location", "sessionStorage", "localStorage", introLoaderInitScript(dev))(document, window, location, sessionStorage, localStorage);
  return attrs;
}

describe("the loader's head script", () => {
  it("arms the loader on a fresh load of the home page", () => {
    expect(run().get("data-intro-loader")).toBe("on");
  });

  it("arms nothing under reduced motion, so the name is simply in place", () => {
    expect(run({ reduced: true }).has("data-intro-loader")).toBe(false);
  });

  it("arms nothing off the home page", () => {
    expect(run({ path: "/quick" }).has("data-intro-loader")).toBe(false);
  });

  it("arms nothing on a deep load: a section hash, or a saved position past half a viewport", () => {
    expect(run({ hash: "#work" }).has("data-intro-loader")).toBe(false);
    expect(run({ savedY: 500, height: 800 }).has("data-intro-loader")).toBe(false);
  });

  it("still arms for the skip link's hash and a saved position near the top", () => {
    expect(run({ hash: "#main" }).get("data-intro-loader")).toBe("on");
    expect(run({ savedY: 200, height: 800 }).get("data-intro-loader")).toBe("on");
  });

  it("honors the lab's loader switch in development, and only there", () => {
    expect(run({ dev: true, lab: JSON.stringify({ loaderOn: false }) }).has("data-intro-loader")).toBe(false);
    expect(run({ dev: true, lab: JSON.stringify({ loaderOn: true }) }).get("data-intro-loader")).toBe("on");
    expect(run({ dev: false, lab: JSON.stringify({ loaderOn: false }) }).get("data-intro-loader")).toBe("on");
    expect(introLoaderInitScript(false)).not.toContain(HERO_LAB_KEY);
  });

  it("does not throw when the page cannot answer (it must never break the page)", () => {
    const document = { documentElement: { setAttribute: () => { throw new Error("blocked"); } } };
    const window = { matchMedia: () => ({ matches: false }), innerHeight: 800 };
    const location = { pathname: "/", hash: "" };
    const storage = { getItem: () => null };
    expect(() => new Function("document", "window", "location", "sessionStorage", "localStorage", introLoaderInitScript(false))(document, window, location, storage, storage)).not.toThrow();
  });

  it("holds no em dash", () => {
    expect(introLoaderInitScript(true)).not.toContain("\u2014");
  });
});
