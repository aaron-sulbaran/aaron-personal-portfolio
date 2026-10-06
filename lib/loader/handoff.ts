// The loader lands its DOM lockup ("Hi, I'm" over "Aaron") exactly on the
// lockup the scene draws, then hands off in one frame. The scene lives in a
// dynamic chunk behind CoilStage, and the loader sits in the controller, so
// the two meet here: the stage provides the scene's lockup rect and its
// landing, the loader reads the rect when its exit starts and lands the
// lockup when it ends (or, on a fast load, as soon as the scene has drawn).

export type Rgb = readonly [number, number, number]; // sRGB bytes

// The greeting's ink in viewport px: its left edge, its baseline, its size.
export type GreetingTarget = { readonly left: number; readonly baseline: number; readonly fontPx: number };

// The canvas lockup in viewport px, for the handoff.
export type NameTarget = {
  readonly left: number; // the ink's left edge
  readonly baseline: number;
  readonly width: number; // the ink's width
  readonly fontPx: number;
  readonly greeting: GreetingTarget;
  // The letters' vertical gradient spans the name mask's rect; outside it
  // the end colors hold (the composite clamps the same way).
  readonly gradient: { readonly top: number; readonly height: number; readonly from: Rgb; readonly to: Rgb };
  // How much of the gradient the letters carry over the field (about 26
  // percent: 12 percent ink at the lab's 2.2 gain). A DOM name in the
  // gradient at this opacity over the canvas composites to the same pixels.
  // The greeting sits above the gradient's rect, so it wears `from` solid.
  readonly inkAlpha: number;
};

export type NameHandoff = {
  target: () => NameTarget | null;
  // Shows the canvas lockup this frame (the scene renders synchronously);
  // false when the scene cannot take it yet (not drawn, or the entrance that
  // waits for the loader has not reached it), and nothing changed.
  land: () => boolean;
};

let provider: NameHandoff | null = null;

export function provideNameHandoff(handoff: NameHandoff): () => void {
  provider = handoff;
  return () => {
    if (provider === handoff) provider = null;
  };
}

export function nameTarget(): NameTarget | null {
  return provider?.target() ?? null;
}

export function landName(): boolean {
  return provider?.land() ?? false;
}
