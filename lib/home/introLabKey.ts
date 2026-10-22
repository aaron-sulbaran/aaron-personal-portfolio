// The localStorage keys the hero lab (/lab/hero) and its frames share. A
// module of its own so the head script (rendered by the server layout) can
// read the key without pulling in the knob store's React.

// The page 1 knobs (lib/home/introKnobs.ts); the deal's own keep the key the
// Deal lab chip wrote before (components/home/DealLab.tsx).
export const HERO_LAB_KEY = "hero-lab-v1";
export const DEAL_LAB_KEY = "deal-lab-v1";
// A counter per replay button: a frame replays when its value changes.
export const HERO_REPLAY_KEY = "hero-lab-replay-v1";
