import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutsidePress } from "@/components/modal/useOutsidePress";
import { OUTSIDE_TAP_PX, closesOnPress, type Press } from "@/lib/outsidePress";

const backdrop = (x: number, y: number): Press => ({ onBackdrop: true, x, y });
const panel = (x: number, y: number): Press => ({ onBackdrop: false, x, y });

describe("when a press closes a modal", () => {
  it("closes on a press that goes down and comes up on the backdrop, in the same place", () => {
    expect(closesOnPress(backdrop(20, 30), backdrop(20, 30))).toBe(true);
    expect(closesOnPress(backdrop(20, 30), backdrop(24, 33))).toBe(true);
    expect(closesOnPress(backdrop(0, 0), backdrop(OUTSIDE_TAP_PX, 0))).toBe(true);
  });

  it("never closes on a press that began in the panel, however far it went and wherever it ended: a selection, a slider, the pager's swipe", () => {
    expect(closesOnPress(panel(200, 300), backdrop(200, 300))).toBe(false);
    expect(closesOnPress(panel(200, 300), backdrop(10, 10))).toBe(false);
    expect(closesOnPress(panel(200, 300), panel(10, 10))).toBe(false);
  });

  it("never closes on a press that ends in the panel, a drag that began outside", () => {
    expect(closesOnPress(backdrop(10, 10), panel(10, 12))).toBe(false);
    expect(closesOnPress(backdrop(10, 10), panel(200, 300))).toBe(false);
  });

  it("never closes on a drag or a swipe that began and ended outside: further than a tap is a scroll", () => {
    expect(closesOnPress(backdrop(0, 0), backdrop(OUTSIDE_TAP_PX + 1, 0))).toBe(false);
    expect(closesOnPress(backdrop(100, 100), backdrop(100, 40))).toBe(false);
    expect(closesOnPress(backdrop(100, 100), backdrop(20, 100))).toBe(false);
  });

  it("never closes without a press that went down, or one that was cancelled", () => {
    expect(closesOnPress(null, backdrop(10, 10))).toBe(false);
  });
});

// The hook as a modal uses it: its handlers on the backdrop element, fed events as the browser gives them.
type Handlers = ReturnType<typeof useOutsidePress>;
function mount(onClose: () => void): Handlers {
  let handlers!: Handlers;
  function Probe() {
    handlers = useOutsidePress(onClose);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return handlers;
}
const BACKDROP = { id: "backdrop" };
const PANEL = { id: "panel" };
const pointer = (target: object, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ target, currentTarget: BACKDROP, clientX: x, clientY: y, isPrimary: true, button: 0, ...extra }) as never;

describe("a tap or click on the backdrop", () => {
  const listeners: Array<{ type: string; capture: boolean }> = [];
  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener: (type: string, _fn: unknown, options: { capture: boolean }) => listeners.push({ type, capture: options.capture }),
      removeEventListener: () => {},
      setTimeout: () => 0,
    });
  });
  afterEach(() => {
    listeners.length = 0;
    vi.unstubAllGlobals();
  });

  it("closes the modal once, and swallows the click that follows so it cannot land on the page beneath", () => {
    const onClose = vi.fn();
    const outside = mount(onClose);
    outside.onPointerDown(pointer(BACKDROP, 40, 40));
    outside.onPointerUp(pointer(BACKDROP, 41, 40));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(listeners).toEqual([{ type: "click", capture: true }]);
  });

  it("does not close for a press that began in the panel and was released over the backdrop (a text selection dragged out)", () => {
    const onClose = vi.fn();
    const outside = mount(onClose);
    outside.onPointerDown(pointer(PANEL, 300, 300));
    outside.onPointerUp(pointer(BACKDROP, 10, 10));
    expect(onClose).not.toHaveBeenCalled();
    expect(listeners).toEqual([]);
  });

  it("does not close for a press that began on the backdrop and was released over the panel", () => {
    const onClose = vi.fn();
    const outside = mount(onClose);
    outside.onPointerDown(pointer(BACKDROP, 10, 10));
    outside.onPointerUp(pointer(PANEL, 12, 12));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close for a swipe, a cancelled touch (the browser took it to scroll) or a second finger", () => {
    const onClose = vi.fn();
    const outside = mount(onClose);
    outside.onPointerDown(pointer(BACKDROP, 10, 200));
    outside.onPointerUp(pointer(BACKDROP, 10, 120));
    outside.onPointerDown(pointer(BACKDROP, 10, 200));
    outside.onPointerCancel();
    outside.onPointerUp(pointer(BACKDROP, 10, 200));
    outside.onPointerDown(pointer(BACKDROP, 10, 200, { isPrimary: false }));
    outside.onPointerUp(pointer(BACKDROP, 10, 200, { isPrimary: false }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores the mouse's other buttons, and a release with no press of its own", () => {
    const onClose = vi.fn();
    const outside = mount(onClose);
    outside.onPointerDown(pointer(BACKDROP, 10, 10, { button: 2 }));
    outside.onPointerUp(pointer(BACKDROP, 10, 10, { button: 2 }));
    outside.onPointerUp(pointer(BACKDROP, 10, 10));
    expect(onClose).not.toHaveBeenCalled();
  });
});
