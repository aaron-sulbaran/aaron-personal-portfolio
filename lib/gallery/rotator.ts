// A turning frame's clock gate (the lab's stage.ts at ae9b6dd, round five): it
// runs only with two photos or more, motion allowed, the start delay past, not
// paused, not held (hovered, keyboard-focused or touched), and at least a third
// of the frame on screen. Pure.

export const wrap = (index: number, count: number) => (count <= 0 ? 0 : ((index % count) + count) % count);

export interface RotatorGate { count: number; reduced: boolean; started: boolean; paused: boolean; held: boolean; visible: boolean }

export const rotatorRuns = (g: RotatorGate) => g.count > 1 && !g.reduced && g.started && !g.paused && !g.held && g.visible;

// What ran is spent, so a pause resumes where it left off.
export const remainingAfter = (remainingMs: number, ranMs: number) => Math.max(0, remainingMs - Math.max(0, ranMs));
