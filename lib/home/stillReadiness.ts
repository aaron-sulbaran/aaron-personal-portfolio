import type { StillTheme } from "@/lib/coil/heroStill";

// The hero still's readiness, per theme (components/coil/useHeroStill.ts).
// The still carries the hero's name only once the current theme's picture
// has decoded: ready is data-still-ready, and the h1 lockup is the name until
// then, so a theme toggle to a still not yet decoded brings the h1 back at
// once. Once the current theme is ready the other theme's still is warmed
// (decoded ahead), so a toggle is usually instant. Nothing remembers a
// failure: a rejected decode clears its entry and the next need decodes
// again.
//
// late is data-still-late: the still arrived after the hero had already
// handed its name to the h1 lockup (the loader gave up on it, or a toggle
// dropped the still), so it comes in with its own dissolve (loaderMarkup.ts)
// rather than the loader's. settle() ends it. Never under reduced motion.
// warm: a still has shown, so both pictures may load eagerly.

export type StillView = { ready: boolean; late: boolean; warm: boolean };

export const STILL_OFF: StillView = Object.freeze({ ready: false, late: false, warm: false });

export type StillReadinessDeps = {
  decode: (theme: StillTheme) => Promise<void>; // fetched, decoded, a natural width
  gaveUp: () => boolean; // the loader gave up on the still (lib/loader/still.ts)
  motion: () => boolean; // no reduced motion
};

export type StillReadiness = {
  show: (theme: StillTheme) => void; // the current theme, at the start and on every change
  decoded: () => Promise<void>; // the current theme's decode, for the loader
  settle: () => void; // the late dissolve has ended
  view: () => StillView;
  subscribe: (listener: () => void) => () => void;
};

const other = (theme: StillTheme): StillTheme => (theme === "dark" ? "light" : "dark");

export function createStillReadiness({ decode, gaveUp, motion }: StillReadinessDeps): StillReadiness {
  const decodes = new Map<StillTheme, { promise: Promise<void>; ready: boolean }>();
  const listeners = new Set<() => void>();
  let current: StillTheme | null = null;
  let view = STILL_OFF;
  let late = false;
  let shown = false;

  const need = (theme: StillTheme): Promise<void> => {
    const known = decodes.get(theme);
    if (known) return known.promise;
    const entry = { promise: decode(theme), ready: false };
    decodes.set(theme, entry);
    entry.promise.then(
      () => {
        if (decodes.get(theme) !== entry) return;
        entry.ready = true;
        update();
      },
      () => {
        if (decodes.get(theme) === entry) decodes.delete(theme);
      },
    );
    return entry.promise;
  };

  function update() {
    if (!current) return;
    const ready = decodes.get(current)?.ready ?? false;
    if (ready && !view.ready) late = (shown || gaveUp()) && motion();
    if (!ready) late = false;
    if (ready) {
      shown = true;
      need(other(current));
    }
    const next = { ready, late, warm: shown };
    if (next.ready === view.ready && next.late === view.late && next.warm === view.warm) return;
    view = next;
    listeners.forEach((listener) => listener());
  }

  return {
    show(theme) {
      current = theme;
      need(theme);
      update();
    },
    decoded: () => (current ? need(current) : Promise.reject(new Error("no theme shown"))),
    settle() {
      if (!late) return;
      late = false;
      update();
    },
    view: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
