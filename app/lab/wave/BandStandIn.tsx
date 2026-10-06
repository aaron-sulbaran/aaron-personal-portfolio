"use client";

import { useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";
import { getDecision, getServerDecision, setDecision, subscribeDecision } from "./decisionStore";

// A copy of the soundtrack band's first state (components/soundtrack/
// BandInvite.tsx): the question, the note and the two answers. In the lab the
// answers only set the decision the wave waits for (decisionStore.ts), and
// the copy stays put so the band's measure (and the run's line) never moves;
// nothing here can start audio. The top padding stands in for the end of the
// book and keeps the heading clear of the header bar.
export function BandStandIn() {
  const c = siteContent.listen;
  const decision = useSyncExternalStore(subscribeDecision, getDecision, getServerDecision);
  return (
    <section aria-label={c.ariaLabel} className="relative w-full px-[6vw] pb-6 pt-36 md:min-h-[clamp(240px,30vh,340px)] md:pt-44">
      <div className="mx-auto max-w-[1240px]">
        <div data-wave-avoid className="w-fit max-w-full">
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
            <div className="flex items-baseline gap-6">
              <button
                type="button"
                data-decision="play"
                aria-pressed={decision === "play"}
                onClick={() => setDecision("play")}
                className="font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent underline decoration-1 underline-offset-[4px]"
              >
                {c.accept}
              </button>
              <button type="button" data-decision="decline" aria-pressed={decision === "decline"} onClick={() => setDecision("decline")} className="text-sm text-muted">
                {c.decline}
              </button>
            </div>
          </div>
          <p className="mt-2 max-w-[42rem] text-sm leading-[1.5] text-muted">{c.body}</p>
        </div>
      </div>
    </section>
  );
}
