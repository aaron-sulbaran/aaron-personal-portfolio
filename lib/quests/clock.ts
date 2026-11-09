// The run clock: visible time only, so a tab left open in the background does
// not run up the visitor's time. The store keeps the total; this feeds it.
import { QUEST } from "./constants";
import type { QuestStore } from "./store";

export interface RunClockOptions {
  store: Pick<QuestStore, "addClock" | "persist">;
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  win?: Pick<Window, "addEventListener" | "removeEventListener">;
  now?: () => number;
  setIntervalFn?: (handler: () => void, ms: number) => unknown;
  clearIntervalFn?: (handle: unknown) => void;
  persistEveryMs?: number;
  tickMs?: number;
}

export function startRunClock({
  store,
  doc = document,
  win = typeof window === "undefined" ? undefined : window,
  now = () => performance.now(),
  setIntervalFn = (handler, ms) => window.setInterval(handler, ms),
  clearIntervalFn = (handle) => window.clearInterval(handle as number),
  persistEveryMs = QUEST.persistEveryMs,
  tickMs = 1000,
}: RunClockOptions): () => void {
  let last = now();
  let running = doc.visibilityState === "visible";
  let sincePersist = 0;
  let handle: unknown = null;

  const flush = () => {
    const current = now();
    const delta = current - last;
    last = current;
    if (!running || delta <= 0) return;
    store.addClock(delta);
    sincePersist += delta;
  };

  const persistNow = () => {
    store.persist();
    sincePersist = 0;
  };

  const tick = () => {
    flush();
    if (sincePersist >= persistEveryMs) persistNow();
  };

  const onVisibility = () => {
    flush();
    running = doc.visibilityState === "visible";
    if (!running) persistNow();
  };
  const onPageHide = () => {
    flush();
    persistNow();
  };

  handle = setIntervalFn(tick, tickMs);
  doc.addEventListener("visibilitychange", onVisibility);
  win?.addEventListener("pagehide", onPageHide);
  return () => {
    clearIntervalFn(handle);
    doc.removeEventListener("visibilitychange", onVisibility);
    win?.removeEventListener("pagehide", onPageHide);
  };
}
