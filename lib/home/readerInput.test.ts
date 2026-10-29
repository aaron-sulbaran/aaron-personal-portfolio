import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { createReaderInput } from "@/lib/home/readerInput";

const w = COIL.deal.cutscene.readerWindowMs;

describe("whose scroll it is", () => {
  it("is nobody's with no input: a Menu link, an anchor or a script's scrollTo", () => {
    expect(createReaderInput().driving(5000)).toBe(false);
  });

  it("is the reader's while a wheel is recent, and a trackpad's tail keeps it so", () => {
    const input = createReaderInput();
    input.wheel(1000);
    expect(input.driving(1000 + w.wheel)).toBe(true);
    expect(input.driving(1000 + w.wheel + 1)).toBe(false);
    input.wheel(1000 + w.wheel);
    expect(input.driving(1000 + 2 * w.wheel)).toBe(true);
  });

  it("is the reader's after a scroll key, for as long as the browser smooths it", () => {
    const input = createReaderInput();
    input.key(0);
    expect(input.driving(w.key)).toBe(true);
    expect(input.driving(w.key + 1)).toBe(false);
  });

  it("is the reader's through a finger that moves and the momentum after it, but not a tap's", () => {
    const input = createReaderInput();
    input.touchStart(0);
    input.touchEnd(80);
    // A tap on the Menu: it scrolls nothing, and the Menu's own smooth scroll after it is not the reader's.
    expect(input.driving(400)).toBe(false);
    input.touchStart(1000);
    input.touchMove(1050);
    expect(input.driving(5000), "a finger still down, moved").toBe(true);
    input.touchEnd(1200);
    expect(input.driving(1200 + w.touch)).toBe(true);
    expect(input.driving(1200 + w.touch + 1)).toBe(false);
  });

  it("is the reader's while the scrollbar is held and just after", () => {
    const input = createReaderInput();
    input.scrollbarDown(0);
    expect(input.driving(10_000)).toBe(true);
    input.scrollbarUp(10_000);
    expect(input.driving(10_000 + w.scrollbar)).toBe(true);
    expect(input.driving(10_000 + w.scrollbar + 1)).toBe(false);
  });
});
