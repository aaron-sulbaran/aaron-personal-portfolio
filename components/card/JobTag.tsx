import Image from "next/image";
import { siteContent } from "@/lib/content";
import { jobTags } from "@/lib/content/jobTags";
import type { LogoRef } from "@/lib/content";

// A job as an employee name tag, the way I'd hand one across a counter: the employer's logo across the top, my role set big on it
// (not my name: Aaron, 2026-11-09, "why does it have to say Aaron for every single one?") and when, and under that the insider tip
// itself, labelled as mine. Flat and in the site's card language: the photos' radius, a hairline border and the page's own tokens, no
// sheen, clip or script face. The logo comes in a light and a dark file, shown by theme. On a desktop the tip is on the page for anyone
// to read, never behind a hover; a phone draws the smaller tag with the tip as a dropdown (components/card/JobTagFold). Words:
// lib/content (cards.jobs.tag).
export const TAG_BAND = { backgroundColor: "color-mix(in srgb, var(--color-foreground) 5%, var(--color-background))" };
const LOGO = "h-auto max-h-9 w-auto max-w-[10.5rem]";
const LOGO_SMALL = "h-auto max-h-6 w-auto max-w-[8rem]";

export function TagLogo({ logo, small = false }: { logo: LogoRef; small?: boolean }) {
  const size = { width: Math.round(logo.width), height: Math.round(logo.height) };
  const fit = small ? LOGO_SMALL : LOGO;
  return (
    <>
      <Image src={logo.src} alt="" {...size} className={`${fit} ${logo.srcDark ? "dark:hidden" : ""}`} draggable={false} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" {...size} className={`${fit} hidden dark:block`} draggable={false} />}
    </>
  );
}

export function JobTag({ job }: { job: number }) {
  const tag = jobTags[job];
  const copy = siteContent.cards.jobs.tag;
  return (
    <div role="group" aria-label={copy.label(tag.employer)} data-job-tag={job} className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground">
      <div className="flex h-[4.25rem] items-center justify-center border-b border-border px-5" style={TAG_BAND} data-job-tag-logo="">
        {tag.logo && <TagLogo logo={tag.logo} />}
      </div>
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-4">
        <p className="font-display text-[1.5rem] leading-[1.1] text-foreground" data-job-tag-role="">{tag.role ?? tag.employer}</p>
        <p className="font-label text-label text-muted" data-job-tag-when="">{tag.when}</p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-border px-5 pb-5 pt-4" data-job-tag-tip="">
        <p className="font-label text-label-sm text-muted">{copy.tipLabel}</p>
        <p className="text-[0.9375rem] leading-snug text-foreground">{tag.tip}</p>
      </div>
    </div>
  );
}
