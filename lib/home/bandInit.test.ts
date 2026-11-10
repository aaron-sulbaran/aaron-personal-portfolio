import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { bandLayersShown } from "@/lib/home/bandLayers";
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

const GLOBALS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const { listen } = siteContent;

describe("the band on every visit", () => {
  it("never hides the question for an answer, and hides Not now only for a stored Not now, before the band restores", () => {
    expect(GLOBALS).not.toMatch(/\[data-band-question\]\s*\{[^}]*display:\s*none/);
    // Not now goes for a stored Not now alone: the layer rules never mention a stored yes.
    expect(GLOBALS).toContain('html[data-band-answer="off"] [data-band-state="before"] [data-band-layer="decline"] { opacity: 0 !important; pointer-events: none; }');
    expect(GLOBALS).not.toMatch(/html\[data-band-answer="on"\][^{]*data-band-layer="decline"/);
    expect(GLOBALS).not.toMatch(/html\[data-band-answer\]\s+\[data-band-state="before"\]\s+\[data-band-layer="decline"\]/);
  });

  it("draws a stored Not now on Play it and a stored yes on Resume, before the band restores", () => {
    expect(GLOBALS).toContain('html[data-band-answer="off"] [data-band-state="before"] [data-band-layer="off"]');
    expect(GLOBALS).toContain('html[data-band-answer="on"] [data-band-state="before"] [data-band-layer="paused"]');
    expect(GLOBALS).toContain('html[data-band-answer] [data-band-state="before"] [data-band-layer="before"] { opacity: 0 !important; }');
  });

  it("asks the same question with the same words on a returning visit, in its own key so another title is one string", () => {
    expect(listen.line).toBe("Want some music while you scroll?");
    expect(listen.lineReturning).toBe(listen.line);
  });

  it("reads Play it for a first visit and a stored Not now, and Resume for a stored yes", () => {
    expect([listen.accept, listen.resume]).toEqual(["Play it", "Resume"]);
  });
});

describe("which band layers show", () => {
  it("offers Play it and Not now before an answer", () => {
    expect(bandLayersShown("before", false)).toEqual({ before: true, on: false, paused: false, off: false, decline: true });
  });

  it("offers Resume and Not now for a stored yes, which restores as paused", () => {
    expect(bandLayersShown("paused", false)).toEqual({ before: false, on: false, paused: true, off: false, decline: true });
  });

  it("offers Play it alone after a Not now, this visit or a stored one: Not now is gone", () => {
    expect(bandLayersShown("off", false)).toEqual({ before: false, on: false, paused: false, off: true, decline: false });
  });

  it("shows only Pause while the music plays", () => {
    expect(bandLayersShown("on", false)).toEqual({ before: false, on: true, paused: false, off: false, decline: false });
  });

  it("closes the controls up when the player is in the band: Pause, Resume and Not now go", () => {
    expect(bandLayersShown("on", true)).toEqual({ before: false, on: false, paused: false, off: false, decline: false });
    expect(bandLayersShown("paused", true)).toEqual({ before: false, on: false, paused: false, off: false, decline: false });
  });

  it("keeps the first-visit and declined choices whatever the player does", () => {
    expect(bandLayersShown("before", true).decline).toBe(true);
    expect(bandLayersShown("off", true)).toMatchObject({ off: true, decline: false });
  });

  it("shows exactly one play layer per state, so the band never draws two choices over each other", () => {
    for (const music of ["before", "on", "paused", "off"] as const) {
      for (const playerOwns of [false, true]) {
        const shown = bandLayersShown(music, playerOwns);
        const playLayers = [shown.before, shown.on, shown.paused, shown.off];
        expect(playLayers.filter(Boolean).length, `${music} ${playerOwns}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("after a Not now", () => {
  it("says so: the question gives way to the declined line, in its own copy key, and Play it stays", () => {
    expect(listen.lineDeclined).toBe("If you change your mind, play it here");
    expect(listen.lineDeclined).not.toBe(listen.line);
    expect(bandLayersShown("off", false)).toMatchObject({ off: true, decline: false });
  });

  it("swaps the title for a stored Not now from the first paint, off the attribute the head script already sets, and once the state is off", () => {
    expect(GLOBALS).toContain('html[data-band-answer="off"] [data-band-state="before"] [data-band-title="declined"]');
    expect(GLOBALS).toContain('[data-band-state="off"] [data-band-title="declined"]');
    expect(GLOBALS).toContain('html[data-band-answer="off"] [data-band-state="before"] [data-band-title="first"]');
    expect(GLOBALS).toContain('[data-band-state="off"] [data-band-title="first"]');
    // The declined line is drawn for no other state, and only the stored answer "off" brings it: a stored yes keeps the question.
    expect(GLOBALS).toMatch(/\[data-band-title="declined"\] \{ display: none; \}/);
    expect(GLOBALS).not.toMatch(/html\[data-band-answer="on"\][^{]*data-band-title="declined"/);
  });

  it("only swaps words and layers, so nothing in the band shifts: the question's element and the controls keep their place", () => {
    const rules = GLOBALS.slice(GLOBALS.indexOf("After a Not now, this visit or a stored one"), GLOBALS.indexOf("The MVP unfurl"));
    for (const property of ["width", "height", "padding", "margin", "position", "font-size", "letter-spacing"]) {
      expect(rules, property).not.toMatch(new RegExp(`(^|[;\\s{])${property}\\s*:`));
    }
  });

  it("reaches the head script through the same attribute, with no second mechanism", () => {
    expect(bandInitScript()).toContain(BAND_ANSWER_ATTRIBUTE);
    expect(GLOBALS.match(/data-band-answer/g)?.length).toBeGreaterThan(1);
  });
});
