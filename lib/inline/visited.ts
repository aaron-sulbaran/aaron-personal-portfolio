// The links the visitor has clicked, kept in localStorage so a link they have
// followed or opened stays filled with the accent, like a visited link. The
// browser's :visited cannot style a background (the word's fill and the bar
// are backgrounds), so the stylesheet cannot know; instead this store turns
// into one CSS rule (visitedStyle) that sets --inline-p to 1 on the matching
// links. A rule outlives a SplitText rebuild of a line, which a mark on the
// node would not. One accent only: visited is the accent, never another hue.
//
// The same logic runs before first paint as a head script (visitedInitScript),
// so a returning visitor never sees their links empty and then fill; the
// functions below therefore stand alone (no outer names) and are printed into
// that script with toString. Every storage read and write is guarded and the
// store degrades to this page view only.

export const VISITED_STORAGE_KEY = "aaron-inline-visited";
export const VISITED_STYLE_ID = "inline-visited";

// "def:product", "tip:killer-drones", "pop:matcha" or "external:https://...".
// Stored values are untrusted: anything else is dropped, and the newest 200 stay.
export function parseVisited(raw: string | null | undefined): string[] {
  let list: unknown;
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const valid = /^(?:(?:def|tip|pop):[A-Za-z0-9_-]+|external:https?:\/\/[^\s"'\\<>]+)$/;
  const ids: string[] = [];
  for (const entry of list) if (typeof entry === "string" && valid.test(entry) && ids.indexOf(entry) < 0) ids.push(entry);
  return ids.slice(-200);
}

// One rule for every visited link, filled and with no tween (a returning
// visitor's links must not fill in on load, and a clicked link was already
// filled by the hover or press that clicked it).
export function visitedStyle(ids: readonly string[]): string {
  const selectors: string[] = [];
  for (const id of ids) {
    const split = id.indexOf(":");
    const kind = id.slice(0, split);
    const rest = id.slice(split + 1);
    selectors.push(
      kind === "external"
        ? `.inline-link[data-inline="external"][href="${rest.replace(/["\\]/g, "\\$&")}"]`
        : `.inline-link[data-inline="${kind}"][data-inline-key="${rest}"]`,
    );
  }
  return selectors.length ? `${selectors.join(",")}{--inline-p:1;transition:none}` : "";
}

export interface LinkIdentity {
  kind: string | undefined;
  key: string | undefined;
  href: string | null;
}

export function visitedId({ kind, key, href }: LinkIdentity): string | null {
  if (kind === "external") return href ? `external:${href}` : null;
  return (kind === "def" || kind === "tip" || kind === "pop") && key ? `${kind}:${key}` : null;
}

// Written into <head> by app/layout.tsx.
export const visitedInitScript = `(function(){try{var parse=${parseVisited.toString()};var style=${visitedStyle.toString()};var ids=parse(localStorage.getItem(${JSON.stringify(VISITED_STORAGE_KEY)}));if(ids.length){var el=document.createElement("style");el.id=${JSON.stringify(VISITED_STYLE_ID)};el.textContent=style(ids);document.head.appendChild(el);}}catch(e){}})();`;

const EMPTY: ReadonlySet<string> = new Set();
let snapshot: ReadonlySet<string> = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function hydrate() {
  if (hydrated) return;
  const store = storage();
  if (!store) return;
  hydrated = true;
  try {
    snapshot = new Set(parseVisited(store.getItem(VISITED_STORAGE_KEY)));
  } catch {
    // Blocked storage: start empty.
  }
}

export function getVisited(): ReadonlySet<string> {
  hydrate();
  return snapshot;
}

export function markVisited(id: string) {
  hydrate();
  if (snapshot.has(id)) return;
  const next = parseVisited(JSON.stringify([...snapshot, id]));
  if (!next.includes(id)) return;
  snapshot = new Set(next);
  try {
    storage()?.setItem(VISITED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or disabled storage: visited lasts for this page view only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeVisited(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// For tests: forget the module's memory so a fresh storage is read.
export function resetVisitedForTests() {
  snapshot = EMPTY;
  hydrated = false;
  listeners.clear();
}
