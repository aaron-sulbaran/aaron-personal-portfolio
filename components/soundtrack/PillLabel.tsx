"use client";

import { useEffect, useRef } from "react";
import { siteContent } from "@/lib/content";
import { DOCK, type DockLabel } from "@/lib/waveform/dock";
import { reveal } from "./PillParts";

// The pill's label layer: the one line it lands with (spec section 2), shown
// once per page load per state. The visible line sits inside the capsule
// beside the glyph and grows and collapses with the reveal; a polite live
// region outside the capsule (whose accessible name is its action) reads the
// same line. Focus never moves for it.

// "unanswered" has no line: the pill arrives as the "Music?" capsule.
export function labelLine(kind: DockLabel): string | null {
  const c = siteContent.soundtrack;
  if (kind === "accepted") return c.dockAccepted;
  if (kind === "declined") return c.dockDeclined;
  if (kind === "returning") return c.dockReturning;
  if (kind === "failed") return c.dockFailed;
  return null;
}

export function PillLabel({ line, open, reduce }: { line: string | null; open: boolean; reduce: boolean }) {
  return (
    <span aria-hidden="true" style={reveal(open && line !== null, "360px", reduce, DOCK.collapseMs, 8)}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-foreground)" }}>{line}</span>
    </span>
  );
}

export function PillAnnouncer({ line }: { line: string | null }) {
  return (
    <span className="sr-only" aria-live="polite">
      {line ?? ""}
    </span>
  );
}

// The label's hold: DOCK.holdMs once the pill has landed, paused while the
// pointer or focus is on the pill (the remainder resumes), then `onDone`
// collapses it. A pill that leaves mid-hold, or a new label, starts afresh.
export function useLabelHold(kind: DockLabel, active: boolean, held: boolean, onDone: (kind: DockLabel) => void) {
  const remaining = useRef(DOCK.holdMs);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    remaining.current = DOCK.holdMs;
  }, [kind]);

  useEffect(() => {
    if (!active) remaining.current = DOCK.holdMs;
  }, [active]);

  useEffect(() => {
    if (!active || held) return;
    const started = performance.now();
    const id = setTimeout(() => done.current(kind), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [active, held, kind]);
}
