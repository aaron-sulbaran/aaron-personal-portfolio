// The custom cursor's hover signal from the Coil canvas. DOM targets opt in
// with [data-cursor-hover] and the cursor finds them with closest(); a card in
// the canvas has no element, and it moves under a still pointer (the coil
// spins), so the scene publishes "a card is under the pointer" here every time
// it changes and CustomCursor subscribes. The canvas never sets a CSS cursor.

let hovering = false;
const listeners = new Set<() => void>();

export function getSceneHover(): boolean {
  return hovering;
}

export function setSceneHover(next: boolean) {
  if (hovering === next) return;
  hovering = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSceneHover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---- fx-hero: the first-visit hint ----
// Until a visitor opens their first card, hovering a card swells the custom
// cursor into an "Open me" pill (CustomCursor); after that it never appears
// again, on any visit. The one-time lines ("Keep exploring", "Tap a card") are
// once-ever too. Kept in localStorage; a blocked or missing storage keeps the
// state in memory for the visit and never throws.
export const HINT_OPENED_KEY = "aaron-hint-opened";

type HintStorage = Pick<Storage, "getItem" | "setItem">;

export type HintStore = {
  opened: () => boolean;
  markOpened: () => void;
  subscribe: (listener: () => void) => () => void;
  // True the first time a once-ever line asks, false forever after.
  takeOnce: (key: string) => boolean;
};

export function createHintStore(storage: HintStorage | null): HintStore {
  const memory = new Map<string, string>();
  const read = (key: string) => {
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string) => {
    memory.set(key, "1");
    try {
      storage?.setItem(key, "1");
    } catch {
      // Blocked storage: the memory copy carries this visit.
    }
  };
  const hintListeners = new Set<() => void>();
  return {
    opened: () => read(HINT_OPENED_KEY) === "1",
    markOpened() {
      if (read(HINT_OPENED_KEY) === "1") return;
      write(HINT_OPENED_KEY);
      hintListeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      hintListeners.add(listener);
      return () => {
        hintListeners.delete(listener);
      };
    },
    takeOnce(key) {
      if (read(key) === "1") return false;
      write(key);
      return true;
    },
  };
}

function browserStorage(): HintStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let shared: HintStore | null = null;
// The page's one store, made on first use in the browser.
export function hintStore(): HintStore {
  shared ??= createHintStore(browserStorage());
  return shared;
}
// ---- end fx-hero ----
