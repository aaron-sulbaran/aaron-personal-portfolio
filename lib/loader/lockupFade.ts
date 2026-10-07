import type { StillWaitTimers } from "./stillWait";

// The resting lockup's leave on the still path (components/loader/runLoader.ts):
// once the hero still is fully in, the layer fades from the composite's ink to
// 0, linear over ms, onto the name the still bakes behind its cards, and done
// runs when that fade finishes (the loader goes). A Web Animation, like the
// still's own transition, so a test can hold it; should its end never come,
// done runs at ms plus slackMs. The layer is pinned at 0 before done; done
// runs at most once, and nothing runs after cancel.

type Layer = {
  animate: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => { cancel: () => void; finished: Promise<unknown> };
  style: { opacity: string };
};

export type LockupFadeOptions = {
  layer: Layer | null;
  read: () => string;
  ms: number;
  slackMs: number;
  timers: StillWaitTimers;
  done: () => void;
};

export type LockupFade = { start: () => void; cancel: () => void };

export function createLockupFade({ layer, read, ms, slackMs, timers, done }: LockupFadeOptions): LockupFade {
  let over = false;
  let timer = 0;
  let running: { cancel: () => void } | null = null;
  const cancel = () => {
    over = true;
    timers.clear(timer);
    running?.cancel();
    running = null;
  };
  const finish = () => {
    if (over) return;
    if (layer) layer.style.opacity = "0";
    cancel();
    done();
  };
  return {
    start() {
      if (over || running) return;
      if (!layer) return finish();
      const fade = layer.animate([{ opacity: read() }, { opacity: "0" }], { duration: ms, easing: "linear", fill: "forwards" });
      running = fade;
      fade.finished.then(finish, () => {});
      timer = timers.set(finish, ms + slackMs);
    },
    cancel,
  };
}
