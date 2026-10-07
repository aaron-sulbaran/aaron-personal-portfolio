import { describe, expect, it, vi } from "vitest";
import { createInkEase } from "@/lib/loader/inkEase";

function fakeLayer(opacity = "0.264") {
  const cancel = vi.fn();
  const animate = vi.fn((keyframes: Keyframe[], options: KeyframeAnimationOptions) => ({ keyframes, options, cancel }));
  return { layer: { animate, style: { opacity: "" } }, animate, cancel, read: () => opacity };
}

describe("the resting lockup's ink ease onto the h1's", () => {
  it("runs linear from the layer's composite ink to the target over the fade, holding the end", () => {
    const { layer, animate, read } = fakeLayer();
    createInkEase(layer, read, 0.9, 400).start();
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0];
    expect(keyframes).toEqual([{ opacity: "0.264" }, { opacity: "0.9" }]);
    expect(options).toEqual({ duration: 400, easing: "linear", fill: "forwards" });
  });

  it("starts once, settles exactly on the target, and never starts after settling", () => {
    const { layer, animate, cancel, read } = fakeLayer();
    const ease = createInkEase(layer, read, 0.9, 400);
    ease.start();
    ease.start();
    expect(animate).toHaveBeenCalledTimes(1);
    ease.settle();
    expect(layer.style.opacity).toBe("0.9");
    expect(cancel).toHaveBeenCalledTimes(1);
    ease.start();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("settles without a start (the fade never began) and cancels on teardown", () => {
    const settled = fakeLayer();
    createInkEase(settled.layer, settled.read, 0.95, 400).settle();
    expect(settled.layer.style.opacity).toBe("0.95");
    const torn = fakeLayer();
    const ease = createInkEase(torn.layer, torn.read, 0.9, 400);
    ease.start();
    ease.cancel();
    expect(torn.cancel).toHaveBeenCalledTimes(1);
    expect(torn.layer.style.opacity).toBe("");
  });

  it("does nothing without a layer", () => {
    const ease = createInkEase(null, () => "0", 0.9, 400);
    expect(() => {
      ease.start();
      ease.settle();
      ease.cancel();
    }).not.toThrow();
  });
});
