// The story's layout, as pure data (slice 4c). The four blocks of intro.blocks
// are told in two places: the first screen holds blocks 1 and 2 ("who", "work"),
// and "More about me" (#about, after the cards) holds blocks 3 and 4 ("outside",
// "from"). A phone's first screen is the name, block 1, the wave, the ribbon and
// the button, so block 2 goes down to the about section there by default (a
// knob puts it on the first screen). The blocks lean to alternating sides
// (staggered), the first of each section on the left.
//
// The page renders block 2 in both places and CSS shows the one that applies
// (app/globals.css: display none removes the other from the reading order too),
// so the server's first paint never waits on a knob.

export const TOP_LAYOUTS = ["beside", "above"] as const;
export type TopLayout = (typeof TOP_LAYOUTS)[number];

export const PHONE_BLOCK2 = ["about", "first"] as const;
export type PhoneBlock2 = (typeof PHONE_BLOCK2)[number];

export const FIELD_UNDER_TEXT = ["faded", "full"] as const;
export type FieldUnderText = (typeof FIELD_UNDER_TEXT)[number];

export type Side = "left" | "right";
export type Stagger = { side: Side; shift: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

// The blocks alternate, the first on the left. A right block is pushed across
// `offset` of the free width (the column less the block's own measure); a left
// block sits flush.
export function staggerPlan(count: number, offset: number): Stagger[] {
  const shift = clamp01(offset);
  return Array.from({ length: Math.max(0, count) }, (_, i) => (i % 2 === 0 ? { side: "left", shift: 0 } : { side: "right", shift }));
}

// Which of the blocks (by index into intro.blocks) each place tells.
export const FIRST_SCREEN_BLOCKS = [0, 1] as const;
export const ABOUT_BLOCKS = [2, 3] as const;
// The block a phone's first screen may take or leave.
export const PHONE_MOVABLE_BLOCK = 1;

// Whether the first screen's own copy of block 2 shows on a phone, and the
// about section's: exactly one of them does.
export function phoneBlock2Shows(choice: PhoneBlock2): { firstScreen: boolean; about: boolean } {
  return { firstScreen: choice === "first", about: choice !== "first" };
}
