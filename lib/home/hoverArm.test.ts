import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { createHoverArm, disarmHover, moveHover } from "@/lib/home/hoverArm";

describe("hover focus waits for a real pointer move", () => {
  it("starts waiting, and with no place known the first event is only where the pointer is", () => {
    const arm = createHoverArm();
    expect(arm.armed).toBe(false);
    expect(arm.rearmPx).toBe(COIL.capture.rearmPx);
    expect(moveHover(arm, 400, 300)).toBe(false);
    expect(moveHover(arm, 400, 300)).toBe(false);
    expect(moveHover(arm, 402, 301)).toBe(false);
    expect(arm.armed).toBe(false);
  });

  it("arms once, on the first move farther than the re-arm distance from where it sat", () => {
    const arm = createHoverArm();
    moveHover(arm, 400, 300);
    expect(moveHover(arm, 400 + COIL.capture.rearmPx + 1, 300)).toBe(true);
    expect(arm.armed).toBe(true);
    expect(moveHover(arm, 900, 700)).toBe(false);
    expect(arm.armed).toBe(true);
  });

  it("waits again after the deal ends, from where the pointer last was: a pointer parked there arms nothing", () => {
    const arm = createHoverArm();
    moveHover(arm, 0, 0);
    moveHover(arm, 100, 100);
    expect(arm.armed).toBe(true);
    moveHover(arm, 640, 400); // where the click was
    disarmHover(arm);
    expect(arm.armed).toBe(false);
    // The browser's event for the title the columns put under it: same place.
    expect(moveHover(arm, 640, 400)).toBe(false);
    expect(moveHover(arm, 643, 400)).toBe(false);
    // A real move arms at once, even if it is the next event.
    expect(moveHover(arm, 700, 420)).toBe(true);
  });

  it("arms on a single move from far away (one hover jump), as a move to a title does", () => {
    const arm = createHoverArm();
    moveHover(arm, 20, 20);
    disarmHover(arm);
    expect(moveHover(arm, 900, 500)).toBe(true);
  });
});
