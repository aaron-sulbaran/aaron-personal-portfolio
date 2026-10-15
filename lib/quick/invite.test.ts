import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITE_MODE,
  INVITE_KEY,
  inviteEligible,
  inviteMayShow,
  inviteModeFor,
  invitePieces,
  readAnswered,
  writeAnswer,
  type InviteGate,
} from "./invite";

const open: InviteGate = { holding: false, phase: "ready", rested: true, deep: false, modalOpen: false, flying: false, transitioning: false, answered: false };

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

describe("the invite's mode", () => {
  it("is the toast in production, whatever the lab stored", () => {
    expect(DEFAULT_INVITE_MODE).toBe("toast");
    expect(inviteModeFor({ development: false, override: "line" })).toBe("toast");
  });

  it("follows the lab's pick in development, and ignores junk", () => {
    expect(inviteModeFor({ development: true, override: "line" })).toBe("line");
    expect(inviteModeFor({ development: true, override: "both" })).toBe("both");
    expect(inviteModeFor({ development: true, override: "nope" })).toBe("toast");
    expect(inviteModeFor({ development: true, override: null })).toBe("toast");
  });

  it("names its pieces", () => {
    expect(invitePieces("pill")).toEqual({ pill: true, toast: false, line: false });
    expect(invitePieces("toast")).toEqual({ pill: false, toast: true, line: false });
    expect(invitePieces("both")).toEqual({ pill: true, toast: true, line: false });
    expect(invitePieces("line")).toEqual({ pill: false, toast: false, line: true });
  });
});

describe("when the invite may show", () => {
  it("shows once the hero is ready and the entrance has rested", () => {
    expect(inviteMayShow(open)).toBe(true);
  });

  it("never during the loader or the entrance", () => {
    expect(inviteMayShow({ ...open, phase: "pre" })).toBe(false);
    expect(inviteMayShow({ ...open, phase: "entering" })).toBe(false);
    expect(inviteMayShow({ ...open, rested: false })).toBe(false);
  });

  it("never under a modal, the flight or a transition", () => {
    expect(inviteMayShow({ ...open, modalOpen: true })).toBe(false);
    expect(inviteMayShow({ ...open, flying: true })).toBe(false);
    expect(inviteMayShow({ ...open, transitioning: true })).toBe(false);
  });

  it("never on a deep reload, under the holding page, or once answered", () => {
    expect(inviteMayShow({ ...open, deep: true })).toBe(false);
    expect(inviteMayShow({ ...open, holding: true })).toBe(false);
    expect(inviteMayShow({ ...open, answered: true })).toBe(false);
    expect(inviteEligible({ holding: false, deep: true, answered: false })).toBe(false);
  });
});

describe("the invite's memory", () => {
  it("remembers a use or a dismissal under one versioned key", () => {
    const store = memory();
    expect(readAnswered(store)).toBe(false);
    writeAnswer(store, "dismissed");
    expect(store.map.get(INVITE_KEY)).toBe("dismissed");
    expect(readAnswered(store)).toBe(true);
    expect(INVITE_KEY).toMatch(/-v\d+$/);
  });

  it("treats junk as unanswered and never throws on blocked storage", () => {
    const store = memory();
    store.setItem(INVITE_KEY, "maybe");
    expect(readAnswered(store)).toBe(false);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readAnswered(blocked)).toBe(false);
    expect(() => writeAnswer(blocked, "used")).not.toThrow();
    expect(readAnswered(null)).toBe(false);
  });
});
