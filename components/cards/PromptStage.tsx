"use client";

import { Portal } from "@/components/Portal";
import { useHomeController } from "@/components/home/HomeController";
import { siteContent } from "@/lib/content";

// The big "click a card to open it" line of a deal with no card opened yet, and the dim
// around the lit Coil: fixed layers at the body, so no transformed ancestor
// moves them. Both rest hidden (app/globals.css); lib/home/promptRun.ts shows
// them, places the line where the resting line is and lands it there.
// Decorative: the resting line itself is what a reader's assistive tech gets.
export function PromptStage() {
  const input = useHomeController()?.drivers.input ?? "fine";
  return (
    <Portal>
      <div data-prompt-dim="" aria-hidden="true" />
      <div data-prompt-stage="" aria-hidden="true" className="fixed left-0 top-0 w-max origin-top-left">
        <span data-prompt-text="" className="block whitespace-nowrap font-display leading-[1.1] text-foreground">
          {siteContent.columns.prompt[input]}
        </span>
      </div>
    </Portal>
  );
}
