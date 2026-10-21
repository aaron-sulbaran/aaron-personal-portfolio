import { describe, expect, it } from "vitest";
import {
  BACK_UP,
  CREDIT,
  DEFAULT_SETTINGS,
  drawsPlayer,
  exportValues,
  FOOTER,
  IDLE_RIPPLE,
  IDLE_STRENGTH,
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
// And round 2's, which wrote a round.
const ROUND_TWO = { round: 2, enabled: true, onPlay: "sheet", intoIsle: "morph", isleLine: 0.4, backUp: "reopen", credit: "hidden", phone: "island", statusLine: "hidden", notNow: "buttons", waveAfterAnswer: "waits", waveLine: 0.4, footer: "lift", phoneModel: "auto" };

describe("the player lab's settings", () => {
  it("default to the lab off, on the direction Aaron chose", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      round: ROUND,
      enabled: false,
      onPlay: "player",
      intoIsle: "morph",
      backUp: "reopen",
      credit: "hidden",
      phone: "island",
      statusLine: "hidden",
      notNow: "buttons",
      waveAfterAnswer: "waits",
      idleRipple: "ripple",
      idleStrength: 1,
      footer: "lift",
    });
    expect(ROUND).toBe(3);
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
    expect(IDLE_RIPPLE).toContain(DEFAULT_SETTINGS.idleRipple);
    expect(FOOTER).toContain(DEFAULT_SETTINGS.footer);
    expect(PHONE_MODEL).toContain(DEFAULT_SETTINGS.phoneModel);
    for (const [value, range] of [[DEFAULT_SETTINGS.isleLine, ISLE_LINE], [DEFAULT_SETTINGS.waveLine, WAVE_LINE], [DEFAULT_SETTINGS.idleStrength, IDLE_STRENGTH]] as const) {
      expect(value).toBeGreaterThanOrEqual(range.min);
      expect(value).toBeLessThanOrEqual(range.max);
    }
  });

  it("keep good values and replace bad ones one field at a time", () => {
    const read = parseSettings(JSON.stringify({ round: 3, enabled: true, onPlay: "today", intoIsle: "sideways", credit: "player", isleLine: 7, phone: 3, footer: "hide", statusLine: "today", idleRipple: "today" }));
    expect(read.enabled).toBe(true);
    expect(read.onPlay).toBe("today");
    expect(read.intoIsle).toBe(DEFAULT_SETTINGS.intoIsle);
    expect(read.credit).toBe("player");
    expect(read.isleLine).toBe(ISLE_LINE.max);
    expect(read.phone).toBe(DEFAULT_SETTINGS.phone);
    expect(read.footer).toBe("hide");
    expect(read.statusLine).toBe("today");
    expect(read.idleRipple).toBe("today");
  });

  it("clamp the hand-off line, the wave line and the idle strength into their ranges", () => {
    expect(parseSettings(JSON.stringify({ isleLine: -2 })).isleLine).toBe(ISLE_LINE.min);
    expect(parseSettings(JSON.stringify({ isleLine: 0.55 })).isleLine).toBe(0.55);
    expect(parseSettings(JSON.stringify({ isleLine: "high" })).isleLine).toBe(DEFAULT_SETTINGS.isleLine);
    expect(parseSettings(JSON.stringify({ waveLine: 4 })).waveLine).toBe(WAVE_LINE.max);
    expect(parseSettings(JSON.stringify({ waveLine: 0.25 })).waveLine).toBe(0.25);
    expect(parseSettings(JSON.stringify({ idleStrength: 9 })).idleStrength).toBe(IDLE_STRENGTH.max);
    expect(parseSettings(JSON.stringify({ idleStrength: 0 })).idleStrength).toBe(IDLE_STRENGTH.min);
  });

  it("round-trip through the export", () => {
    const edited = { ...DEFAULT_SETTINGS, enabled: true, footer: "hide" as const, waveLine: 0.55, idleStrength: 1.6 };
    const out = exportValues(edited, "dark");
    expect(out).toMatchObject({ lab: "player", key: SETTINGS_KEY, round: 3, theme: "dark", onPlay: "player" });
    expect(parseSettings(JSON.stringify(out))).toEqual(edited);
  });

  it("keeps the v1 key, so Aaron's earlier values carry over", () => {
    expect(SETTINGS_KEY).toBe("lab-player-v1");
  });

  it("migrates round 1's values without wiping them", () => {
    const read = parseSettings(JSON.stringify(ROUND_ONE));
    expect(read).toMatchObject({ round: 3, enabled: true, onPlay: "player", intoIsle: "morph", isleLine: 0.4, backUp: "reopen", credit: "hidden" });
    expect(read).toMatchObject({ statusLine: "hidden", notNow: "buttons", waveAfterAnswer: "waits", footer: "lift", waveLine: 0.4, idleRipple: "ripple", idleStrength: 1 });
  });

  it("migrates round 2's values without wiping them, reading the card and the sheet as the one player", () => {
    const read = parseSettings(JSON.stringify(ROUND_TWO));
    expect(read).toMatchObject({ round: 3, enabled: true, onPlay: "player", phone: "island", statusLine: "hidden", notNow: "buttons", waveAfterAnswer: "waits", footer: "lift" });
    expect(parseSettings(JSON.stringify({ ...ROUND_TWO, onPlay: "card" })).onPlay).toBe("player");
    expect(parseSettings(JSON.stringify({ ...ROUND_TWO, onPlay: "today" })).onPlay).toBe("today");
  });

  it("swaps round 1's bottom bar for the island once, and honors a bar chosen in round 2 or after", () => {
    expect(parseSettings(JSON.stringify(ROUND_ONE)).phone).toBe("island");
    expect(parseSettings(JSON.stringify({ ...ROUND_ONE, phone: "band" })).phone).toBe("band");
    expect(parseSettings(JSON.stringify({ ...ROUND_TWO, phone: "bar" })).phone).toBe("bar");
    expect(parseSettings(JSON.stringify({ ...ROUND_TWO, round: 3, phone: "bar" })).phone).toBe("bar");
  });

  it("draws a player only with the lab on and the player chosen", () => {
    expect(drawsPlayer(DEFAULT_SETTINGS)).toBe(false);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true })).toBe(true);
    expect(drawsPlayer({ ...DEFAULT_SETTINGS, enabled: true, onPlay: "today" })).toBe(false);
  });
});
