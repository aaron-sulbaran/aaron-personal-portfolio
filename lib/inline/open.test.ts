import { describe, expect, it } from "vitest";
import { markOpen, OPEN_ATTRIBUTE } from "@/lib/inline/open";

const fakeLink = () => {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
};

describe("markOpen", () => {
  it("marks the link and the undo clears it", () => {
    const link = fakeLink();
    const undo = markOpen(link);
    expect(link.attributes.has(OPEN_ATTRIBUTE)).toBe(true);
    undo();
    expect(link.attributes.has(OPEN_ATTRIBUTE)).toBe(false);
  });
  it("is a no-op for no link", () => {
    expect(() => markOpen(null)()).not.toThrow();
  });
  it("is the attribute the stylesheet fills on", () => {
    expect(OPEN_ATTRIBUTE).toBe("data-inline-open");
  });
});
