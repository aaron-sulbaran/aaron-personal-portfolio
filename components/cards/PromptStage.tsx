"use client";

import { Portal } from "@/components/Portal";
import { useHomeController } from "@/components/home/HomeController";
import { siteContent } from "@/lib/content";

// The big "click a card to open it" text of a first visit's deal: a fixed
// overlay at the body, so no transformed ancestor moves it. It rests hidden
// (app/globals.css); lib/home/promptRun.ts shows it, moves it and lands it in
// the resting line under the Work column. Decorative: the line itself is what
// a reader's assistive tech gets.
export function PromptStage() {
  const input = useHomeController()?.drivers.input ?? "fine";
  return (
    <Portal>
      <div data-prompt-scrim="" aria-hidden="true" />
      <div data-prompt-dim="" aria-hidden="true" />
      <div data-prompt-stage="" data-version="" aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-20 w-max origin-top-left">
        <span data-prompt-text="" className="relative isolate inline-block whitespace-nowrap font-display leading-tight text-foreground">
          <span data-prompt-plate="" />
          {siteContent.columns.prompt[input]}
        </span>
      </div>
    </Portal>
  );
}
