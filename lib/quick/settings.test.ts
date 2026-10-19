import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, exportValues, parseSettings, sameSettings, SETTINGS_KEY } from "./settings";
import { DEFAULT_TEXTS, parseTexts, yearLines } from "./texts";

describe("quick lab settings", () => {
  it("are versioned for round 6, so an older draft never overrides the what's-next placement", () => {
    expect(SETTINGS_KEY).toBe("lab-quick-v7");
  });

  it("default to the unfold, 600ms after the title is in view, 120ms between the three and 800ms each", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ titleMode: "unfold", unfoldDelayMs: 600, unfoldStaggerMs: 120, unfoldDurationMs: 800 });
  });

  it("keep a readable title mode and clamp the unfold's timings to the sliders", () => {
    expect(parseSettings(JSON.stringify({ titleMode: "spelled" })).titleMode).toBe("spelled");
    expect(parseSettings(JSON.stringify({ titleMode: "marquee" })).titleMode).toBe("unfold");
    const wild = parseSettings(JSON.stringify({ unfoldDelayMs: 99999, unfoldStaggerMs: -4, unfoldDurationMs: 5 }));
    expect(wild.unfoldDelayMs).toBe(3000);
    expect(wild.unfoldStaggerMs).toBe(0);
    expect(wild.unfoldDurationMs).toBe(200);
    expect(parseSettings(JSON.stringify({ unfoldDelayMs: "slow" })).unfoldDelayMs).toBe(600);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, titleMode: "spelled" })).toBe(false);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, unfoldStaggerMs: 130 })).toBe(false);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, unfoldDurationMs: 900 })).toBe(false);
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
    const parsed = parseSettings(JSON.stringify({ texts: { intro: "Fast lane", years: { "2023": "Edited.", "1999": "Never." }, customShort: 4, tipBack: "Back via the menu." } }));
    expect(parsed.texts.intro).toBe("Fast lane");
    expect(parsed.texts.customShort).toBe(DEFAULT_TEXTS.customShort);
    expect(parsed.texts.tipBack).toBe("Back via the menu.");
    expect(parsed.texts.years["2023"]).toBe("Edited.");
    expect(parsed.texts.years["2021"]).toBe(DEFAULT_TEXTS.years["2021"]);
    expect(parsed.texts.years["1999"]).toBeUndefined();
    expect(yearLines(parsed.texts).find((row) => row.year === "2023")!.line).toBe("Edited.");
    expect(parseTexts(null)).toEqual(DEFAULT_TEXTS);
  });

  it("default to the two-tracks variant with both A and B on, and read them back", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ nextVariant: "two-tracks", showNextA: true, showLookingB: true });
    const parsed = parseSettings(JSON.stringify({ nextVariant: "custom", showNextA: false, showLookingB: false }));
    expect(parsed).toMatchObject({ nextVariant: "custom", showNextA: false, showLookingB: false });
    expect(parseSettings(JSON.stringify({ nextVariant: "nope", showNextA: "yes" }))).toMatchObject({ nextVariant: "two-tracks", showNextA: true });
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, nextVariant: "builder" })).toBe(false);
    expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, showLookingB: false })).toBe(false);
  });

  it("export the words with the rest of the values", () => {
    const values = exportValues(DEFAULT_SETTINGS, "dark", "line");
    expect(values).toMatchObject({ lab: "quick", round: 6, variant: "rail", theme: "dark", invite: "line" });
    expect(values.texts).toEqual(DEFAULT_TEXTS);
    expect(values).toMatchObject({ nextVariant: "two-tracks", showNextA: true, showLookingB: true });
    expect(values.texts.tipToast).toBe("The MVP is always in the menu if you need it later.");
    expect(values.texts.tipBack).toBe("You can always come back to this from the menu.");
    expect(values.texts.customFull.length).toBeGreaterThan(0);
  });
});
