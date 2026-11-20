"use client";

import { siteContent } from "@/lib/content";
import { useHomeController } from "@/components/home/HomeController";
import { progressLine } from "@/lib/home/clickPrompt";
import { useSeenRead } from "@/lib/home/seen";
import { TOTAL, useOpenedCount } from "./CardProgress";

// The phone's resting line, under the page title (the phone foot is below the
// screen, so its CardProgress has no prompt). It shows the click-a-card prompt
// until a card has been opened in this tab, on every visit, and nothing after
// (the foot has the count); its line of room is always kept, so nothing moves
// when it appears or goes. Same host contract as CardProgress:
// data-prompt-host, the text in <span data-prompt-line>.
export function PromptLine({ className = "" }: { className?: string }) {
  const opened = useOpenedCount();
  const seenRead = useSeenRead();
  const input = useHomeController()?.drivers.input ?? "fine";
  const line = progressLine({ opened, total: TOTAL, prompt: seenRead, input });
  const shown = line.kind === "prompt";
  return (
    <div
      data-prompt-host=""
      aria-hidden={shown ? undefined : true}
      className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "invisible opacity-0"} ${className}`}
    >
      <p aria-live="polite" className="font-label text-label-sm text-accent">
        <span data-prompt-line="">{shown ? line.text : siteContent.columns.prompt[input]}</span>
      </p>
    </div>
  );
}
