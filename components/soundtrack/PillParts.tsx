"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { noteState } from "@/lib/note";
import type { SoundtrackState } from "@/lib/soundtrack";

// Shared pieces of the stock playback pill and the player: the glass surface
// (backdrop blur is sanctioned on the pill), the growing slot, the cover tile
// and the glyph.

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

// The album art when the track has one, else the designed striped tile.
export function Cover({ size, cover, title }: { size: number; cover: string | null; title: string }) {
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
      }}
    >
      {cover ? (
        <Image
          src={cover}
          alt={`${siteContent.soundtrack.coverAlt} ${title}`}
          width={size}
          height={size}
          sizes={`${size}px`}
          loading="eager"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
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

// The capsule's glyph: the Menu's note, in the same three states.
export function DockGlyph({ music }: { music: SoundtrackState }) {
  return (
    <span data-fill-icon className="flex h-4 w-4 flex-none items-center justify-center">
      <NoteIcon state={noteState(music)} className="block h-4 w-[14px]" />
    </span>
  );
}
