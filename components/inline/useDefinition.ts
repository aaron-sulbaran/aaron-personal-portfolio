"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import type { DefinitionEntry } from "@/lib/content/types";
const { def } = siteContent.register;
// A re-split line (SplitText) may have replaced the trigger while the modal
// was open; the same link is then found again by its key.
function refocus(trigger: HTMLElement | null, key: string): HTMLElement | null {
  const live = trigger?.isConnected ? trigger : document.querySelector<HTMLElement>(`[data-inline="def"][data-inline-key="${CSS.escape(key)}"]`);
  live?.focus({ preventScroll: true });
  return live;
}
// Closing releases the scroll lock, which can re-split the line a beat after
// the first refocus; the exit animation is over by then.
const LATE_REFOCUS_MS = 350;
// One delegated listener for every definition link on the page (server
// markup, components/inline/InlineCopy). Opening focuses the trigger first,
// so useFocusTrap returns focus to it.
export function useDefinition(dismissTip: () => void): { entry: DefinitionEntry | null; close: () => void } {
  const [key, setKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dismissRef = useRef(dismissTip);
  useEffect(() => void (dismissRef.current = dismissTip), [dismissTip]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-inline="def"]') : null;
      const next = trigger?.dataset.inlineKey;
      if (!trigger || !next || !Object.hasOwn(def, next)) return;
      event.preventDefault();
      dismissRef.current();
      trigger.focus({ preventScroll: true });
      triggerRef.current = trigger;
      setKey(next);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  const close = useCallback(() => {
    if (key === null) return;
    setKey(null);
    requestAnimationFrame(() => {
      triggerRef.current = refocus(triggerRef.current, key);
      window.setTimeout(() => {
        if (triggerRef.current?.isConnected || document.activeElement !== document.body) return;
        triggerRef.current = refocus(triggerRef.current, key);
      }, LATE_REFOCUS_MS);
    });
  }, [key]);
  return { entry: key === null ? null : def[key], close };
}
