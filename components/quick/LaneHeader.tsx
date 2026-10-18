"use client";

import { ArrowDown } from "lucide-react";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { HOME_PATH } from "@/lib/quick/transition";
import type { TitleMode } from "@/lib/quick/settings";
import { goTo } from "@/lib/quick/transitionStore";
import { jumpToNext } from "./jumpToNext";
import { MvpTitle } from "./MvpTitle";
import { useFieldTip } from "./useFieldTip";

// The lane's head: the MVP title, the intro, "Currently looking for:" (B, a
// teaser of the Next checkpoint that scrolls to it), the three ways to reach me,
// and the way back to the full site through the transition (a real link without
// it). The back button tells a mouse or keyboard visitor, in a tip, that the MVP
// stays in the menu; a touch screen has no hover, so the same words sit under it.

export type TitleProps = { titleMode?: TitleMode; titleDelayMs?: number; titleStaggerMs?: number; titleDurationMs?: number; forceReduced?: boolean };

const links = (["linkedin", "email", "github"] as const).map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

type HeaderProps = TitleProps & {
  intro: string;
  // B: the short what's-next line, or null while B is off.
  looking: string | null;
  // A is on, so there is a Next checkpoint for B to scroll to.
  canJump: boolean;
  tipBack: string;
};

function Looking({ line, canJump, forceReduced }: { line: string; canJump: boolean; forceReduced?: boolean }) {
  const label = <span className="text-muted">{quickCopy.next.lookingFor}</span>;
  return (
    <p data-lane-line="" data-lane-whole="" data-quick-looking="" className="mt-4 text-base leading-snug">
      {canJump ? (
        <button
          type="button"
          onClick={() => jumpToNext(forceReduced)}
          className="group/looking rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {label}{" "}
          <span className="text-foreground underline decoration-border decoration-1 underline-offset-4 transition-colors group-hover/looking:text-accent group-hover/looking:decoration-accent">{line}</span>
          <ArrowDown aria-hidden="true" className="ml-1.5 inline-block h-4 w-4 align-[-2px] text-accent" strokeWidth={2} />
          <span className="sr-only">{quickCopy.next.lookingForAction}</span>
        </button>
      ) : (
        <>
          {label} <span className="text-foreground">{line}</span>
        </>
      )}
    </p>
  );
}

export function LaneHeader({ intro, looking, canJump, tipBack, titleMode, titleDelayMs, titleStaggerMs, titleDurationMs, forceReduced }: HeaderProps) {
  const back = useFieldTip(tipBack, "paper");
  return (
    <header className="mb-20 max-w-3xl md:mb-28">
      <MvpTitle mode={titleMode} delayMs={titleDelayMs} staggerMs={titleStaggerMs} durationMs={titleDurationMs} forceReduced={forceReduced} />
      <p data-lane-line="" className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-body-lg">
        {intro}
      </p>
      {looking && <Looking line={looking} canJump={canJump} forceReduced={forceReduced} />}
      <p data-lane-line="" data-quick-hint="" className="mt-3 text-sm leading-snug text-accent">
        {quickCopy.hint}
      </p>
      <ul data-lane-line="" className="mt-8 flex flex-wrap items-center gap-2 font-label text-label">
        {links.map((link) => (
          <li key={link.key}>
            <a href={link.href} {...external(link.href)} className="inline-flex rounded-full px-4 py-2 text-foreground ring-1 ring-inset ring-border transition-colors hover:text-accent hover:ring-accent">
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <a
            href={HOME_PATH}
            {...back.bind}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              goTo(HOME_PATH);
            }}
            className="inline-flex rounded-full bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-hover"
          >
            {quickCopy.back}
          </a>
          {back.tip}
        </li>
      </ul>
      {tipBack && (
        <p data-quick-back-note="" className="mt-3 hidden max-w-xs text-sm leading-snug text-muted [@media(hover:none)]:block">
          {tipBack}
        </p>
      )}
    </header>
  );
}
