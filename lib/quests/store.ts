// The quest line's progress, in localStorage only. Stored data is untrusted:
// unknown ids, non-finite numbers and other versions are dropped. Every storage
// access is guarded, so private mode degrades to in-memory for this page view.
import { QUEST } from "./constants";
import type { QuestCategory, QuestFinish, QuestState } from "./types";
import { runProgress } from "./progress";

const CATEGORIES: readonly QuestCategory[] = ["any", "full"];
const VERSION = 1;

export interface QuestStoreOptions {
  storage: () => Storage | null;
  knownId: (id: string) => boolean;
  today?: () => string;
}

export interface QuestStore {
  getSnapshot(): QuestState;
  subscribe(listener: () => void): () => void;
  markFound(id: string): boolean;
  addClock(ms: number): void;
  persist(): void;
  reload(): void;
  reset(): void;
}

export const EMPTY_QUEST_STATE: QuestState = Object.freeze({ found: Object.freeze({}), clockMs: 0, finishes: Object.freeze({}) });

function localDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parse(raw: string | null, knownId: (id: string) => boolean): QuestState {
  if (!raw) return EMPTY_QUEST_STATE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_QUEST_STATE;
  }
  if (!data || typeof data !== "object") return EMPTY_QUEST_STATE;
  const record = data as Record<string, unknown>;
  if (record.v !== VERSION) return EMPTY_QUEST_STATE;
  const found: Record<string, number> = {};
  if (record.found && typeof record.found === "object" && !Array.isArray(record.found)) {
    for (const [id, at] of Object.entries(record.found)) if (knownId(id) && isFiniteNumber(at) && at >= 0) found[id] = at;
  }
  const finishes: Partial<Record<QuestCategory, QuestFinish>> = {};
  if (record.finishes && typeof record.finishes === "object") {
    const stored = record.finishes as Record<string, unknown>;
    for (const category of CATEGORIES) {
      const entry = stored[category];
      if (!entry || typeof entry !== "object") continue;
      const { ms, date } = entry as Record<string, unknown>;
      if (isFiniteNumber(ms) && ms >= 0 && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) finishes[category] = { ms, date };
    }
  }
  return { found, clockMs: isFiniteNumber(record.clockMs) && record.clockMs >= 0 ? record.clockMs : 0, finishes };
}

export function createQuestStore({ storage, knownId, today = localDate }: QuestStoreOptions): QuestStore {
  let state: QuestState = EMPTY_QUEST_STATE;
  let loaded = false;
  const listeners = new Set<() => void>();

  const access = (): Storage | null => {
    try {
      return storage();
    } catch {
      return null;
    }
  };

  const load = () => {
    loaded = true;
    try {
      state = parse(access()?.getItem(QUEST.storageKey) ?? null, knownId);
    } catch {
      state = EMPTY_QUEST_STATE;
    }
  };
  const ensure = () => {
    if (!loaded) load();
  };
  const emit = () => listeners.forEach((listener) => listener());

  const persist = () => {
    ensure();
    try {
      access()?.setItem(QUEST.storageKey, JSON.stringify({ v: VERSION, found: state.found, clockMs: state.clockMs, finishes: state.finishes }));
    } catch {
      // Blocked or full storage: progress lasts for this page view only.
    }
  };

  return {
    getSnapshot() {
      ensure();
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markFound(id) {
      ensure();
      if (!knownId(id) || id in state.found) return false;
      const found = { ...state.found, [id]: state.clockMs };
      const finishes = { ...state.finishes };
      const next: QuestState = { found, clockMs: state.clockMs, finishes };
      for (const category of CATEGORIES) {
        if (!finishes[category] && runProgress(next, category).complete) finishes[category] = { ms: state.clockMs, date: today() };
      }
      state = next;
      persist();
      emit();
      return true;
    },
    addClock(ms) {
      ensure();
      if (!isFiniteNumber(ms) || ms <= 0) return;
      state = { ...state, clockMs: state.clockMs + ms };
      emit();
    },
    persist,
    reload() {
      load();
      emit();
    },
    reset() {
      loaded = true;
      state = EMPTY_QUEST_STATE;
      try {
        access()?.removeItem(QUEST.storageKey);
      } catch {
        // Nothing to clear.
      }
      emit();
    },
  };
}
