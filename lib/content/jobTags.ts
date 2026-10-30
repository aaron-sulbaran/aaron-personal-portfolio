import { cards } from "./cards";
import { quickEntries } from "./quick";
import type { LogoRef } from "./types";

// What a job's name tag shows (components/card/JobTag): the employer's logo across the top, the role and when from
// the timeline entry, and the tip. A role the timeline leaves null is the role quick.ts's jobs entries already
// give for that employer, without its year, so no role is invented here.
export interface JobTagView { employer: string; logo: LogoRef | null; role: string | null; when: string; tip: string }

const yearless = (role: string): string => role.replace(/,\s*20\d\d$/, "");

// quick.ts files each job on its own tile, which carries the employer's logo (the same file the timeline names).
function quickRole(logo: LogoRef | null): string | null {
  const entry = logo ? quickEntries.find((candidate) => candidate.id === "jobs" && candidate.tileLogo === logo) : undefined;
  return entry ? yearless(entry.role) : null;
}

export const jobTags: readonly JobTagView[] = cards.jobs.timeline.map((entry) => ({
  employer: entry.employer,
  logo: entry.logo,
  role: entry.role ?? quickRole(entry.logo),
  when: entry.when,
  tip: entry.tip,
}));
