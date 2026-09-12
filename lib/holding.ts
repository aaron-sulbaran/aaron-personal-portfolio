// Site mode switch. Production on Vercel runs with NEXT_PUBLIC_SITE_MODE=holding
// so aaronsulbaran.com shows the "under remodeling" page while the full build
// finishes. Previews and local dev leave the variable unset and get the full
// site. Flipping the real site live is deleting the env var and redeploying;
// no code change. NEXT_PUBLIC_ so the value is inlined at build time and the
// gate is a constant in both server and client bundles.
export type SiteMode = "full" | "holding";

export function parseSiteMode(value: string | undefined): SiteMode {
  return value === "holding" ? "holding" : "full";
}

export const SITE_MODE: SiteMode = parseSiteMode(process.env.NEXT_PUBLIC_SITE_MODE);
export const HOLDING_MODE = SITE_MODE === "holding";
