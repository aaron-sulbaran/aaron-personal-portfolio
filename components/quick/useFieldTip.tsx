"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement } from "react";
import { Portal } from "@/components/Portal";
import { isKeyboardFocus } from "@/lib/input/modality";
import { anchorPosition } from "@/lib/inline/placement";

// A tip for one control, in the site's own tip look (components/inline/TipBubble:
// the .inline-tip label at z-58, 13px Inter medium, the same rounded capsule).
// It shows on a mouse hover or keyboard focus, never on a touch (touch screens get
// a small muted line instead, where the page puts one), closes on Escape or a
// scroll, and its words ride on the control as its description. It portals to
// body, so it clears the toast (z-34) and any transformed ancestor.
//
// tone picks the fill so the tip never melts into what it points at: accent over
// a neutral surface (the toast), paper (background, hairline, shadow) over an
// accent control (the page's "See the full site").

export type TipTone = "accent" | "paper";

const FILL: Record<TipTone, string> = {
  accent: "bg-accent text-background",
  paper: "border border-border bg-background text-foreground shadow-[var(--pill-shadow)]",
};

export interface FieldTip {
  bind: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
    "aria-describedby": string;
  };
  tip: ReactElement;
}

export function useFieldTip(text: string, tone: TipTone): FieldTip {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const show = useCallback((anchor: HTMLElement) => {
    anchorRef.current = anchor;
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const bubble = tipRef.current;
    if (!open || !anchor?.isConnected || !bubble) return;
    const at = anchorPosition(anchor.getBoundingClientRect(), { width: bubble.offsetWidth, height: bubble.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    bubble.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  return {
    bind: {
      onPointerEnter: (event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") show(event.currentTarget);
      },
      onPointerLeave: hide,
      onFocus: (event) => {
        if (isKeyboardFocus(event.currentTarget)) show(event.currentTarget);
      },
      onBlur: hide,
      "aria-describedby": id,
    },
    tip: (
      <Portal>
        <div ref={tipRef} id={id} aria-hidden="true" data-field-tip="" data-shown={open && text ? "true" : "false"} className="inline-tip">
          <span className={`block max-w-[20rem] rounded-2xl px-3 py-[7px] font-sans text-[13px] font-medium leading-snug ${FILL[tone]}`}>{text}</span>
        </div>
      </Portal>
    ),
  };
}
