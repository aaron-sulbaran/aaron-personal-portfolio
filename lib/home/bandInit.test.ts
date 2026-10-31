import { describe, expect, it } from "vitest";
import { BAND_ANSWER_ATTRIBUTE, SOUNDTRACK_STORAGE_KEY, bandInitScript } from "@/lib/home/bandInit";

// The head script, run against a stub of the page.
function run(stored: string | null | "throws") {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const localStorage = {
    getItem: (key: string) => {
      if (stored === "throws") throw new Error("SecurityError");
      return key === SOUNDTRACK_STORAGE_KEY ? stored : null;
    },
  };
  new Function("document", "localStorage", bandInitScript())(document, localStorage);
  return attrs;
}

describe("the band's head script", () => {
  it("marks <html> with the stored answer before paint, a yes as on and a Not now as off", () => {
    expect(run("on").get(BAND_ANSWER_ATTRIBUTE)).toBe("on");
    expect(run("off").get(BAND_ANSWER_ATTRIBUTE)).toBe("off");
  });

  it("marks nothing on a first visit, for a value it does not know, or when storage is blocked", () => {
    expect(run(null).size).toBe(0);
    expect(run("maybe").size).toBe(0);
    expect(run("").size).toBe(0);
    expect(run("throws").size).toBe(0);
  });

  it("reads the key the soundtrack writes", () => {
    expect(SOUNDTRACK_STORAGE_KEY).toBe("aaron-soundtrack");
  });
});
