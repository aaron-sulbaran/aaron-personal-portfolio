"use client";

import type { CSSProperties, ReactNode } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import type { SoundtrackState } from "@/lib/soundtrack";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";

// Shared pieces of the playback pill: the glass surface (backdrop blur is
// sanctioned on the pill), the growing slot, the cover tile, the glyph and the
// card's freeze row.

export const EASE = "var(--ease-out)";

export const glass: CSSProperties = {
  background: "var(--color-glass-strong)",
  border: "1px solid var(--color-border)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "var(--pill-shadow)",
};

// A slot that grows from nothing: max-width and max-height collapse together
// (without the height a hidden two-line title keeps the row tall) and the
// slot clips. The space around its content (`before` stands in for the flex
// gap, `after` for the gap to the next item) is padding inside the clip, so a
// hidden slot adds no space and only max-width, max-height and opacity
// transition. Reduced motion fades only.
type SlotProps = {
  visible: boolean;
  maxWidth: number; // the content's, px; the padding is added on top
  reduce: boolean;
  ms?: number;
  before?: number;
  after?: number;
  block?: boolean;
  ariaHidden?: boolean;
  children: ReactNode;
};

export function PillSlot({ visible, maxWidth, reduce, ms = 280, before = 0, after = 0, block = false, ariaHidden, children }: SlotProps) {
  const display = block ? "block" : "flex";
  return (
    <span
      aria-hidden={ariaHidden}
      style={{
        display,
        alignItems: "center",
        overflow: "hidden",
        flex: "0 0 auto",
        whiteSpace: "nowrap",
        transition: reduce
          ? "opacity 220ms ease"
          : `max-width ${ms}ms ${EASE}, max-height ${ms}ms ${EASE}, opacity ${Math.min(ms, 220)}ms ease`,
        maxWidth: visible ? maxWidth + before + after : 0,
        maxHeight: visible ? 48 : 0,
        opacity: visible ? 1 : 0,
      }}
    >
      <span style={{ display, alignItems: "center", paddingLeft: before, paddingRight: after }}>{children}</span>
    </span>
  );
}

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function iconButton(size?: number): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: size ? "1px solid var(--color-border)" : "none",
    borderRadius: size ? 999 : 0,
    width: size,
    height: size,
    padding: 0,
    color: size ? "var(--color-muted)" : "var(--color-foreground)",
    cursor: "pointer",
    flex: "0 0 auto",
  };
}

export function Cover({ size, cover }: { size: number; cover: string | null }) {
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size >= 48 ? 12 : 10,
        overflow: "hidden",
        display: "block",
        flex: "0 0 auto",
        border: "1px solid var(--color-border)",
        background: "var(--color-glass)",
        backgroundImage: cover ? `url(${cover})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {!cover && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "repeating-linear-gradient(135deg, var(--color-border) 0 6px, transparent 6px 12px)",
            opacity: 0.6,
          }}
        />
      )}
    </span>
  );
}

// The capsule's glyph, one visual language with the Menu's note: filled in
// the accent and swaying while the music plays, crossed out while it does
// not, and the wave's own flat waiting line while paused.
export function DockGlyph({ music }: { music: SoundtrackState }) {
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, flex: "0 0 auto" }}>
      {music === "paused" ? (
        <span style={{ display: "block", width: 16, height: 2, borderRadius: 1, background: "var(--color-muted)", opacity: 0.7 }} />
      ) : (
        <NoteIcon
          on={music === "on"}
          living
          className={`block h-[15px] w-[9.5px] ${music === "on" ? "text-accent" : "text-muted"}`}
        />
      )}
    </span>
  );
}

// "Freeze the wave", in the player card since the wave is everywhere now.
// Nothing moves under reduced motion, so the row is not offered then.
export function FreezeRow({ reduce }: { reduce: boolean }) {
  const frozen = useFrozen();
  const c = siteContent.listen;
  if (reduce) return null;
  return (
    <button
      type="button"
      onClick={() => setFrozen(!frozen)}
      data-cursor-hover
      style={{
        ...iconButton(),
        justifyContent: "flex-start",
        minHeight: 24,
        marginTop: 10,
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        color: "var(--color-muted)",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {frozen ? c.unfreeze : c.freeze}
    </button>
  );
}
