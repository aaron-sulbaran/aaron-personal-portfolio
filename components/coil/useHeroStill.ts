import { useEffect, useState, useSyncExternalStore } from "react";
import type { StillTheme } from "@/lib/coil/heroStill";
import { STILL_OFF, createStillReadiness, type StillView } from "@/lib/home/stillReadiness";
import { provideStillPoster } from "@/lib/loader/still";
import { decodeHeroStill, heroStillTarget } from "./Poster";

// The hero still while no scene can run (CoilStage.tsx): its readiness per
// theme (lib/home/stillReadiness.ts), the current theme read off <html
// data-theme> as the Menu writes it, and the loader's still provider. A theme
// change commits in the same frame it is made (useSyncExternalStore renders a
// store change synchronously), so the still never shows a picture that has
// not decoded. The provider is set from this effect, so CoilStage calls this
// before the effect that settles the loader's tally.
const themeNow = (): StillTheme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const offOnServer = () => STILL_OFF;

export function useHeroStill(active: boolean): StillView {
  const [store] = useState(() => createStillReadiness({ decode: decodeHeroStill }));
  useEffect(() => {
    if (!active) return;
    store.show(themeNow());
    const observer = new MutationObserver(() => store.show(themeNow()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const releaseStill = provideStillPoster({ decoded: store.decoded, target: heroStillTarget });
    return () => {
      observer.disconnect();
      releaseStill();
    };
  }, [active, store]);
  const view = useSyncExternalStore(store.subscribe, store.view, offOnServer);
  return active ? view : STILL_OFF;
}
