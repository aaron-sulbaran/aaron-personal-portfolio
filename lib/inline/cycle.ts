// A pop that cycles (register pop.cycle, shown by components/inline/PopCycle):
// one photo at a time in one square frame, crossfading to the next on this
// beat while the pop is open. The beat is the same under reduced motion, where
// the photos swap instantly instead of fading.
export const POP_CYCLE_MS = 1600;

// The frame after index, looping back to the first.
export const nextFrame = (index: number, count: number): number => (count > 0 ? (index + 1) % count : 0);

export type FrameState = "active" | "previous" | "idle";

// What each photo is doing: the active one fades in on top, the one it replaces
// stays whole underneath until it has (so the pair never dips to the page behind),
// and the rest are hidden. previous is -1 before the first change.
export function frameState(index: number, active: number, previous: number): FrameState {
  return index === active ? "active" : index === previous ? "previous" : "idle";
}
