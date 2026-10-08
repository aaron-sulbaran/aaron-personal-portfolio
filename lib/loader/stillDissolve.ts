import { gsap } from "@/lib/gsap";
import { siteEase } from "@/lib/coil/motion";
import { COIL } from "@/lib/coil/constants";
import { LOADER } from "./progress";
import type { StillPoster } from "./still";
import { createStillWait, listenStillFade, type StillWaitTimers } from "./stillWait";
import { giveUpToHeading, raceStill } from "./stillGiveUp";
import { createInkEase, type InkEase } from "./inkEase";
import { createLockupFade } from "./lockupFade";
import { stillMove } from "./stillLanding";
import { landingTransform } from "./continuity";
import { LOADER_LOCKUP, type LockupMetrics } from "./lockup";

// The loader's still path (components/loader/runLoader.ts), when no scene can
// run. Once the still has decoded, the pane (if it showed) fades off the
// resting lockup; the lockup lands on the name the still bakes, where cover
// shows it (stillLanding.ts: the continuity's landing and timing; none within
// 1px); then the still fades in UNDER it over stillFadeMs (loaderMarkup.ts
// lifts its hold on data-dissolve), the lockup at the composite's ink, and
// when that fade ends the lockup fades out over lockupFadeMs onto the baked
// name (lockupFade.ts), then goes. A still that fails to decode, or not within
// handoffGiveUpMs, hands to the h1 lockup in one frame, never fading the
// lockup (stillGiveUp.ts).

export type StillDissolveParts = {
  root: HTMLElement;
  bg: HTMLElement;
  pane: HTMLElement;
  paneShown: boolean; // the load outlived the guard
  metrics: () => LockupMetrics; // the face's, as last measured
  // ?coildebug=handoff: each step waits on the caller (window.__coilLoader.finish()).
  hold: ((step: () => void) => void) | null;
  timers: StillWaitTimers;
  reveal: (startMs: number, nameFromLoader: boolean) => void;
  gone: () => void;
  note: (event: string, data?: unknown) => void;
  disposed: () => boolean;
};

// Runs the still path; the returned function stops it.
export function stillDissolve(poster: StillPoster, parts: StillDissolveParts): () => void {
  const { root, paneShown, hold, timers, reveal, gone, note, disposed } = parts;
  const holdHandoff = hold !== null;
  let timeline: gsap.core.Timeline | null = null;
  let stopStill = () => {};
  let ink: InkEase | null = null;
  note("still");
  const layer = root.querySelector<HTMLElement>(LOADER_LOCKUP.layer);
  const readInk = () => getComputedStyle(layer!).opacity;
  const fadePane = (done: () => void) => {
    timeline = gsap.timeline({ onComplete: done });
    timeline.to([parts.bg, parts.pane], { opacity: 0, duration: LOADER.stillFadeMs / 1000, ease: "none" });
  };
  let fading = false;
  const fadeLockup = () => {
    if (disposed() || fading) return;
    fading = true;
    stopStill();
    note("lockup-fade");
    const done = () => {
      gone();
      note("still-handoff");
    };
    const fade = createLockupFade({
      layer, read: readInk, ms: LOADER.lockupFadeMs, slackMs: holdHandoff ? null : LOADER.stillFadeSlackMs,
      startGuardMs: LOADER.lockupFadeMs + LOADER.stillFadeSlackMs + LOADER.handoffGiveUpMs, timers, done,
    });
    stopStill = fade.cancel;
    fade.start();
  };
  // The lockup's fade starts when the still's own fade ends (?coildebug=handoff:
  // on finish()); the backup timer runs from the fade's transitionrun, not
  // from here (stillWait.ts).
  const afterStillFade = () => {
    const wait = createStillWait({
      fadeMs: LOADER.stillFadeMs, slackMs: LOADER.stillFadeSlackMs,
      startGuardMs: LOADER.stillFadeMs + LOADER.stillFadeSlackMs + LOADER.handoffGiveUpMs,
      timers, leave: holdHandoff ? () => {} : fadeLockup,
    });
    stopStill = listenStillFade(document.querySelector("[data-hero-still]"), wait);
  };
  const under = () => {
    if (disposed()) return;
    root.setAttribute("data-state", "rest");
    root.setAttribute("data-dissolve", "");
    note("dissolve");
    reveal(performance.now() + LOADER.stillFadeMs, false);
    afterStillFade();
    hold?.(fadeLockup);
  };
  const land = () => {
    const name = root.querySelector<HTMLElement>(LOADER_LOCKUP.name);
    const move = layer && name && stillMove(layer, name, poster.target(), parts.metrics());
    if (disposed() || !move) return under();
    note("still-land", { land: move.land });
    const state = { e: 0 };
    const step = () => void (layer!.style.transform = landingTransform(move.land, state.e));
    layer!.style.transformOrigin = move.origin;
    timeline = gsap.timeline({ onComplete: under }).to(state, { e: 1, duration: LOADER.exitMs / 1000, ease: siteEase, onUpdate: step });
  };
  const decoded = () => {
    if (disposed()) return;
    const begin = () => (paneShown ? fadePane(land) : land());
    if (!hold) return begin();
    note("still-held");
    hold(begin);
  };
  const gaveUp = () => {
    if (disposed()) return;
    stopStill = giveUpToHeading({
      paneShown, fadeMs: LOADER.stillFadeMs, timers, fadePane: (_, done) => fadePane(done), gone, note,
      ink: (ink = createInkEase(layer, readInk, COIL.lockup.stillInk, LOADER.stillFadeMs)),
      rest: () => {
        root.setAttribute("data-state", "rest");
        reveal(performance.now() + LOADER.stillFadeMs, false);
      },
      hold: hold ?? undefined,
    });
  };
  stopStill = raceStill(poster.decoded(), LOADER.handoffGiveUpMs, timers, { decoded, gaveUp });
  return () => {
    stopStill();
    ink?.cancel();
    timeline?.kill();
  };
}
