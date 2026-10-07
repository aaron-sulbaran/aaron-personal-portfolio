import { describe, expect, it } from "vitest";
import { capsuleName, capsuleText, dockLabel, dockMode } from "./dock";

const base = { music: "before" as const, reached: true, phone: false, labelShown: false, returning: false, failed: false };
const STATES = ["before", "on", "paused", "off"] as const;

describe("dock", () => {
  it("is hidden on phones and before the band is reached", () => {
    expect(dockMode({ ...base, phone: true })).toBe("hidden");
    expect(dockMode({ ...base, reached: false })).toBe("hidden");
  });
  it("stays hidden through the hero and the book in every music state, label or not", () => {
    for (const music of STATES) {
      expect(dockMode({ ...base, music, reached: false })).toBe("hidden");
      expect(dockMode({ ...base, music, reached: false, labelShown: true })).toBe("hidden");
    }
  });
  it("shows the label once, then the capsule, in every music state", () => {
    for (const music of STATES) {
      expect(dockMode({ ...base, music })).toBe("label");
      expect(dockMode({ ...base, music, labelShown: true })).toBe("capsule");
    }
  });
  it("picks the label by state, failure first", () => {
    expect(dockLabel({ ...base, music: "on" })).toBe("accepted");
    expect(dockLabel({ ...base, music: "off" })).toBe("declined");
    expect(dockLabel({ ...base, music: "before" })).toBe("unanswered");
    expect(dockLabel({ ...base, music: "paused" })).toBe("accepted");
    expect(dockLabel({ ...base, music: "paused", returning: true })).toBe("returning");
    expect(dockLabel({ ...base, music: "paused", returning: true, failed: true })).toBe("failed");
  });
  it("capsule text", () => {
    expect(capsuleText("on", "Small Steps")).toBe("Small Steps");
    expect(capsuleText("paused", "x")).toBe("Paused");
    expect(capsuleText("before", "x")).toBe("Music?");
    expect(capsuleText("off", "x")).toBe("Music");
  });
  it("the capsule's name joins its text and action with one separator", () => {
    expect(capsuleName("Music?", "Play the soundtrack")).toBe("Music? Play the soundtrack");
    expect(capsuleName("Paused", "Open soundtrack player")).toBe("Paused. Open soundtrack player");
    expect(capsuleName("Small Steps.", "Open")).toBe("Small Steps. Open");
    expect(capsuleName("Wow!", "Open")).toBe("Wow! Open");
    expect(capsuleName("Music", "Play the soundtrack")).toBe("Music. Play the soundtrack");
  });
});
