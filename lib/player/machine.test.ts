import { describe, expect, it } from "vitest";
import { bandPlayerMounted, CLOSED, handoff, pillHold, step, type MachineConfig, type PlayerEvent, type PlayerState } from "./machine";

const desktop: MachineConfig = { onPlay: "card", intoIsle: "morph", backUp: "reopen", phone: false, phoneMode: "band", reduce: false };
const phone: MachineConfig = { ...desktop, phone: true, phoneMode: "bar" };
const run = (config: MachineConfig, events: PlayerEvent[], from: PlayerState = CLOSED) => events.reduce((state, event) => step(state, event, config), from);

describe("starting the music", () => {
  it("does nothing when On play is today", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, { ...desktop, onPlay: "today" })).toEqual(CLOSED);
  });

  it("opens in the band when the band is on screen", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, desktop)).toEqual({ view: "band", home: "band" });
  });

  it("docks at the isle when started from the hero, the book or below the band", () => {
    for (const zone of ["ahead", "past"] as const) {
      expect(step(CLOSED, { type: "started", zone }, desktop)).toEqual({ view: "docked", home: "dock" });
    }
  });

  it("opens a phone's player in the band, or as the bar when the bar is chosen and the band is away", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, phone)).toEqual({ view: "band", home: "band" });
    expect(step(CLOSED, { type: "started", zone: "ahead" }, phone)).toEqual({ view: "pill", home: "band" });
    expect(step(CLOSED, { type: "started", zone: "ahead" }, { ...phone, phoneMode: "band" })).toEqual({ view: "band", home: "band" });
  });
});

describe("scrolling the band out and back", () => {
  const inBand = { view: "band", home: "band" } as const;

  it("morphs to the pill when the line is crossed, then lands there", () => {
    const left = step(inBand, { type: "line", past: true }, desktop);
    expect(left.view).toBe("to-pill");
    expect(step(left, { type: "arrived" }, desktop).view).toBe("pill");
  });

  it("swaps at once when the hand-off is a fade", () => {
    expect(step(inBand, { type: "line", past: true }, { ...desktop, intoIsle: "fade" }).view).toBe("pill");
  });

  it("stays in the band, for the stock pill to arrive by itself, when Into the isle is today", () => {
    expect(step(inBand, { type: "line", past: true }, { ...desktop, intoIsle: "today" })).toEqual(inBand);
  });

  it("reopens in the band on the way back when Back up reopens, and stays a pill otherwise", () => {
    const pill = { view: "pill", home: "band" } as const;
    expect(step(pill, { type: "line", past: false }, desktop).view).toBe("to-band");
    expect(step(pill, { type: "line", past: false }, { ...desktop, intoIsle: "fade" }).view).toBe("band");
    expect(step(pill, { type: "line", past: false }, { ...desktop, backUp: "pill" })).toEqual(pill);
  });

  it("turns around mid-flight in either direction", () => {
    expect(step({ view: "to-pill", home: "band" }, { type: "line", past: false }, desktop).view).toBe("to-band");
    expect(step({ view: "to-band", home: "band" }, { type: "line", past: true }, desktop).view).toBe("to-pill");
  });

  it("never reopens a docked player in the band", () => {
    const docked = { view: "docked", home: "dock" } as const;
    expect(step(docked, { type: "line", past: false }, desktop)).toEqual(docked);
    expect(step({ view: "pill", home: "dock" }, { type: "line", past: false }, desktop).view).toBe("pill");
  });

  it("goes through the whole round trip", () => {
    const end = run(desktop, [
      { type: "started", zone: "in" },
      { type: "line", past: true },
      { type: "arrived" },
      { type: "line", past: false },
      { type: "arrived" },
    ]);
    expect(end).toEqual({ view: "band", home: "band" });
  });
});

describe("closing, opening and stopping", () => {
  it("collapses a docked player to the pill, or closes it when the pill is not there yet", () => {
    const docked = { view: "docked", home: "dock" } as const;
    expect(step(docked, { type: "close", pillReady: true }, desktop)).toEqual({ view: "pill", home: "dock" });
    expect(step(docked, { type: "close", pillReady: false }, desktop)).toEqual(CLOSED);
  });

  it("closes the band's player", () => {
    expect(step({ view: "band", home: "band" }, { type: "close", pillReady: true }, desktop)).toEqual(CLOSED);
  });

  it("opens the pill into the band when the band is on screen, else at the dock", () => {
    const pill = { view: "pill", home: "band" } as const;
    expect(step(pill, { type: "open", zone: "in" }, { ...desktop, intoIsle: "fade" }).view).toBe("band");
    expect(step(pill, { type: "open", zone: "in" }, desktop).view).toBe("to-band");
    expect(step(pill, { type: "open", zone: "past" }, desktop)).toEqual({ view: "docked", home: "dock" });
    expect(step({ view: "pill", home: "dock" }, { type: "open", zone: "in" }, desktop)).toEqual({ view: "docked", home: "dock" });
  });

  it("clears on a stop or a reset", () => {
    expect(step({ view: "docked", home: "dock" }, { type: "stopped" }, desktop)).toEqual(CLOSED);
    expect(step({ view: "pill", home: "band" }, { type: "reset" }, desktop)).toEqual(CLOSED);
  });
});

describe("the hand-off kind", () => {
  it("is the chosen Into the isle on desktop, with reduced motion fading instead of morphing", () => {
    expect(handoff(desktop)).toBe("morph");
    expect(handoff({ ...desktop, reduce: true })).toBe("fade");
    expect(handoff({ ...desktop, intoIsle: "today" })).toBe("none");
  });

  it("is the phone's choice on a phone: none in the band, a fade to the bar unless morph is chosen", () => {
    expect(handoff({ ...phone, phoneMode: "band" })).toBe("none");
    expect(handoff({ ...phone, intoIsle: "today" })).toBe("fade");
    expect(handoff(phone)).toBe("morph");
  });
});

describe("what the real pill does around the lab's player", () => {
  it("holds the pill when the player has collapsed into it, and keeps it away while the player stands in its place", () => {
    expect(pillHold("pill", false)).toBe("hold");
    for (const view of ["docked", "to-pill", "to-band"] as const) expect(pillHold(view, false)).toBe("away");
    for (const view of ["closed", "band"] as const) expect(pillHold(view, false)).toBe("auto");
  });

  it("leaves the pill hidden through the hero and the book, where the band is still ahead", () => {
    expect(pillHold("pill", true)).toBe("auto");
  });

  it("keeps the band's player in the page through a hand-off so its box can be measured", () => {
    expect(bandPlayerMounted("band", "band")).toBe(true);
    expect(bandPlayerMounted("pill", "band")).toBe(true);
    expect(bandPlayerMounted("docked", "dock")).toBe(false);
    expect(bandPlayerMounted("closed", "band")).toBe(false);
  });
});
