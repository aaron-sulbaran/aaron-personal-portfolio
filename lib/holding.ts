// Site mode switch. Full is the DEFAULT since the go-live (2026-10): a plain
// git build on Vercel, with no env config at all, serves the site. The holding
// page ("Pardon the dust.") is opted into with NEXT_PUBLIC_SITE_MODE=holding,
// so it can come back with one environment variable and no code change.
// NEXT_PUBLIC_ so the value is inlined at build time and the gate is a
// constant in every bundle.
//
// Exempt from the switch: /recruiting (app/recruiting, gated by proxy.ts
// on its own signed cookie) never reads HOLDING_MODE, so it stays reachable
// while the holding page is up. Any new route that should also be exempt simply
// does not consult this module.
export type SiteMode = "full" | "holding";

export function parseSiteMode(value: string | undefined): SiteMode {
  return value === "holding" ? "holding" : "full";
}

export const SITE_MODE: SiteMode = parseSiteMode(process.env.NEXT_PUBLIC_SITE_MODE);
export const HOLDING_MODE = SITE_MODE === "holding";
