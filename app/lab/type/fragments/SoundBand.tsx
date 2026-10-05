"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { useShown } from "../context";
import { role } from "../Specimen";

// components/soundtrack/BandInvite.tsx and BandStage.tsx, static: the band as
// the site builds it, every music state's layer stacked in one grid cell and
// the lab's switch choosing which one shows. The credit row runs along the
// band's bottom (in flow here, absolute on the site, so a narrow bench never
// stacks it on the notes). No audio, no wave, no store. The notes under the
// question are sentences, so they stay body text.
const c = siteContent.listen;
const s = siteContent.soundtrack;

type Music = "before" | "on" | "paused" | "off";
const STATES: readonly Music[] = ["before", "on", "paused", "off"];

const FOCUS = "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PRIMARY = `font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent underline decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;
const QUIET = `text-sm text-muted transition-colors duration-200 hover:text-foreground ${FOCUS}`;
const SMALL = `text-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;
const LINK = `rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground ${FOCUS}`;

function Layer({ shown, className = "", style, children }: { shown: boolean; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div inert={!shown} style={style} className={`col-start-1 row-start-1 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"} ${className}`}>
      {children}
    </div>
  );
}

export function SoundBand() {
  const [music, setMusic] = useState<Music>("before");
  const { controlAlign } = useShown();
  return (
    <div className="relative flex flex-col gap-10 md:min-h-[clamp(240px,30vh,340px)]">
      <div className="flex gap-1 text-[11px] [font-family:system-ui]">
        <span className="mr-2 text-muted">Music state</span>
        {STATES.map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={music === state}
            onClick={() => setMusic(state)}
            className={`rounded px-2 py-0.5 ${music === state ? "bg-accent text-background" : "text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
          >
            {state}
          </button>
        ))}
      </div>

      <div className="w-fit max-w-full">
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3" style={{ columnGap: "var(--lab-heading-gap, 28px)" }}>
          <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
          <div className={controlAlign === "site" ? "grid" : "grid items-baseline"}>
            <Layer
              shown={music === "before"}
              className={`flex ${controlAlign === "center" ? "items-center" : "items-baseline"}`}
              style={{ gap: "var(--lab-control-gap, 24px)" }}
            >
              <button type="button" className={PRIMARY}>
                {c.accept}
              </button>
              <button type="button" className={`lab-secondary ${QUIET}`} {...role("controls", 14)}>
                {c.decline}
              </button>
            </Layer>
            <Layer shown={music === "on"}>
              <button type="button" className={SMALL} {...role("controls", 14)}>
                {c.pause}
              </button>
            </Layer>
            <Layer shown={music === "paused"}>
              <button type="button" className={SMALL} {...role("controls", 14)}>
                {c.resume}
              </button>
            </Layer>
          </div>
        </div>
        <div className="mt-2 grid max-w-[42rem] text-sm leading-[1.5] text-muted">
          <Layer shown={music === "before"}>
            <p>{c.body}</p>
          </Layer>
          <Layer shown={music === "on"}>
            <p>{c.acceptedNote}</p>
          </Layer>
          <Layer shown={music === "paused"}>
            <p>{c.pausedNote}</p>
          </Layer>
          <Layer shown={music === "off"}>
            <p>{c.declinedNote}</p>
          </Layer>
        </div>
      </div>

      <div className="relative z-10 pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-xs leading-[1.5] text-muted">
          <button
            type="button"
            className="rounded-sm underline decoration-1 underline-offset-[3px] transition-[color,opacity] duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            {...role("controls", 12)}
          >
            {c.freeze}
          </button>
          <p className="ml-auto" {...role("credit", 12, false, "hint")}>
            {s.creditLead}{" "}
            <a href={s.creditArtistUrl} target="_blank" rel="noopener noreferrer" className={LINK} data-interactive="">
              {s.creditArtist}
            </a>
            {s.creditJoin}{" "}
            <a href={s.creditLicenseUrl} target="_blank" rel="noopener noreferrer" className={LINK} data-interactive="">
              {s.creditLicense}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
