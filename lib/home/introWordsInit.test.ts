import { describe, expect, it } from "vitest";
import { HERO_LAB_KEY } from "@/lib/home/introLabKey";
import { introLoaderInitScript } from "@/lib/home/introLoaderInit";
import { introWordsInitScript } from "@/lib/home/introWordsInit";
import { HOME_SCROLL_KEY } from "@/lib/scroll";

type Page = { reduced?: boolean; path?: string; hash?: string; savedY?: number | null; height?: number; lab?: string | null; dev?: boolean };

function run(source: (dev: boolean) => string, { reduced = false, path = "/", hash = "", savedY = null, height = 800, lab = null, dev = false }: Page = {}) {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const window = { matchMedia: () => ({ matches: reduced }), innerHeight: height };
  const location = { pathname: path, hash };
  const sessionStorage = { getItem: (key: string) => (key === HOME_SCROLL_KEY && savedY !== null ? String(savedY) : null) };
  const localStorage = { getItem: (key: string) => (key === HERO_LAB_KEY ? lab : null) };
  new Function("document", "window", "location", "sessionStorage", "localStorage", source(dev))(document, window, location, sessionStorage, localStorage);
  return attrs;
}

const words = (page?: Page) => run(introWordsInitScript, page).get("data-intro-words");

describe("page 1's words, head script", () => {
  it("holds the words for a fresh load of the home page", () => {
    expect(words()).toBe("wait");
  });

  it("holds nothing under reduced motion, off the home page, or on a deep load", () => {
    expect(words({ reduced: true })).toBeUndefined();
    expect(words({ path: "/quick" })).toBeUndefined();
    expect(words({ hash: "#work" })).toBeUndefined();
    expect(words({ savedY: 500, height: 800 })).toBeUndefined();
  });

  it("holds for the skip link's hash and a saved position near the top", () => {
    expect(words({ hash: "#main" })).toBe("wait");
    expect(words({ savedY: 200, height: 800 })).toBe("wait");
  });

  it("arms on exactly the loads the loader arms on", () => {
    const loads: Page[] = [{}, { reduced: true }, { path: "/quick" }, { hash: "#work" }, { hash: "#main" }, { savedY: 500 }, { savedY: 200 }];
    for (const page of loads) expect(run(introLoaderInitScript, page).has("data-intro-loader")).toBe(words(page) === "wait");
  });

  it("honors the lab's arrival switch in development, and only there", () => {
    expect(words({ dev: true, lab: JSON.stringify({ arrivalOn: false }) })).toBeUndefined();
    expect(words({ dev: true, lab: JSON.stringify({ arrivalOn: true }) })).toBe("wait");
    expect(words({ dev: false, lab: JSON.stringify({ arrivalOn: false }) })).toBe("wait");
    expect(introWordsInitScript(false)).not.toContain(HERO_LAB_KEY);
  });

  it("does not throw when the page cannot answer, and holds no em dash", () => {
    const document = { documentElement: { setAttribute: () => { throw new Error("blocked"); } } };
    const window = { matchMedia: () => ({ matches: false }), innerHeight: 800 };
    const storage = { getItem: () => null };
    expect(() => new Function("document", "window", "location", "sessionStorage", "localStorage", introWordsInitScript(false))(document, window, { pathname: "/", hash: "" }, storage, storage)).not.toThrow();
    expect(introWordsInitScript(true)).not.toContain("—");
  });
});
