import type { StillTheme } from "@/lib/coil/heroStill";

// The hero still's readiness, per theme (components/coil/useHeroStill.ts).
// The still carries the hero's name only once the current theme's picture
// has decoded: ready is data-still-ready, and the h1 lockup is the name until
// then, so a theme toggle to a still not yet decoded brings the h1 back at
// once. Once the current theme is ready the other theme's still is warmed
// (decoded ahead), so a toggle is usually instant. Nothing remembers a
// failure: a rejected decode clears its entry and the next need decodes
// again. warm: a still has shown, so both pictures may load eagerly.

export type StillView = { ready: boolean; warm: boolean };

export const STILL_OFF: StillView = Object.freeze({ ready: false, warm: false });

export type StillReadinessDeps = {
  decode: (theme: StillTheme) => Promise<void>; // fetched, decoded, a natural width
};

export type StillReadiness = {
  show: (theme: StillTheme) => void; // the current theme, at the start and on every change
  decoded: () => Promise<void>; // the current theme's decode, for the loader
  view: () => StillView;
  subscribe: (listener: () => void) => () => void;
};

const other = (theme: StillTheme): StillTheme => (theme === "dark" ? "light" : "dark");

export function createStillReadiness({ decode }: StillReadinessDeps): StillReadiness {
  const decodes = new Map<StillTheme, { promise: Promise<void>; ready: boolean }>();
  const listeners = new Set<() => void>();
  let current: StillTheme | null = null;
  let view = STILL_OFF;
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
    if (ready) {
      shown = true;
      need(other(current));
    }
    const next = { ready, warm: shown };
    if (next.ready === view.ready && next.warm === view.warm) return;
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
    view: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
