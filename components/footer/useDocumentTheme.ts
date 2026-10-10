"use client";

import { useSyncExternalStore } from "react";
import type { Theme } from "@/lib/theme";

// The theme as the Menu writes it on <html data-theme>, live and
// hydration-safe (the server and the hydrating render read light). The
// footer's field reads its tokens once per change of this value.

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "light");
}
