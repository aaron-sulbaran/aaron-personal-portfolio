"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import type { Step } from "@/lib/card/deck";

// The desktop rows' side chevrons, to the card before and after this one in the
// page's order. Each sits on a rail of no width beside the panel, inside the
// dialog (so the focus trap holds it and Tab reaches it after the card's own
// controls), sticky at the middle of the window while the dialog scrolls; a
// fixed layer would scroll away with the content, since the dialog's backdrop
// filter makes it the fixed layer's containing block. A chevron sits just
// outside the panel where the gutter has room and straddles the panel's edge
// (over its padding, never its words) where it has not. At an end the chevron
// stays, dimmed and aria-disabled, so focus never drops off it.

type Props = { prev: CardKey | null; next: CardKey | null; panelWidth: number; onStep: (step: Step) => void };

const d = siteContent.modals.deck;
const glass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 80%, transparent)" };
// The rows' dialog padding (px-10, py-14), the chevron (h-11), and the gap it keeps from the panel where there is room.
const GUTTER_PX = 40;
const PAD_Y_PX = 56;
const SIZE_PX = 44;
const GAP_PX = 16;

export function DeckRails({ prev, next, panelWidth, onStep }: Props) {
  const gutter = `max(${GUTTER_PX}px, (100vw - ${panelWidth}px) / 2)`;
  const out = `clamp(${-SIZE_PX / 2}px, ${gutter} - ${SIZE_PX + GAP_PX}px, ${GAP_PX}px)`;
  return (
    <>
      <Rail side="prev" target={prev} out={out} onStep={onStep} />
      <Rail side="next" target={next} out={out} onStep={onStep} />
    </>
  );
}

function Rail({ side, target, out, onStep }: { side: "prev" | "next"; target: CardKey | null; out: string; onStep: (step: Step) => void }) {
  const isNext = side === "next";
  const Icon = isNext ? ChevronRight : ChevronLeft;
  const title = target ? siteContent.cards[target].short : null;
  return (
    <div
      data-deck-rail={side}
      className={`pointer-events-none sticky z-10 w-0 shrink-0 self-start ${isNext ? "" : "order-first"}`}
      style={{ top: PAD_Y_PX, height: `calc(100dvh - ${PAD_Y_PX * 2}px)` }}
    >
      <button
        type="button"
        aria-label={isNext ? d.nextCard(title) : d.previousCard(title)}
        aria-disabled={target ? undefined : true}
        onClick={() => {
          if (target) onStep(isNext ? 1 : -1);
        }}
        data-deck-step={side}
        className="pointer-events-auto absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border text-foreground shadow-[var(--shadow-card)] transition-[color,opacity] duration-200 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:text-foreground"
        style={{ ...glass, [isNext ? "left" : "right"]: out }}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}
