// The loader's continuity exit lands its DOM name exactly on the name the
// scene draws, then hands off in one frame. The scene lives in a dynamic chunk
// behind CoilStage, and the loader sits in the controller, so the two meet
// here: the stage provides the scene's name rect and its landing, the loader
// reads the rect when its exit starts and lands the name when it ends.

export type Rgb = readonly [number, number, number]; // sRGB bytes

// The canvas name in viewport px, for the handoff.
export type NameTarget = {
  readonly left: number; // the ink's left edge
  readonly baseline: number;
  readonly width: number; // the ink's width
  readonly fontPx: number;
  // The letters' vertical gradient spans the name mask's rect; outside it
  // the end colors hold (the composite clamps the same way).
  readonly gradient: { readonly top: number; readonly height: number; readonly from: Rgb; readonly to: Rgb };
  // How much of the gradient the letters carry over the field (about 26
  // percent: 12 percent ink at the lab's 2.2 gain). A DOM name in the
  // gradient at this opacity over the canvas composites to the same pixels.
  readonly inkAlpha: number;
};

export type NameHandoff = {
  target: () => NameTarget | null;
  // Shows the canvas name this frame (the scene renders synchronously).
  land: () => void;
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

export function landName() {
  provider?.land();
}
