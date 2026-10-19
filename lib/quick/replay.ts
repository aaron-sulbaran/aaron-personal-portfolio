import { HINT_OPENED_KEY } from "@/lib/cursor/hover";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { STILL_NOTICE_KEY } from "@/lib/home/stillNotice";
import { VISITED_STORAGE_KEY } from "@/lib/inline/visited";
import { HOME_SCROLL_KEY } from "@/lib/scroll";
import { GREETED_KEY, KEEP_EXPLORING_KEY, TAP_CARD_KEY } from "@/lib/home/firstVisit";
import { INVITE_KEY } from "./invite";

// Everything the site remembers about a first visit, so the lab's "Replay first
// visit" can forget it all and open / as a stranger would. Preferences (the
// theme, the soundtrack's on or off, the lab's own settings) stay.

export const FIRST_VISIT_LOCAL: readonly string[] = [
  INVITE_KEY,
  HINT_OPENED_KEY,
  KEEP_EXPLORING_KEY,
  TAP_CARD_KEY,
  STILL_NOTICE_KEY,
  VISITED_STORAGE_KEY,
  // Round 1's invite, so an old answer never lingers.
  "aaron-rush-asked",
];

// The seen store, the saved scroll (the loader's skip and the deep-reload fast
// start read it) and the soundtrack's one greeting.
export const FIRST_VISIT_SESSION: readonly string[] = [SEEN_STORAGE_KEY, HOME_SCROLL_KEY, GREETED_KEY];

type Remover = Pick<Storage, "removeItem">;

export function forgetFirstVisit(local: Remover | null, session: Remover | null): void {
  for (const [store, keys] of [[local, FIRST_VISIT_LOCAL], [session, FIRST_VISIT_SESSION]] as const) {
    for (const key of keys) {
      try {
        store?.removeItem(key);
      } catch {
        // Blocked storage holds nothing to forget.
      }
    }
  }
}
