import { useEffect, useState, useSyncExternalStore } from "react";
import type { StillTheme } from "@/lib/coil/heroStill";
import { STILL_OFF, createStillReadiness, type StillView } from "@/lib/home/stillReadiness";
import { decodeHeroStill } from "./Poster";

// The hero still while no scene can run (CoilStage.tsx): its readiness per
// theme (lib/home/stillReadiness.ts) and the current theme read off <html
// data-theme> as the Menu writes it. A theme change commits in the same frame
// it is made (useSyncExternalStore renders a store change synchronously), so
// the still never shows a picture that has not decoded.
const themeNow = (): StillTheme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const motion = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const offOnServer = () => STILL_OFF;
const neverGaveUp = () => false;

export function useHeroStill(active: boolean): StillView {
  const [store] = useState(() => createStillReadiness({ decode: decodeHeroStill, gaveUp: neverGaveUp, motion }));
  useEffect(() => {
    if (!active) return;
    store.show(themeNow());
    const observer = new MutationObserver(() => store.show(themeNow()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [active, store]);
  const view = useSyncExternalStore(store.subscribe, store.view, offOnServer);
  return active ? view : STILL_OFF;
}
