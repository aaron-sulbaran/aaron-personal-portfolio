import { siteContent } from "@/lib/content";
import { jobTipKey } from "@/lib/content/register";

// A timeline entry's employer as inline markup, so its insider tip is an
// ordinary tip (the register holds job-0 to job-4) and InlineCopy renders it.
export function employerSource(entry: number): string {
  return `[${siteContent.cards.jobs.timeline[entry].employer}](tip:${jobTipKey(entry)})`;
}
