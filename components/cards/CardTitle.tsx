"use client";

import type { FocusEvent, PointerEvent } from "react";
import { siteContent, type ColumnTitle } from "@/lib/content";
import { useHoveredCard } from "@/lib/cursor/useHoveredCard";
import { useIsSeen } from "@/lib/home/seen";
import { seenDotClass } from "@/lib/home/seenDot";
import { isKeyboardFocus } from "@/lib/input/modality";
import { useHomeController } from "@/components/home/HomeController";

// One title in a column: a button that opens its card (the Coil has turned to
// it by the time a pointer clicks: hovering or focusing the title brings the
// card to the front and holds the Coil there; a tap turns it first). The
// controller marks the card seen at close and returns focus here. A card
// hovered in the Coil lights its title. The seen dot is the card's own ring.
export function CardTitle({ title }: { title: ColumnTitle }) {
  const controller = useHomeController();
  const seen = useIsSeen(title.key);
  const lit = useHoveredCard() === title.key;
  // The seen dot follows the title's last word on the same line, glued to it, and sits on the
  // middle of the line's x-height, or on the middle of the capitals when that word has no
  // lowercase (lib/home/seenDot.ts), so it is centered on the text line however the title
  // wraps. The underline is the words' only: it never reaches the dot. A qualifier ("(part-time)") is
  // part of the same title: lighter and smaller, after the last word on the same line, inside the
  // underline and before the dot, and read as one name with the words ("Jobs (part-time)").
  const words = title.short.split(" ");
  const last = words.pop() ?? "";
  const head = words.join(" ");
  return (
    <button
      type="button"
      data-card={title.key}
      data-lit={lit ? "" : undefined}
      aria-haspopup="dialog"
      title={title.full === title.short ? undefined : title.full}
      className={TITLE_CLASS}
      onPointerEnter={(event: PointerEvent) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") controller?.focusCard(title.key, "pointer");
      }}
      onPointerLeave={() => controller?.focusCard(null, "pointer")}
      onFocus={(event: FocusEvent<HTMLElement>) => {
        if (isKeyboardFocus(event.currentTarget)) controller?.focusCard(title.key, "focus");
      }}
      onBlur={() => controller?.focusCard(null, "focus")}
      onClick={(event) => controller?.openTitle(title.key, event.currentTarget)}
      data-cursor-hover
    >
      <span className="block">
        <span className="underline decoration-transparent decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-200 group-hover/title:decoration-accent group-data-[lit]/title:decoration-accent group-focus-visible/title:decoration-accent">
          {head}
          {head ? " " : ""}
          <span className="whitespace-nowrap">
            {last}
            {title.qualifier && (
              <>
                {" "}
                <span data-title-qualifier="" className="font-sans text-[0.68em] font-normal text-muted">
                  {title.qualifier}
                </span>
              </>
            )}
            {seen && <span data-seen-dot="" aria-hidden="true" className={`${seenDotClass(last)} ml-2.5 inline-block h-2 w-2 shrink-0 rounded-full border border-current opacity-70`} />}
          </span>
        </span>
        {seen && <span className="sr-only">, {siteContent.columns.seenLabel}</span>}
      </span>
    </button>
  );
}

const TITLE_CLASS =
  "group/title flex min-h-11 w-full items-center rounded-sm text-left font-display text-[1.0625rem] leading-[1.15] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-10 md:text-[clamp(1.1875rem,1.475vw,1.475rem)]";
