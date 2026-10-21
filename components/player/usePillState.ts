"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import { isKeyboardFocus } from "@/lib/input/modality";
import { useEscapeKey } from "@/lib/modal";
import { idleLeft, PILL_REST, pillOpen, pillPinned, pillStep, pillTimer, type PillEvent, type PillState } from "@/lib/player/pill";

const isSeek = (target: EventTarget | null) => target instanceof HTMLInputElement && target.type === "range";

// The one pill's hover, focus, pin and idle fold, around the pure machine in
// lib/player/pill: it runs the intent and grace timers, closes on a press
// outside or Escape, and hands focus back to the face after an Escape without
// that reopening it. The idle fold counts from the last touch (the pointer
// moving, a click, the wheel or a key inside the pill), kept in a ref so a
// moving pointer costs no render; when the wait ends with nothing touched the
// machine folds the pill, unless keyboard focus is inside it or a seek is
// being dragged. A finger has no hover, so touch only ever pins (by the tap's
// click).
export function usePillState(initialPinned: boolean) {
  const [state, setState] = useState<PillState>(initialPinned ? { ...PILL_REST, phase: "pinned" } : PILL_REST);
  const root = useRef<HTMLDivElement | null>(null);
  const face = useRef<HTMLButtonElement | null>(null);
  const ignoreFocus = useRef(false);
  const lastTouch = useRef(0);
  const open = pillOpen(state);
  const send = useCallback((event: PillEvent) => setState((current) => pillStep(current, event)), []);
  const touch = useCallback(() => {
    lastTouch.current = performance.now();
  }, []);

  useEffect(() => {
    touch();
    const timer = pillTimer(state);
    if (!timer) return;
    if (timer.event !== "idleElapsed") {
      const id = window.setTimeout(() => send(timer.event), timer.ms);
      return () => window.clearTimeout(id);
    }
    let id = 0;
    const wait = () => {
      const left = idleLeft(performance.now(), lastTouch.current, timer.ms);
      if (left > 0) id = window.setTimeout(wait, left);
      else send(timer.event);
    };
    id = window.setTimeout(wait, timer.ms);
    return () => window.clearTimeout(id);
  }, [state, send, touch]);

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
      touch();
      if (event.pointerType !== "touch") send("enter");
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      if (event.pointerType !== "touch") send("leave");
    },
    onPointerMove: touch,
    onPointerDownCapture: (event: ReactPointerEvent) => {
      touch();
      if (!isSeek(event.target)) return;
      send("dragStart");
      const end = () => {
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        touch();
        send("dragEnd");
      };
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    onWheel: touch,
    onKeyDown: touch,
    onClick: () => {
      touch();
      send("click");
    },
    onFocus: (event: FocusEvent<HTMLDivElement>) => {
      if (!ignoreFocus.current && isKeyboardFocus(event.target)) send("focusIn");
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) send("focusOut");
    },
  };

  return { open, pinned: pillPinned(state), root, face, handlers };
}
