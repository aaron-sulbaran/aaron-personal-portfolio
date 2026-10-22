// The canvas lockup ("Hi, I'm" over "Aaron") as the scene reports it in
// viewport px (the scene's nameRect, scene/name.ts).

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
