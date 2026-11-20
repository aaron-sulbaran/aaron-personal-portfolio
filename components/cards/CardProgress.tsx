"use client";

import { siteContent } from "@/lib/content";
import { useHomeController } from "@/components/home/HomeController";
import { openedCardCount, progressLine } from "@/lib/home/clickPrompt";
import { useSeen, useSeenRead } from "@/lib/home/seen";

// "N of 14 opened" and a thin accent bar, read from the seen store (the same
// set the dots and the Coil's rings read). Under the Work column on a desktop,
// under the two columns on a phone (CardColumns places the one for each).
// Until a card has been opened in this tab the same spot reads the click-a-card
// prompt (lib/home/clickPrompt.ts, progressLine), on every visit. It is hidden
// only before the page has read the tab's cards, and in the phone's foot until
// there is a count: its room is kept, so nothing moves when it appears, and it
// is out of the accessibility tree while it is hidden (and, hidden, it does
// not move the logo aside: components/SiteLogo.tsx). The bar grows by transform
// only. A card counts once, when the visitor leaves it (a close, or a step
// from its modal to the card before or after).
export const TOTAL = siteContent.columns.order.reduce((sum, column) => sum + column.groups.reduce((n, group) => n + group.titles.length, 0), 0);

export function useOpenedCount(): number {
  return openedCardCount(useSeen());
}

// withPrompt={false}: the phone foot, whose spot is too low to be the prompt's
// (PromptLine under the page title is); it is then not a prompt host.
export function CardProgress({ className = "", withPrompt = true }: { className?: string; withPrompt?: boolean }) {
  const opened = useOpenedCount();
  const seenRead = useSeenRead();
  const input = useHomeController()?.drivers.input ?? "fine";
  const line = progressLine({ opened, total: TOTAL, prompt: withPrompt && seenRead, input });
  const shown = line.kind !== "none";
  return (
    <div
      data-card-progress=""
      data-prompt-host={withPrompt ? "" : undefined}
      data-logo-clear={shown ? "" : undefined}
      aria-hidden={shown ? undefined : true}
      className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"} ${className}`}
    >
      <p aria-live="polite" className="font-label text-label-sm text-accent">
        <span data-prompt-line="">{line.text}</span>
      </p>
      <div role="presentation" className={`mt-1.5 h-[3px] w-full max-w-[9.5rem] overflow-hidden rounded-full bg-border ${line.kind === "prompt" ? "invisible" : ""}`}>
        <div data-card-progress-bar="" className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" style={{ transform: `scaleX(${opened / TOTAL})` }} />
      </div>
    </div>
  );
}
