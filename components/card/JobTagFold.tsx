"use client";

import { ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { jobTags } from "@/lib/content/jobTags";
import { partId } from "@/lib/gallery/timing";
import { TAG_BAND, TagLogo } from "./JobTag";

// A job's name tag on a phone's page, under the paragraph it sits with (Aaron, 2026-11-09): "a smaller version of the Apple card with
// just the Apple logo. And then the big text should say Specialist, then Technical Specialist, and then ... the year. And then the
// dropdown finally for like my tip". It sits in its paragraph's block (PagerPage), so it stays on its job's page; the tip opens under
// it, and the page's words scroll to show it when they run past the page (Aaron, 2026-11-09: "They can and are allowed to scroll").
export function JobTagFold({ photo, job }: { photo: number; job: number }) {
  const tag = jobTags[job];
  const copy = siteContent.cards.jobs.tag;
  const [open, setOpen] = useState(false);
  const tip = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useLayoutEffect(() => {
    const panel = tip.current;
    const area = panel?.closest<HTMLElement>("[data-pager-text]");
    if (!open || !panel || !area) return;
    const below = panel.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (below > 0) area.scrollTo({ top: area.scrollTop + below + 8, behavior: smooth ? "smooth" : "auto" });
  }, [open]);

  return (
    <div className="flex flex-col">
      <div>
        <div
          role="group"
          aria-label={copy.label(tag.employer)}
          data-job-tag={job}
          data-job-tag-fold=""
          data-mask={partId.photo(photo)}
          data-mask-kind="photo"
          className={`overflow-hidden border border-border bg-background text-foreground ${open ? "rounded-t-xl" : "rounded-xl"}`}
        >
          <div data-mask-media="">
            <div className="flex h-8 items-center justify-center border-b border-border px-4" style={TAG_BAND} data-job-tag-logo="">
              {tag.logo && <TagLogo logo={tag.logo} small />}
            </div>
            <div className="flex flex-col gap-1 px-4 pb-2.5 pt-2">
              <p className="font-display text-[1.125rem] leading-[1.15] text-foreground" data-job-tag-role="">{tag.role ?? tag.employer}</p>
              <p className="font-label text-label text-muted" data-job-tag-when="">{tag.when}</p>
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((was) => !was)}
              className="flex w-full items-center justify-between gap-3 border-t border-border px-4 py-2 text-left font-label text-label text-accent"
              data-job-tag-more=""
            >
              <span>{copy.more}</span>
              <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      {/* The tip hangs from the tag as one card. */}
      <div ref={tip} id={id} hidden={!open} className="rounded-b-xl border border-t-0 border-border bg-background px-4 pb-4 pt-3" data-job-tag-tip="">
        <p className="text-[0.9375rem] leading-snug text-foreground">{tag.tip}</p>
      </div>
    </div>
  );
}
