import { describe, expect, it } from "vitest";
import { bandPlayerMounted, CLOSED, handoff, labPillShown, pillHold, step, type MachineConfig, type PlayerEvent, type PlayerState } from "./machine";

const desktop: MachineConfig = { onPlay: "player", intoIsle: "morph", backUp: "reopen", phone: false, phoneMode: "island", roomy: true, reduce: false };
const phone: MachineConfig = { ...desktop, phone: true };
const view = (name: PlayerState["view"]): PlayerState => ({ view: name });
const run = (config: MachineConfig, events: PlayerEvent[], from: PlayerState = CLOSED) => events.reduce((state, event) => step(state, event, config), from);

describe("starting the music", () => {
  it("does nothing when On play is today", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, { ...desktop, onPlay: "today" })).toEqual(CLOSED);
  });

  it("opens in the band when the band is on screen, or parks there when the reader is above it", () => {
    for (const zone of ["in", "ahead"] as const) expect(step(CLOSED, { type: "started", zone }, desktop)).toEqual(view("band"));
  });

  it("docks at the isle when started below the band", () => {
    expect(step(CLOSED, { type: "started", zone: "past" }, desktop)).toEqual(view("docked"));
  });

  it("docks even with the band on screen when the window is too narrow to hold the card beside the copy", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, { ...desktop, roomy: false })).toEqual(view("docked"));
    expect(step(CLOSED, { type: "started", zone: "ahead" }, { ...desktop, roomy: false })).toEqual(view("docked"));
  });

  it("opens a phone's player in the band, or as the island or bar when that is chosen and the reader is below the band", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, phone)).toEqual(view("band"));
    expect(step(CLOSED, { type: "started", zone: "ahead" }, phone)).toEqual(view("band"));
    expect(step(CLOSED, { type: "started", zone: "past" }, phone)).toEqual(view("pill"));
    expect(step(CLOSED, { type: "started", zone: "past" }, { ...phone, phoneMode: "bar" })).toEqual(view("pill"));
    expect(step(CLOSED, { type: "started", zone: "past" }, { ...phone, phoneMode: "band" })).toEqual(view("band"));
  });
});

describe("scrolling the band out and back", () => {
  it("morphs to the pill when the line is crossed, then lands there", () => {
    const left = step(view("band"), { type: "line", past: true }, desktop);
    expect(left.view).toBe("to-pill");
    expect(step(left, { type: "arrived" }, desktop).view).toBe("pill");
  });

  it("swaps at once when the hand-off is a fade", () => {
    expect(step(view("band"), { type: "line", past: true }, { ...desktop, intoIsle: "fade" }).view).toBe("pill");
  });

  it("stays in the band, for the stock pill to arrive by itself, when Into the isle is today", () => {
    expect(step(view("band"), { type: "line", past: true }, { ...desktop, intoIsle: "today" })).toEqual(view("band"));
  });

  it("reopens in the band on the way back when Back up reopens, and stays a pill otherwise", () => {
    expect(step(view("pill"), { type: "line", past: false }, desktop).view).toBe("to-band");
    expect(step(view("pill"), { type: "line", past: false }, { ...desktop, intoIsle: "fade" }).view).toBe("band");
    expect(step(view("pill"), { type: "line", past: false }, { ...desktop, backUp: "pill" })).toEqual(view("pill"));
  });

  it("turns around mid-flight in either direction", () => {
    expect(step(view("to-pill"), { type: "line", past: false }, desktop).view).toBe("to-band");
    expect(step(view("to-band"), { type: "line", past: true }, desktop).view).toBe("to-pill");
  });

  it("brings a docked player home to the band when the reader scrolls back up to it", () => {
    expect(step(view("docked"), { type: "line", past: false }, desktop)).toEqual(view("band"));
    expect(step(view("docked"), { type: "line", past: false }, { ...desktop, backUp: "pill" })).toEqual(view("docked"));
    expect(step(view("docked"), { type: "line", past: false }, { ...desktop, roomy: false })).toEqual(view("docked"));
    expect(step(view("docked"), { type: "line", past: true }, desktop)).toEqual(view("docked"));
  });

  it("reopens in the band from a pill that began at the dock too", () => {
    const end = run(desktop, [{ type: "started", zone: "past" }, { type: "close", pillReady: true }, { type: "line", past: false }, { type: "arrived" }]);
    expect(end).toEqual(view("band"));
  });

  it("leaves the player parked in the band, never an isle, as the reader scrolls on up to the book and the hero", () => {
    const end = run(desktop, [{ type: "started", zone: "in" }, { type: "line", past: true }, { type: "arrived" }, { type: "line", past: false }, { type: "arrived" }, { type: "line", past: false }]);
    expect(end).toEqual(view("band"));
  });

  it("goes through the whole round trip", () => {
    const end = run(desktop, [
      { type: "started", zone: "in" },
      { type: "line", past: true },
      { type: "arrived" },
      { type: "line", past: false },
      { type: "arrived" },
    ]);
    expect(end).toEqual(view("band"));
  });

  it("does the same on a phone with the island: sheet in the band, island below it, sheet again on the way back", () => {
    const down = run(phone, [{ type: "started", zone: "in" }, { type: "line", past: true }, { type: "arrived" }]);
    expect(down).toEqual(view("pill"));
    expect(run(phone, [{ type: "line", past: false }, { type: "arrived" }], down)).toEqual(view("band"));
  });
});

describe("closing, opening and stopping", () => {
  it("collapses a docked player to the pill, or closes it when the pill is not there yet", () => {
    expect(step(view("docked"), { type: "close", pillReady: true }, desktop)).toEqual(view("pill"));
    expect(step(view("docked"), { type: "close", pillReady: false }, desktop)).toEqual(CLOSED);
  });

  it("closes the band's player", () => {
    expect(step(view("band"), { type: "close", pillReady: true }, desktop)).toEqual(CLOSED);
  });

  it("opens the pill into the band when the band is on screen, else at the dock", () => {
    expect(step(view("pill"), { type: "open", zone: "in" }, { ...desktop, intoIsle: "fade" }).view).toBe("band");
    expect(step(view("pill"), { type: "open", zone: "in" }, desktop).view).toBe("to-band");
    expect(step(view("pill"), { type: "open", zone: "past" }, desktop)).toEqual(view("docked"));
    expect(step(view("pill"), { type: "open", zone: "in" }, { ...desktop, roomy: false })).toEqual(view("docked"));
  });

  it("clears on a stop or a reset", () => {
    expect(step(view("docked"), { type: "stopped" }, desktop)).toEqual(CLOSED);
    expect(step(view("pill"), { type: "reset" }, desktop)).toEqual(CLOSED);
  });
});

describe("the hand-off kind", () => {
  it("is the chosen Into the isle on desktop, with reduced motion fading instead of morphing", () => {
    expect(handoff(desktop)).toBe("morph");
    expect(handoff({ ...desktop, reduce: true })).toBe("fade");
    expect(handoff({ ...desktop, intoIsle: "today" })).toBe("none");
  });

  it("is the phone's choice on a phone: none in the band, a fade to the island or bar unless morph is chosen", () => {
    expect(handoff({ ...phone, phoneMode: "band" })).toBe("none");
    expect(handoff({ ...phone, intoIsle: "today" })).toBe("fade");
    expect(handoff(phone)).toBe("morph");
    expect(handoff({ ...phone, phoneMode: "bar" })).toBe("morph");
  });
});

describe("what the real pill does around the lab's player", () => {
  it("steps the real pill away whenever the lab's own pill is the isle, or is handing off to or from it", () => {
    for (const name of ["pill", "docked", "to-pill", "to-band"] as const) expect(pillHold(name)).toBe("away");
    for (const name of ["closed", "band"] as const) expect(pillHold(name)).toBe("auto");
  });

  it("shows the lab's pill collapsed into the isle or at the dock, never while the reader is still above the band", () => {
    expect(labPillShown("pill", false)).toBe(true);
    expect(labPillShown("docked", false)).toBe(true);
    expect(labPillShown("pill", true)).toBe(false);
    for (const name of ["closed", "band", "to-pill", "to-band"] as const) expect(labPillShown(name, false)).toBe(false);
  });

  it("keeps the band's player in the page through a hand-off so its box can be measured", () => {
    for (const name of ["band", "to-pill", "pill", "to-band"] as const) expect(bandPlayerMounted(name)).toBe(true);
    expect(bandPlayerMounted("docked")).toBe(false);
    expect(bandPlayerMounted("closed")).toBe(false);
  });
});
