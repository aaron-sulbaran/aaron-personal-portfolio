import { describe, expect, it } from "vitest";
import {
  BACK_UP,
  CREDIT,
  DEFAULT_SETTINGS,
  drawsPlayer,
  exportValues,
  FOOTER,
  INTO_ISLE,
  ISLE_LINE,
  NOT_NOW,
  ON_PLAY,
  parseSettings,
  PHONE,
  PHONE_MODEL,
  ROUND,
  SETTINGS_KEY,
  STATUS_LINE,
  WAVE_AFTER_ANSWER,
  WAVE_LINE,
} from "./settings";

// Aaron's round 1 values, as the lab stored them (no round field).
const ROUND_ONE = { enabled: true, onPlay: "sheet", intoIsle: "morph", isleLine: 0.4, backUp: "reopen", credit: "hidden", phone: "bar" };

describe("the player lab's settings", () => {
  it("default to the lab off, on the direction Aaron chose", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      round: ROUND,
      enabled: false,
      onPlay: "sheet",
      intoIsle: "morph",
      backUp: "reopen",
      credit: "hidden",
      phone: "island",
      statusLine: "hidden",
      notNow: "buttons",
      waveAfterAnswer: "waits",
      footer: "lift",
    });
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
    expect(STATUS_LINE).toContain(DEFAULT_SETTINGS.statusLine);
    expect(NOT_NOW).toContain(DEFAULT_SETTINGS.notNow);
    expect(WAVE_AFTER_ANSWER).toContain(DEFAULT_SETTINGS.waveAfterAnswer);
    expect(FOOTER).toContain(DEFAULT_SETTINGS.footer);
    expect(PHONE_MODEL).toContain(DEFAULT_SETTINGS.phoneModel);
    for (const [value, range] of [[DEFAULT_SETTINGS.isleLine, ISLE_LINE], [DEFAULT_SETTINGS.waveLine, WAVE_LINE]] as const) {
      expect(value).toBeGreaterThanOrEqual(range.min);
      expect(value).toBeLessThanOrEqual(range.max);
    }
  });

  it("keep good values and replace bad ones one field at a time", () => {
    const read = parseSettings(JSON.stringify({ round: 2, enabled: true, onPlay: "card", intoIsle: "sideways", credit: "player", isleLine: 7, phone: 3, footer: "hide", statusLine: "today" }));
    expect(read.enabled).toBe(true);
    expect(read.onPlay).toBe("card");
    expect(read.intoIsle).toBe(DEFAULT_SETTINGS.intoIsle);
    expect(read.credit).toBe("player");
    expect(read.isleLine).toBe(ISLE_LINE.max);
    expect(read.phone).toBe(DEFAULT_SETTINGS.phone);
    expect(read.footer).toBe("hide");
    expect(read.statusLine).toBe("today");
  });

  it("clamp the hand-off line and the wave line into their ranges", () => {
    expect(parseSettings(JSON.stringify({ isleLine: -2 })).isleLine).toBe(ISLE_LINE.min);
    expect(parseSettings(JSON.stringify({ isleLine: 0.55 })).isleLine).toBe(0.55);
    expect(parseSettings(JSON.stringify({ isleLine: "high" })).isleLine).toBe(DEFAULT_SETTINGS.isleLine);
    expect(parseSettings(JSON.stringify({ waveLine: 4 })).waveLine).toBe(WAVE_LINE.max);
    expect(parseSettings(JSON.stringify({ waveLine: 0.25 })).waveLine).toBe(0.25);
  });

  it("round-trip through the export", () => {
    const edited = { ...DEFAULT_SETTINGS, enabled: true, onPlay: "card" as const, footer: "hide" as const, waveLine: 0.55 };
    const out = exportValues(edited, "dark");
    expect(out).toMatchObject({ lab: "player", key: SETTINGS_KEY, round: 2, theme: "dark", onPlay: "card" });
    expect(parseSettings(JSON.stringify(out))).toEqual(edited);
  });

  it("keeps the v1 key, so Aaron's round 1 values carry over", () => {
    expect(SETTINGS_KEY).toBe("lab-player-v1");
  });

  it("migrates round 1's values without wiping them", () => {
    const read = parseSettings(JSON.stringify(ROUND_ONE));
    expect(read).toMatchObject({ round: 2, enabled: true, onPlay: "sheet", intoIsle: "morph", isleLine: 0.4, backUp: "reopen", credit: "hidden" });
    expect(read).toMatchObject({ statusLine: "hidden", notNow: "buttons", waveAfterAnswer: "waits", footer: "lift", waveLine: 0.4 });
  });

  it("swaps round 1's bottom bar for the island once, and honors a bar chosen in round 2", () => {
    expect(parseSettings(JSON.stringify(ROUND_ONE)).phone).toBe("island");
    expect(parseSettings(JSON.stringify({ ...ROUND_ONE, phone: "band" })).phone).toBe("band");
    expect(parseSettings(JSON.stringify({ ...ROUND_ONE, round: 2, phone: "bar" })).phone).toBe("bar");
  });

  it("draws a player only with the lab on and a card or sheet chosen", () => {
    expect(drawsPlayer(DEFAULT_SETTINGS)).toBe(false);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true })).toBe(true);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true, onPlay: "today" })).toBe(false);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, onPlay: "card" })).toBe(false);
  });
});
