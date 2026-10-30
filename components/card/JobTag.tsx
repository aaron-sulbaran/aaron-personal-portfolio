import Image from "next/image";
import { siteContent } from "@/lib/content";
import { jobTags } from "@/lib/content/jobTags";
import type { LogoRef } from "@/lib/content";

// A job as an employee name tag, the way I'd hand one across a counter: the employer's logo across the top, my name set on it,
// my role and when, and under that the insider tip itself, labelled as mine. Flat and in the site's card language: the
// photos' radius, a hairline border and the page's own tokens, no sheen, clip or script face. The logo comes in a light and a
// dark file, shown by theme. The tip is on the page for anyone to read, never behind a hover. Words: lib/content (cards.jobs.tag).
const BAND = { backgroundColor: "color-mix(in srgb, var(--color-foreground) 5%, var(--color-background))" };
const LOGO = "h-auto max-h-9 w-auto max-w-[10.5rem]";

function Logo({ logo }: { logo: LogoRef }) {
  const size = { width: Math.round(logo.width), height: Math.round(logo.height) };
  return (
    <>
      <Image src={logo.src} alt="" {...size} className={`${LOGO} ${logo.srcDark ? "dark:hidden" : ""}`} draggable={false} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" {...size} className={`${LOGO} hidden dark:block`} draggable={false} />}
    </>
  );
}

export function JobTag({ job }: { job: number }) {
  const tag = jobTags[job];
  const copy = siteContent.cards.jobs.tag;
  return (
    <section aria-label={copy.label(tag.employer)} data-job-tag={job} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground">
      <div className="flex h-[4.25rem] items-center justify-center border-b border-border px-5" style={BAND} data-job-tag-logo="">
        {tag.logo && <Logo logo={tag.logo} />}
      </div>
      <div className="flex flex-col gap-1 px-5 pb-4 pt-4">
        <p className="font-display text-[2rem] leading-none text-foreground" data-job-tag-name="">{copy.name}</p>
        {tag.role && <p className="font-label text-label text-accent" data-job-tag-role="">{tag.role}</p>}
        <p className="font-label text-label text-muted" data-job-tag-when="">{tag.when}</p>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-border px-5 pb-5 pt-4" data-job-tag-tip="">
        <p className="font-label text-label-sm text-muted">{copy.tipLabel}</p>
        <p className="text-[0.9375rem] leading-snug text-foreground">{tag.tip}</p>
      </div>
    </section>
  );
}
