import { siteContent } from "@/lib/content";
import { FAST_START_THRESHOLD_FRAC } from "@/lib/home/recovery";
import { HOME_SCROLL_KEY } from "@/lib/scroll";

// Page 1's ribbon slot, decided before the first paint (the same family as the
// deal's and the loader's head scripts, lib/home/dealInit.ts, introLoaderInit.ts).
//
// The slot ([data-coil-ribbon]) is room for the ribbon above the cards, and it
// closes once the scene has dealt and the reader is below it (components/home/
// useSlotRelease.ts). A load that lands in the cards section (a link to #work,
// which is where /work redirects, or a reload inside it) opens the section at
// once, dealt, and used to paint with the room open and close it a few hundred
// milliseconds later, once the scene was up: the cards under the reader shifted
// once (layout shift 0.135). This script closes it from the start on exactly
// those loads, with <html data-slot="closed"> (app/globals.css hides the room),
// and the release hook hands that over to its own data-gone attribute when it
// mounts. The prediction is only made where the scene can come: not for reduced
// motion, and not without the WebGL 2 API. If it is wrong (the context cannot be
// made after all) the hook opens the slot again.
//
// Loads below the cards section (#numbers, #connect) do not deal, so their slot
// stays open as it always was and nothing is predicted for them. A hash decides
// by itself: #work closes it, every other one leaves it. With no hash the saved
// position decides, but only when it was saved with the slot closed and the
// reader inside the cards section (SLOT_KEY, written by the hook), since a
// position past half a viewport can still be inside page 1 or past the cards.
export const SLOT_KEY = "aps:home-slot";
export const SLOT_CLOSED = "gone";

const HASHES_THAT_DEAL_ON_LOAD = siteContent.menu.items.filter((item) => item.key === "work").map((item) => item.href);

export function slotInitScript(): string {
  return (
    `(function(){try{` +
    `if(location.pathname!=="/")return;` +
    `if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
    `if(typeof WebGL2RenderingContext==="undefined")return;` +
    `var h=location.hash,c;` +
    `if(h.length>1&&h!=="#main")c=${JSON.stringify(HASHES_THAT_DEAL_ON_LOAD)}.indexOf(h)>-1;` +
    `else c=Number(sessionStorage.getItem(${JSON.stringify(HOME_SCROLL_KEY)}))>window.innerHeight*${FAST_START_THRESHOLD_FRAC}&&sessionStorage.getItem(${JSON.stringify(SLOT_KEY)})===${JSON.stringify(SLOT_CLOSED)};` +
    `if(c)document.documentElement.setAttribute("data-slot","closed");` +
    `}catch(x){}})();`
  );
}
