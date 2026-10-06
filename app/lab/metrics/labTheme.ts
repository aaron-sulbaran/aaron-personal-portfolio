"use client";

import { useSyncExternalStore } from "react";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";

// The theme is the site's own data-theme on <html>, observed so the site's
// Menu toggle and the lab's agree. The lab never writes the stored choice.

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function useLabTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "light");
}

export function setLabTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
}
