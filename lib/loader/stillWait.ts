// The loader's wait for the hero still's fade, before the resting lockup
// fades out (components/loader/runLoader.ts). Its fade starts when the
// still's ends or is cancelled; should no end come, slackMs past the fade's length
// timed from the fade's own start (a main-thread stall between data-dissolve
// and React's commit of data-still-ready cannot start it mid-fade); and should the fade never start (no :has(), the still already
// at full opacity), at the start guard. leave runs at most once; dispose
// clears everything and nothing leaves after it.

export type StillWaitTimers = {
  set: (fn: () => void, ms: number) => number;
  clear: (id: number) => void;
};

export type StillWaitOptions = {
  fadeMs: number;
  slackMs: number;
  startGuardMs: number;
  timers: StillWaitTimers;
  leave: () => void;
};

export type StillWait = {
  started: () => void; // the still's opacity transitionrun
  ended: () => void; // its transitionend
  cancelled: () => void; // its transitioncancel
  dispose: () => void;
};

export function createStillWait({ fadeMs, slackMs, startGuardMs, timers, leave }: StillWaitOptions): StillWait {
  let done = false;
  let timer = 0;
  const arm = (ms: number) => {
    timers.clear(timer);
    timer = timers.set(finish, ms);
  };
  const dispose = () => {
    done = true;
    timers.clear(timer);
  };
  function finish() {
    if (done) return;
    dispose();
    leave();
  }
  arm(startGuardMs);
  return {
    started: () => {
      if (done) return;
      arm(fadeMs + slackMs);
    },
    ended: finish,
    cancelled: finish,
    dispose,
  };
}

// The still's own opacity transition drives the wait: its run, end and
// cancel, nothing else. Returns the stop: listeners off, the wait disposed.
export function listenStillFade(still: EventTarget | null, wait: StillWait): () => void {
  const phases: Record<string, () => void> = { transitionrun: wait.started, transitionend: wait.ended, transitioncancel: wait.cancelled };
  const onPhase = (event: Event) => {
    if (event.target === still && (event as Event & { propertyName?: string }).propertyName === "opacity") phases[event.type]();
  };
  Object.keys(phases).forEach((type) => still?.addEventListener(type, onPhase));
  return () => {
    Object.keys(phases).forEach((type) => still?.removeEventListener(type, onPhase));
    wait.dispose();
  };
}
