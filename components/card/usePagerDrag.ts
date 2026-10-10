"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { GALLERY } from "@/lib/gallery/constants";
import { axisOf, releaseOf, rubberBand, type Axis, type PagerAction } from "@/lib/gallery/pager";

// The pager's pointer (the lab's PhonePager at ae9b6dd): a drag picks its axis
// past the slop. Sideways it follows the finger (a third of the travel past
// either end) and turns one page on release; vertically it moves the panel
// and closes the modal past the flick, else springs back; a vertical drag on
// words that scroll is theirs. A press anywhere on the pager holds a turning
// group until the pointer comes up (pressing). A press on a button or a link
// is theirs.

type Drag = { id: number; x: number; y: number; axis: Axis | null; lastX: number; lastY: number; lastT: number; velocity: number; scrolls: boolean };
type Options = { index: number; count: number; reduced: boolean; dispatch: (action: PagerAction) => void; onDismiss: () => void };

export function usePagerDrag(rootRef: RefObject<HTMLElement | null>, { index, count, reduced, dispatch, onDismiss }: Options) {
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    if (!pressing) return;
    const release = () => setPressing(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pressing]);

  const movePanel = (dy: number, ms: number) => {
    const panel = rootRef.current?.closest<HTMLElement>("[data-gallery-panel]");
    if (!panel) return;
    panel.style.transition = ms ? `translate ${ms}ms ${GALLERY.ease.css}` : "none";
    panel.style.translate = `0 ${dy}px`;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setPressing(true);
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) return;
    const text = target.closest<HTMLElement>("[data-pager-text]");
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, scrolls: !!text && text.scrollHeight > text.clientHeight + 1 };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      d.axis = axisOf(dx, dy);
      if (d.axis === "y" && d.scrolls) {
        drag.current = null;
        return;
      }
      if (d.axis) rootRef.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (d.axis === "y" ? e.clientY - d.lastY : e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    if (d.axis === "x" && !reduced) setDragPx(rubberBand(dx, index, count));
    else if (d.axis === "y" && !reduced) movePanel(dy, 0);
  };

  const end = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragPx(null);
    const dy = e.clientY - d.y;
    const release = cancelled ? "stay" : releaseOf(d.axis, e.clientX - d.x, dy, d.velocity, { flickPx: GALLERY.pager.flickPx });
    if (release === "next" || release === "prev") dispatch({ type: release });
    else if (release === "dismiss") {
      if (!reduced) movePanel(Math.sign(dy) * (rootRef.current?.clientHeight ?? 600), GALLERY.pager.dismissMs);
      onDismiss();
    } else if (d.axis === "y") movePanel(0, reduced ? 0 : GALLERY.pager.springBackMs);
  };

  return {
    dragPx,
    pressing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
    },
  };
}
