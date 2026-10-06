"use client";

import { useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";
import { getBandDecision, getServerBandDecision, setBandDecision, subscribeBandDecision } from "./bandDecision";

// A static stand-in for the soundtrack band, matching the wave lab's (the
// question, the two answers, the note), so the sections below start where
// they do on the site. The answers only tell the wave to start drawing.
export function BandCopy() {
  const c = siteContent.listen;
  const decision = useSyncExternalStore(subscribeBandDecision, getBandDecision, getServerBandDecision);
  return (
    <section aria-label={c.ariaLabel} className="relative w-full px-[6vw] pb-6 pt-36 md:min-h-[clamp(240px,30vh,340px)] md:pt-44">
      <div className="mx-auto max-w-[1240px]">
        <div data-wave-avoid className="w-fit max-w-full">
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
            <div className="flex items-baseline gap-6">
              <button
                type="button"
                aria-pressed={decision === "play"}
                onClick={() => setBandDecision("play")}
                className="font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent underline decoration-1 underline-offset-[4px]"
              >
                {c.accept}
              </button>
              <button type="button" aria-pressed={decision === "decline"} onClick={() => setBandDecision("decline")} className="text-sm text-muted">
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
