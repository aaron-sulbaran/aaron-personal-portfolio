"use client";

import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { HOME_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";

// The lane's head: the title, the intro, the three ways to reach me, and the
// way back to the full site through the transition (a real link without it).

export const LANE_HEADING_ID = "express-lane-title";

const links = (["linkedin", "email", "github"] as const).map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function LaneHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-20 max-w-3xl md:mb-28">
      <h1 id={LANE_HEADING_ID} tabIndex={-1} data-lane-line="" className="font-display text-display text-foreground focus-visible:outline-none">
        {title}
      </h1>
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
