"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/Portal";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";

// Shared shell for the dashboard's Filter and Sort menus: a popover under its
// button on desktop, a bottom sheet on phones (Goldman Sachs' filter pattern),
// closed by Escape, an outside click, or the sheet's close button. Portaled at
// z-50 on phones, under the custom cursor (z-100).

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

interface MenuProps {
  // The trigger, given whether the menu is open and how to toggle it.
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  // The panel body, given how to close it.
  children: (close: () => void) => ReactNode;
  label: string;
  align?: "left" | "right";
  width?: number;
}

export function Menu({ trigger, children, label, align = "left", width = 300 }: MenuProps) {
  const [open, setOpen] = useState(false);
  const narrow = useNarrow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open || narrow) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, narrow]);

  const panel = open && (
    <Panel sheet={narrow} label={label} align={align} width={width} onClose={close}>
      {children(close)}
    </Panel>
  );

  return (
    <div ref={wrapRef} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {panel && (narrow ? <Portal>{panel}</Portal> : panel)}
    </div>
  );
}

function Panel({
  sheet,
  label,
  align,
  width,
  onClose,
  children,
}: {
  sheet: boolean;
  label: string;
  align: "left" | "right";
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, mounted);
  useBodyScrollLock(sheet);

  const body = (
    <div
      ref={(el) => {
        panelRef.current = el;
        if (el && !mounted) setMounted(true);
      }}
      role="dialog"
      aria-modal={sheet}
      aria-label={label}
      style={sheet ? undefined : { width }}
      className={
        sheet
          ? "relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-border/60 bg-background shadow-[0_-20px_60px_-20px_rgba(10,10,10,0.45)]"
          : `absolute top-full z-40 mt-2 flex flex-col rounded-2xl border border-border bg-background shadow-[0_24px_60px_-20px_rgba(10,10,10,0.4)] ${
              align === "right" ? "right-0" : "left-0"
            }`
      }
    >
      {sheet && (
        <div className="flex items-center justify-between px-4 pt-2.5">
          <span aria-hidden="true" className="h-1 w-10" />
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-10 items-center justify-end text-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );

  if (!sheet) return body;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-background/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {body}
    </div>
  );
}

// Pill trigger shared by both menus; filled when the menu has something set.
export function MenuButton({
  open,
  toggle,
  active,
  children,
}: {
  open: boolean;
  toggle: () => void;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-cursor-hover
      className={`inline-flex min-h-[36px] items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-glass text-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
