// The still page's notice (components/coil/StillNotice.tsx): dismissed once,
// gone on every later visit. Kept in localStorage; a blocked or missing
// storage keeps the dismissal in memory for the visit and never throws (as
// createHintStore, lib/cursor/hover.ts).
export const STILL_NOTICE_KEY = "aaron-still-notice";

type NoticeStorage = Pick<Storage, "getItem" | "setItem">;

export type StillNoticeStore = {
  dismissed: () => boolean;
  dismiss: () => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStillNoticeStore(storage: NoticeStorage | null): StillNoticeStore {
  let memory = false;
  const listeners = new Set<() => void>();
  const stored = () => {
    try {
      return storage?.getItem(STILL_NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  };
  return {
    dismissed: () => memory || stored(),
    dismiss() {
      if (memory) return;
      memory = true;
      try {
        storage?.setItem(STILL_NOTICE_KEY, "1");
      } catch {
        // Blocked storage: the memory copy carries this visit.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function browserStorage(): NoticeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let shared: StillNoticeStore | null = null;
// The page's one store, made on first use in the browser.
export function stillNoticeStore(): StillNoticeStore {
  shared ??= createStillNoticeStore(browserStorage());
  return shared;
}
