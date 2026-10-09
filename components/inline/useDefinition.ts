"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import type { DefinitionEntry } from "@/lib/content/types";
const { def } = siteContent.register;
const BLOCK = "[data-sections-block]";
const WATCH_CAP_MS = 2000;
const linkSelector = (key: string) => `[data-inline="def"][data-inline-key="${CSS.escape(key)}"]`;
// A re-split line (SplitText) may have replaced the trigger; the same link is
// then found again by its key, inside its own Block unless the Block is gone.
function liveLink(trigger: HTMLElement | null, key: string, block: Element | null): HTMLElement | null {
  if (trigger?.isConnected) return trigger;
  return (block?.isConnected ? block : document).querySelector<HTMLElement>(linkSelector(key));
}
// One delegated listener for every definition link on the page (server
// markup, components/inline/InlineCopy). Opening focuses the trigger first,
// so useFocusTrap returns focus to it. A lines-split Block rebuilds its
// children whenever a font finishes loading (document.fonts loadingdone) or
// its width changes, which can land after the modal has closed and drop the
// focused link; so after a close the Block is watched until focus is found
// again or the reader moves on.
export function useDefinition(dismissTip: () => void): { entry: DefinitionEntry | null; close: () => void } {
  const [key, setKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const blockRef = useRef<Element | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const dismissRef = useRef(dismissTip);
  useEffect(() => void (dismissRef.current = dismissTip), [dismissTip]);
  const refocus = useCallback((linkKey: string, block: Element | null) => {
    const live = liveLink(triggerRef.current, linkKey, block);
    if (!live) return;
    triggerRef.current = live; // before focus(): the focusin guard compares against it
    live.focus({ preventScroll: true });
  }, []);
  const watchBlock = useCallback((linkKey: string) => {
    const block = blockRef.current;
    if (!block?.isConnected) return;
    const observer = new MutationObserver(() => {
      if (triggerRef.current?.isConnected || (document.activeElement && document.activeElement !== document.body)) return;
      refocus(linkKey, block);
    });
    const onFocusIn = (event: FocusEvent) => event.target !== triggerRef.current && stopRef.current();
    const stop = () => {
      observer.disconnect();
      window.clearTimeout(cap);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("keydown", stop, true);
    };
    const cap = window.setTimeout(stop, WATCH_CAP_MS);
    observer.observe(block, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("keydown", stop, true);
    stopRef.current = stop;
  }, [refocus]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-inline="def"]') : null;
      const next = trigger?.dataset.inlineKey;
      if (!trigger || !next || !Object.hasOwn(def, next)) return;
      event.preventDefault();
      stopRef.current();
      dismissRef.current();
      trigger.focus({ preventScroll: true });
      triggerRef.current = trigger;
      blockRef.current = trigger.closest(BLOCK);
      setKey(next);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      stopRef.current();
    };
  }, []);
  const close = useCallback(() => {
    if (key === null) return;
    setKey(null);
    stopRef.current();
    const frame = requestAnimationFrame(() => {
      refocus(key, blockRef.current);
      watchBlock(key);
    });
    stopRef.current = () => cancelAnimationFrame(frame);
  }, [key, refocus, watchBlock]);
  return { entry: key === null ? null : def[key], close };
}
