import { intro } from "./intro";

// The first-screen lab's one line under the name (/lab/first-screen, hero
// rework), three ways. Each is cut word for word from block 1 of intro.blocks
// (markup and all, so the product definition still opens), so nothing new is
// written here: if Aaron rewrites that block, these follow it.
const [first, second] = intro.blocks[0].sentences;

export const FIRST_SCREEN_LINES = {
  none: null,
  short: first,
  long: `${first} ${second}`,
} as const;

export type FirstScreenLine = keyof typeof FIRST_SCREEN_LINES;
