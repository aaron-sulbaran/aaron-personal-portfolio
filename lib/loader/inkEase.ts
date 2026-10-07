// The resting lockup's ink on the give-up path (lib/loader/stillGiveUp.ts,
// a hero still that never decodes): the layer eases from the composite's ink
// to the h1's (COIL.lockup.stillInk), linear over stillFadeMs, so the frame
// the loader goes the h1 lockup underneath is the same picture.
// A Web Animation, like the still's own transition, so a test can hold both
// at one time. settle() pins the target exactly for the hand-off frame;
// nothing starts after it.

type Layer = {
  animate: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => { cancel: () => void };
  style: { opacity: string };
};

export type InkEase = { start: () => void; settle: () => void; cancel: () => void };

export function createInkEase(layer: Layer | null, read: () => string, to: number, ms: number): InkEase {
  let running: { cancel: () => void } | null = null;
  let settled = false;
  const cancel = () => {
    running?.cancel();
    running = null;
  };
  return {
    start() {
      if (!layer || running || settled) return;
      running = layer.animate([{ opacity: read() }, { opacity: String(to) }], { duration: ms, easing: "linear", fill: "forwards" });
    },
    settle() {
      if (!layer) return;
      settled = true;
      layer.style.opacity = String(to);
      cancel();
    },
    cancel,
  };
}
