import { describe, expect, it } from "vitest";
import { BACK_UP, CREDIT, DEFAULT_SETTINGS, drawsPlayer, exportValues, INTO_ISLE, ISLE_LINE, ON_PLAY, parseSettings, PHONE, SETTINGS_KEY } from "./settings";

describe("the player lab's settings", () => {
  it("default to today's behavior, with the lab off", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ enabled: false, onPlay: "today", intoIsle: "today", credit: "band", phone: "band" });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("fall back to the defaults for a broken save", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("42")).toEqual(DEFAULT_SETTINGS);
  });

  it("start every option on a value the lab offers", () => {
    expect(ON_PLAY).toContain(DEFAULT_SETTINGS.onPlay);
    expect(INTO_ISLE).toContain(DEFAULT_SETTINGS.intoIsle);
    expect(BACK_UP).toContain(DEFAULT_SETTINGS.backUp);
    expect(CREDIT).toContain(DEFAULT_SETTINGS.credit);
    expect(PHONE).toContain(DEFAULT_SETTINGS.phone);
    expect(DEFAULT_SETTINGS.isleLine).toBeGreaterThanOrEqual(ISLE_LINE.min);
    expect(DEFAULT_SETTINGS.isleLine).toBeLessThanOrEqual(ISLE_LINE.max);
  });

  it("keep good values and replace bad ones one field at a time", () => {
    const read = parseSettings(JSON.stringify({ enabled: true, onPlay: "sheet", intoIsle: "sideways", credit: "player", isleLine: 7, phone: 3 }));
    expect(read.enabled).toBe(true);
    expect(read.onPlay).toBe("sheet");
    expect(read.intoIsle).toBe("today");
    expect(read.credit).toBe("player");
    expect(read.isleLine).toBe(ISLE_LINE.max);
    expect(read.phone).toBe("band");
  });

  it("clamp the hand-off line into its range", () => {
    expect(parseSettings(JSON.stringify({ isleLine: -2 })).isleLine).toBe(ISLE_LINE.min);
    expect(parseSettings(JSON.stringify({ isleLine: 0.55 })).isleLine).toBe(0.55);
    expect(parseSettings(JSON.stringify({ isleLine: "high" })).isleLine).toBe(DEFAULT_SETTINGS.isleLine);
  });

  it("round-trip through the export", () => {
    const edited = { ...DEFAULT_SETTINGS, enabled: true, onPlay: "card" as const, intoIsle: "morph" as const, backUp: "reopen" as const };
    const out = exportValues(edited, "dark");
    expect(out).toMatchObject({ lab: "player", key: SETTINGS_KEY, theme: "dark", onPlay: "card" });
    expect(parseSettings(JSON.stringify(out))).toEqual(edited);
  });

  it("keeps a v1 key, so a later change of meaning bumps it", () => {
    expect(SETTINGS_KEY).toBe("lab-player-v1");
  });

  it("draws a player only with the lab on and a card or sheet chosen", () => {
    expect(drawsPlayer(DEFAULT_SETTINGS)).toBe(false);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true })).toBe(false);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true, onPlay: "sheet" })).toBe(true);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, onPlay: "card" })).toBe(false);
  });
});
