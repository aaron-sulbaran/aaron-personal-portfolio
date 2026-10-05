import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/soundtrack/BandInvite.tsx and BandStage.tsx, static: the band in
// each music state side by side (the site stacks them in one grid cell), then
// the credit row along the band's bottom (in flow here, absolute on the site,
// so a narrow bench never stacks it on the notes). No audio, no wave, no
// store. The notes under the question are sentences, so they stay body text.
const c = siteContent.listen;
const s = siteContent.soundtrack;

const FOCUS = "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PRIMARY = `font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent underline decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;
const QUIET = `text-sm text-muted transition-colors duration-200 hover:text-foreground ${FOCUS}`;
const SMALL = `text-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;
const LINK = `rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground ${FOCUS}`;

function Invite({ controls, note }: { controls: ReactNode; note: string }) {
  return (
    <div className="w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
        <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
        <div className="flex items-baseline gap-6">{controls}</div>
      </div>
      <div className="mt-2 max-w-[42rem] text-sm leading-[1.5] text-muted">
        <p>{note}</p>
      </div>
    </div>
  );
}

export function SoundBand() {
  return (
    <div className="relative flex flex-col gap-10 md:min-h-[clamp(240px,30vh,340px)]">
      <Invite
        note={c.body}
        controls={
          <>
            <button type="button" className={PRIMARY}>
              {c.accept}
            </button>
            <button type="button" className={QUIET} {...role("controls", 14)}>
              {c.decline}
            </button>
          </>
        }
      />
      <Invite
        note={c.acceptedNote}
        controls={
          <button type="button" className={SMALL} {...role("controls", 14)}>
            {c.pause}
          </button>
        }
      />
      <Invite
        note={c.pausedNote}
        controls={
          <button type="button" className={SMALL} {...role("controls", 14)}>
            {c.resume}
          </button>
        }
      />

      <div className="relative z-10 pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-xs leading-[1.5] text-muted">
          <button
            type="button"
            className="rounded-sm underline decoration-1 underline-offset-[3px] transition-[color,opacity] duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            {...role("controls", 12)}
          >
            {c.freeze}
          </button>
          <p className="ml-auto" {...role("credit", 12)}>
            {s.creditLead}{" "}
            <a href={s.creditArtistUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {s.creditArtist}
            </a>
            {s.creditJoin}{" "}
            <a href={s.creditLicenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {s.creditLicense}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
