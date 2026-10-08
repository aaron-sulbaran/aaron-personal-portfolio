import type { StillWaitTimers } from "./stillWait";

// The still path's give-up (components/loader/runLoader.ts): the hero still
// never decodes, or not within the give-up, and the loader hands its lockup
// to the h1 lockup (a decoded still has the lockup fade out onto its own
// baked name instead, lib/loader/lockupFade.ts). The pane (if
// it showed) fades off the resting lockup, the lockup's ink eases to the
// h1's (lib/loader/inkEase.ts) over the fade, and the lockup leaves in one
// frame once that ink is exactly the h1's. Nothing fades the lockup itself:
// the h1 lockup under it is the same picture, so nothing pops.

export type StillOutcome = { decoded: () => void; gaveUp: () => void };

// The decode against the give-up timer: the first to land decides, once (a
// decode after the give-up is ignored). The returned function stops both.
export function raceStill(decoded: Promise<void>, giveUpMs: number, timers: StillWaitTimers, on: StillOutcome): () => void {
  let decided = false;
  let timer = 0;
  const stop = () => {
    decided = true;
    timers.clear(timer);
  };
  const decide = (outcome: () => void) => () => {
    if (decided) return;
    stop();
    outcome();
  };
  timer = timers.set(decide(on.gaveUp), giveUpMs);
  decoded.then(decide(on.decoded), decide(on.gaveUp));
  return stop;
}

export type GiveUpSteps = {
  paneShown: boolean; // the load outlived the guard
  fadeMs: number;
  timers: StillWaitTimers;
  fadePane: (ms: number, done: () => void) => void; // the pane and its ground, off the resting lockup
  rest: () => void; // the resting lockup alone on the hero
  ink: { start: () => void; settle: () => void };
  gone: () => void;
  note: (event: string) => void;
  // ?coildebug=handoff: the hand-off, then the leave, each wait on the caller.
  hold?: (step: () => void) => void;
};

// Runs the give-up's hand-off; the returned function stops it.
export function giveUpToHeading({ paneShown, fadeMs, timers, fadePane, rest, ink, gone, note, hold }: GiveUpSteps): () => void {
  let begun = false;
  let stopped = false;
  let timer = 0;
  const leave = () => {
    if (stopped) return;
    stopped = true;
    ink.settle();
    gone();
    note("still-gaveup");
  };
  const ease = () => {
    if (stopped) return;
    rest();
    ink.start();
    if (hold) hold(leave);
    else timer = timers.set(leave, fadeMs);
  };
  const begin = () => {
    if (stopped || begun) return;
    begun = true;
    if (paneShown) fadePane(fadeMs, ease);
    else ease();
  };
  note("still-failed");
  if (hold) hold(begin);
  else begin();
  return () => {
    stopped = true;
    timers.clear(timer);
  };
}
