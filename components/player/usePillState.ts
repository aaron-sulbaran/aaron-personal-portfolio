"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useEscapeKey } from "@/lib/modal";
import { PILL_REST, pillOpen, pillPinned, pillStep, pillTimer, type PillEvent, type PillState } from "@/lib/player/pill";

// The one pill's hover, focus and pin, around the pure machine in lib/player/pill:
// it runs the intent and grace timers, closes on a press outside or Escape, and
// hands focus back to the face after an Escape without that reopening it. A
// finger has no hover, so touch only ever pins (by the tap's click).
export function usePillState(initialPinned: boolean) {
  const [state, setState] = useState<PillState>(initialPinned ? { phase: "pinned", focused: false } : PILL_REST);
  const root = useRef<HTMLDivElement | null>(null);
  const face = useRef<HTMLButtonElement | null>(null);
  const ignoreFocus = useRef(false);
  const open = pillOpen(state);
  const send = useCallback((event: PillEvent) => setState((current) => pillStep(current, event)), []);

  useEffect(() => {
    const timer = pillTimer(state.phase);
    if (!timer) return;
    const id = window.setTimeout(() => send(timer.event), timer.ms);
    return () => window.clearTimeout(id);
  }, [state.phase, send]);

  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current && !root.current.contains(event.target)) send("outside");
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open, send]);

  useEscapeKey(open, () => {
    ignoreFocus.current = true;
    send("escape");
    face.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      ignoreFocus.current = false;
    });
  });

  const handlers = {
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType !== "touch") send("enter");
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      if (event.pointerType !== "touch") send("leave");
    },
    onClick: () => send("click"),
    onFocus: (event: FocusEvent<HTMLDivElement>) => {
      if (!ignoreFocus.current && event.target.matches(":focus-visible")) send("focusIn");
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) send("focusOut");
    },
  };

  return { open, pinned: pillPinned(state), root, face, handlers };
}
