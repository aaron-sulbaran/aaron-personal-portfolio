"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { HOVER_START, hoverReducer, type HoverEvent, type HoverState } from "@/lib/waveform/pill";

const TIP_DELAY_MS = 500;
const GRACE_MS = 2500;
const SUPPRESS_MS = 180;

type Trigger = Exclude<HoverEvent["type"], "tip" | "graceEnd" | "suppressEnd">;

// The pill's hover state (lib/waveform/pill hoverReducer) plus the three
// timers that feed it. Resets whenever the pill is hidden, so it always
// reappears as the collapsed capsule.
export function usePillHover(reduce: boolean, shown: boolean): [HoverState, (type: Trigger) => void] {
  const [state, dispatch] = useReducer(hoverReducer, HOVER_START);
  const timers = useRef<{ tip?: ReturnType<typeof setTimeout>; grace?: ReturnType<typeof setTimeout>; suppress?: ReturnType<typeof setTimeout> }>({});

  const clearAll = useCallback(() => {
    clearTimeout(timers.current.tip);
    clearTimeout(timers.current.grace);
    clearTimeout(timers.current.suppress);
    timers.current = {};
  }, []);

  useEffect(() => clearAll, [clearAll]);

  useEffect(() => {
    if (shown) return;
    clearAll();
    dispatch({ type: "reset" });
  }, [shown, clearAll]);

  const send = useCallback(
    (type: Trigger) => {
      dispatch({ type });
      const t = timers.current;
      if (type === "enter" && !reduce) {
        clearTimeout(t.tip);
        t.tip = setTimeout(() => dispatch({ type: "tip" }), TIP_DELAY_MS);
      }
      if (type === "leave" || type === "open" || type === "collapse") clearTimeout(t.tip);
      if (type === "open" || type === "collapse") clearTimeout(t.grace);
      if (type === "cardLeave") {
        clearTimeout(t.grace);
        clearTimeout(t.suppress);
        t.grace = setTimeout(() => dispatch({ type: "graceEnd" }), GRACE_MS);
        t.suppress = setTimeout(() => dispatch({ type: "suppressEnd" }), SUPPRESS_MS);
      }
      if (type === "reset") clearAll();
    },
    [reduce, clearAll],
  );

  return [state, send];
}
