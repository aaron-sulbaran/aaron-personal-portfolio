// Page 1's story as pure data (slice 4d, two paragraphs since 2026-10-30). Both
// paragraphs of intro.blocks are told on page 1, whole and in order, on either
// side of the page: paragraph 1 ("who") sits to the right of the name, in the
// name's one row, then the soundtrack band runs across the page, then
// paragraph 2 ("outside") sits on the left, and the late grid's right-hand
// columns hold no words: they are the open player's room (app/globals.css,
// --player-room). A phone stacks the same order in one column. Nothing is told
// twice and nothing waits for a knob: the server's first paint is this plan.

export type Side = "left" | "right";

// Which side each block (by its index in intro.blocks) leans to.
export const STORY_SIDES: readonly Side[] = ["right", "left"];

// The block beside the name, then the one after the wave.
export const TOP_BLOCKS = [0] as const;
export const LATE_BLOCKS = [1] as const;

export function sideOf(index: number): Side {
  return STORY_SIDES[index] ?? "left";
}
