// Site mode switch. Holding is the DEFAULT: a plain git build on Vercel (no
// env config at all) serves the "under remodeling" page at /, so production
// can never accidentally show the unfinished site. The full site is opted
// into with NEXT_PUBLIC_SITE_MODE=full; the committed .env.development sets
// that for `pnpm dev`, and a Preview-scoped env var on Vercel does the same
// for branch previews. Going live is deleting the default here (one line),
// tracked in git rather than in dashboard state. NEXT_PUBLIC_ so the value is
// inlined at build time and the gate is a constant in every bundle.
export type SiteMode = "full" | "holding";

export function parseSiteMode(value: string | undefined): SiteMode {
  return value === "full" ? "full" : "holding";
}

export const SITE_MODE: SiteMode = parseSiteMode(process.env.NEXT_PUBLIC_SITE_MODE);
export const HOLDING_MODE = SITE_MODE === "holding";
