import { describe, expect, it } from "vitest";
import { MODALITY_ATTRIBUTE, nextModality, trackModality, type Modality } from "@/lib/input/modality";

const key = (name: string) => ({ type: "keydown", key: name });
const press = { type: "pointerdown" };

describe("nextModality", () => {
  it("a pointer press is pointer, from anywhere", () => {
    expect(nextModality(null, press)).toBe("pointer");
    expect(nextModality("keyboard", press)).toBe("pointer");
  });

  it("a navigation or activation key is keyboard", () => {
    for (const name of ["Tab", "ArrowDown", "Enter", " ", "a"]) expect(nextModality("pointer", key(name))).toBe("keyboard");
    expect(nextModality(null, key("Tab"))).toBe("keyboard");
  });

  it("a modifier alone changes nothing", () => {
    for (const name of ["Shift", "Control", "Alt", "Meta", "CapsLock"]) {
      expect(nextModality("pointer", key(name))).toBe("pointer");
      expect(nextModality(null, key(name))).toBeNull();
    }
  });

  it("Escape alone changes nothing, so a mouse-opened card returns focus without a ring", () => {
    expect(nextModality("pointer", key("Escape"))).toBe("pointer");
    expect(nextModality("keyboard", key("Escape"))).toBe("keyboard");
  });

  it("the window losing focus hands the decision back to the browser", () => {
    expect(nextModality("pointer", { type: "blur" })).toBeNull();
    expect(nextModality("keyboard", { type: "blur" })).toBeNull();
  });

  it("an unrelated event changes nothing", () => {
    expect(nextModality("pointer", { type: "scroll" })).toBe("pointer");
    expect(nextModality(null, { type: "keydown" })).toBeNull();
  });
});

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

function send(target: EventTarget, type: string, init: { key?: string } = {}) {
  target.dispatchEvent(Object.assign(new Event(type), init));
}

describe("trackModality", () => {
  it("writes the attribute for each press and key, and clears it when the window blurs", () => {
    const root = fakeRoot();
    const target = new EventTarget();
    const read = (): Modality | null => root.getAttribute(MODALITY_ATTRIBUTE) as Modality | null;
    const stop = trackModality(root, target);

    expect(read()).toBeNull();
    send(target, "pointerdown");
    expect(read()).toBe("pointer");
    send(target, "keydown", { key: "Escape" });
    expect(read()).toBe("pointer");
    send(target, "keydown", { key: "Tab" });
    expect(read()).toBe("keyboard");
    send(target, "pointerdown");
    expect(read()).toBe("pointer");
    send(target, "blur");
    expect(read()).toBeNull();

    stop();
  });

  it("stops listening after the teardown", () => {
    const root = fakeRoot();
    const target = new EventTarget();
    trackModality(root, target)();
    send(target, "pointerdown");
    expect(root.getAttribute(MODALITY_ATTRIBUTE)).toBeNull();
  });
});
