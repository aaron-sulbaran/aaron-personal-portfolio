import { useSyncExternalStore } from "react";
import { DEFAULT_INTRO_KNOBS, getIntroKnobs, subscribeIntroKnobs, type IntroKnobs } from "@/lib/home/introKnobs";

// The knobs as a hook, for client components (the store itself has no React, so
// the server layout and page can import the defaults).
export function useIntroKnobs(): IntroKnobs {
  return useSyncExternalStore(subscribeIntroKnobs, getIntroKnobs, () => DEFAULT_INTRO_KNOBS);
}
