// Page 1's story as pure data (slice 4d). All four blocks of intro.blocks are
// told on page 1, whole and in order, staggered so they use the page's width:
// block 1 ("who") sits to the right of the name, block 2 ("work") under the
// name on the left, then the soundtrack band runs across the page, then block 3
// ("outside") on the right and block 4 ("from") on the left. A phone stacks the
// same order in one column. Nothing is told twice and nothing waits for a
// knob: the server's first paint is this plan.

export type Side = "left" | "right";

// Which side each block (by its index in intro.blocks) leans to.
export const STORY_SIDES: readonly Side[] = ["right", "left", "right", "left"];

// The blocks around the name (beside it and under it), then the ones after the wave.
export const TOP_BLOCKS = [0, 1] as const;
export const LATE_BLOCKS = [2, 3] as const;

export function sideOf(index: number): Side {
  return STORY_SIDES[index] ?? "left";
}
