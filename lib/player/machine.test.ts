import { describe, expect, it } from "vitest";
import { bandPlayerMounted, bandPlayerShown, CLOSED, handoff, isleShown, playerOwnsPill, step, type MachineConfig, type PlayerEvent, type PlayerState } from "./machine";

const desktop: MachineConfig = { phone: false, roomy: true, reduce: false };
const phone: MachineConfig = { ...desktop, phone: true };
const view = (name: PlayerState["view"]): PlayerState => ({ view: name });
const run = (config: MachineConfig, events: PlayerEvent[], from: PlayerState = CLOSED) => events.reduce((state, event) => step(state, event, config), from);

describe("starting the music", () => {
  it("opens the player in the band when the band is on screen", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, desktop)).toEqual(view("band"));
    expect(step(CLOSED, { type: "started", zone: "in" }, phone)).toEqual(view("band"));
  });

  it("docks the player open at the isle when it is started below the band, on a desktop", () => {
    expect(step(CLOSED, { type: "started", zone: "past" }, desktop)).toEqual(view("docked"));
  });

  it("collapses into the isle when it is started above the band, where only the isle is on screen", () => {
    expect(step(CLOSED, { type: "started", zone: "ahead" }, desktop)).toEqual(view("pill"));
  });

  it("puts a phone's player in the island whenever the band is off screen", () => {
    expect(step(CLOSED, { type: "started", zone: "past" }, phone)).toEqual(view("pill"));
    expect(step(CLOSED, { type: "started", zone: "ahead" }, phone)).toEqual(view("pill"));
  });

  it("docks even with the band on screen when the window is too narrow to hold the card beside the copy", () => {
    expect(step(CLOSED, { type: "started", zone: "in" }, { ...desktop, roomy: false })).toEqual(view("docked"));
  });
});

describe("scrolling the band out and back", () => {
  it("morphs to the pill when the reader scrolls past the band, then lands there", () => {
    const left = step(view("band"), { type: "zone", zone: "past" }, desktop);
    expect(left.view).toBe("to-pill");
    expect(step(left, { type: "arrived" }, desktop).view).toBe("pill");
  });

  it("does the same when the band leaves the other way, down the page, so the isle shows above it too", () => {
    expect(step(view("band"), { type: "zone", zone: "ahead" }, desktop).view).toBe("to-pill");
  });

  it("swaps at once under reduced motion", () => {
    const reduced = { ...desktop, reduce: true };
    expect(step(view("band"), { type: "zone", zone: "past" }, reduced).view).toBe("pill");
    expect(step(view("pill"), { type: "zone", zone: "in" }, reduced).view).toBe("band");
  });

  it("reopens in the band on the way back", () => {
    expect(step(view("pill"), { type: "zone", zone: "in" }, desktop).view).toBe("to-band");
    expect(step(view("to-band"), { type: "arrived" }, desktop).view).toBe("band");
  });

  it("turns around mid-flight in either direction", () => {
    expect(step(view("to-pill"), { type: "zone", zone: "in" }, desktop).view).toBe("to-band");
    expect(step(view("to-band"), { type: "zone", zone: "past" }, desktop).view).toBe("to-pill");
  });

  it("stays a pill as the reader moves on through the book and the hero", () => {
    const end = run(desktop, [{ type: "started", zone: "in" }, { type: "zone", zone: "past" }, { type: "arrived" }, { type: "zone", zone: "ahead" }]);
    expect(end).toEqual(view("pill"));
  });

  it("brings a docked player home to the band when the reader scrolls back up to it", () => {
    expect(step(view("docked"), { type: "zone", zone: "in" }, desktop)).toEqual(view("band"));
    expect(step(view("docked"), { type: "zone", zone: "past" }, desktop)).toEqual(view("docked"));
    expect(step(view("docked"), { type: "zone", zone: "ahead" }, desktop)).toEqual(view("docked"));
  });

  it("keeps a docked player at the dock when the window is too narrow for the band's card", () => {
    const narrow = { ...desktop, roomy: false };
    expect(step(view("docked"), { type: "zone", zone: "in" }, narrow)).toEqual(view("docked"));
    expect(step(view("pill"), { type: "zone", zone: "in" }, narrow)).toEqual(view("pill"));
  });

  it("docks a band player whose window narrows below what the card needs", () => {
    const narrow = { ...desktop, roomy: false };
    for (const name of ["band", "to-band", "to-pill"] as const) expect(step(view(name), { type: "zone", zone: "in" }, narrow)).toEqual(view("docked"));
  });

  it("goes through the whole round trip, down and back", () => {
    const end = run(desktop, [
      { type: "started", zone: "in" },
      { type: "zone", zone: "past" },
      { type: "arrived" },
      { type: "zone", zone: "in" },
      { type: "arrived" },
    ]);
    expect(end).toEqual(view("band"));
  });

  it("does the same on a phone: card in the band, island below it and above it, card again on the way back", () => {
    const down = run(phone, [{ type: "started", zone: "in" }, { type: "zone", zone: "past" }, { type: "arrived" }]);
    expect(down).toEqual(view("pill"));
    expect(run(phone, [{ type: "zone", zone: "ahead" }], down)).toEqual(view("pill"));
    expect(run(phone, [{ type: "zone", zone: "in" }, { type: "arrived" }], down)).toEqual(view("band"));
  });

  it("does nothing while no music is playing", () => {
    for (const zone of ["in", "past", "ahead"] as const) expect(step(CLOSED, { type: "zone", zone }, desktop)).toEqual(CLOSED);
  });
});

describe("stopping", () => {
  it("clears whatever the view was", () => {
    for (const name of ["band", "docked", "to-pill", "to-band", "pill"] as const) expect(step(view(name), { type: "stopped" }, desktop)).toEqual(CLOSED);
  });
});

describe("the hand-off kind", () => {
  it("is a morph, with reduced motion fading instead", () => {
    expect(handoff(desktop)).toBe("morph");
    expect(handoff(phone)).toBe("morph");
    expect(handoff({ ...desktop, reduce: true })).toBe("fade");
  });
});

describe("what each view shows", () => {
  it("steps the stock capsule pill away whenever the player is the pill, and only then", () => {
    for (const name of ["band", "docked", "to-pill", "to-band", "pill"] as const) expect(playerOwnsPill(name)).toBe(true);
    expect(playerOwnsPill("closed")).toBe(false);
  });

  it("shows the isle collapsed or at its dock, never while a hand-off or the band's card has the player", () => {
    expect(isleShown("pill")).toBe(true);
    expect(isleShown("docked")).toBe(true);
    for (const name of ["closed", "band", "to-pill", "to-band"] as const) expect(isleShown(name)).toBe(false);
  });

  it("keeps the band's player in the page through a hand-off so its box can be measured, and on show only in the band", () => {
    for (const name of ["band", "to-pill", "pill", "to-band"] as const) expect(bandPlayerMounted(name)).toBe(true);
    expect(bandPlayerMounted("docked")).toBe(false);
    expect(bandPlayerMounted("closed")).toBe(false);
    expect(bandPlayerShown("band")).toBe(true);
    for (const name of ["closed", "docked", "to-pill", "to-band", "pill"] as const) expect(bandPlayerShown(name)).toBe(false);
  });
});
