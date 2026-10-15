import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, exportValues, parseSettings, sameSettings, SETTINGS_KEY } from "./settings";
import { DEFAULT_TEXTS, parseTexts, yearLines } from "./texts";

describe("quick lab settings", () => {
  it("are versioned for round 4, so an older draft never overrides the MVP title", () => {
    expect(SETTINGS_KEY).toBe("lab-quick-v5");
  });

  it("default to the unfold, 600ms after the page settles and 120ms between the three", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ titleMode: "unfold", unfoldDelayMs: 600, unfoldStaggerMs: 120 });
  });

  it("keep a readable title mode and clamp the unfold's timings to the sliders", () => {
    expect(parseSettings(JSON.stringify({ titleMode: "spelled" })).titleMode).toBe("spelled");
    expect(parseSettings(JSON.stringify({ titleMode: "marquee" })).titleMode).toBe("unfold");
    const wild = parseSettings(JSON.stringify({ unfoldDelayMs: 99999, unfoldStaggerMs: -4 }));
    expect(wild.unfoldDelayMs).toBe(3000);
    expect(wild.unfoldStaggerMs).toBe(0);
    expect(parseSettings(JSON.stringify({ unfoldDelayMs: "slow" })).unfoldDelayMs).toBe(600);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, titleMode: "spelled" })).toBe(false);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, unfoldStaggerMs: 130 })).toBe(false);
  });

  it("fall back to the defaults for anything unreadable", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ variant: "spine", speed: "fast", reduced: 1 }))).toEqual(DEFAULT_SETTINGS);
  });

  it("keep what they can read and clamp the speed", () => {
    const parsed = parseSettings(JSON.stringify({ variant: "trip", speed: 9, reduced: true }));
    expect(parsed.variant).toBe("trip");
    expect(parsed.speed).toBe(3);
    expect(parsed.reduced).toBe(true);
    expect(sameSettings(parsed, { ...parsed })).toBe(true);
    expect(sameSettings(parsed, DEFAULT_SETTINGS)).toBe(false);
  });

  it("keep edited words, and the content's own for anything missing", () => {
    const parsed = parseSettings(JSON.stringify({ texts: { intro: "Fast lane", years: { "2023": "Edited.", "1999": "Never." }, closing: 4 } }));
    expect(parsed.texts.intro).toBe("Fast lane");
    expect(parsed.texts.closing).toBe(DEFAULT_TEXTS.closing);
    expect(parsed.texts.years["2023"]).toBe("Edited.");
    expect(parsed.texts.years["2021"]).toBe(DEFAULT_TEXTS.years["2021"]);
    expect(parsed.texts.years["1999"]).toBeUndefined();
    expect(parsed.texts.closing).toBe(DEFAULT_TEXTS.closing);
    expect(yearLines(parsed.texts).find((row) => row.year === "2023")!.line).toBe("Edited.");
    expect(parseTexts(null)).toEqual(DEFAULT_TEXTS);
  });

  it("export the words with the rest of the values", () => {
    const values = exportValues(DEFAULT_SETTINGS, "dark", "line");
    expect(values).toMatchObject({ lab: "quick", round: 4, variant: "rail", theme: "dark", invite: "line" });
    expect(values.texts).toEqual(DEFAULT_TEXTS);
  });
});
