"use client";

import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { HOME_PATH } from "@/lib/quick/transition";
import type { TitleMode } from "@/lib/quick/settings";
import { goTo } from "@/lib/quick/transitionStore";
import { MvpTitle } from "./MvpTitle";

// The lane's head: the MVP title, the intro, the three ways to reach me, and the
// way back to the full site through the transition (a real link without it).

export type TitleProps = { titleMode?: TitleMode; titleDelayMs?: number; titleStaggerMs?: number; forceReduced?: boolean };

const links = (["linkedin", "email", "github"] as const).map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function LaneHeader({ intro, titleMode, titleDelayMs, titleStaggerMs, forceReduced }: TitleProps & { intro: string }) {
  return (
    <header className="mb-20 max-w-3xl md:mb-28">
      <MvpTitle mode={titleMode} delayMs={titleDelayMs} staggerMs={titleStaggerMs} forceReduced={forceReduced} />
      <p data-lane-line="" className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-body-lg">
        {intro}
      </p>
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
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              goTo(HOME_PATH);
            }}
            className="inline-flex rounded-full bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-hover"
          >
            {quickCopy.back}
          </a>
        </li>
      </ul>
    </header>
  );
}
