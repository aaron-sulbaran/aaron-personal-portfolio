// Zones: other projects served on this domain as Next.js multi-zones. Each
// one is its own repo and Vercel project that sets `basePath: "/<path>"`, so
// its pages and its /_next assets all live under that path.
//
// SITE_ZONES lists them as comma-separated path=origin pairs, for example
// "demo=https://zone-demo.vercel.app". The origin is the zone's production
// domain, https with no path. No zone's path or origin is written in this
// repo, so the public mirror never names one. next.config.mjs turns the list
// into rewrites; plain ESM so the config can import it without a build step.
import { z } from "zod";

// One lowercase URL segment, the same string as the zone's basePath.
const zonePath = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "a path must be one lowercase segment");

const zoneOrigin = z
  .url({ protocol: /^https$/, error: "an origin must be an https URL" })
  // Zod runs this even when the URL check above failed, so parse guardedly.
  .refine(
    (value) => !URL.canParse(value) || new URL(value).origin === value.replace(/\/$/, ""),
    "an origin must not carry a path, query or hash",
  )
  .transform((value) => new URL(value).origin);

/**
 * Reads a SITE_ZONES value. An empty or missing value means no zones.
 * @param {string | undefined} value
 * @returns {{ data: { path: string, origin: string }[], error: null } | { data: null, error: string }}
 */
export function parseZones(value) {
  const entries = (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const zones = [];
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator < 1) return { data: null, error: `"${entry}" is not a path=origin pair` };
    const path = zonePath.safeParse(entry.slice(0, separator).trim());
    if (!path.success) return { data: null, error: `"${entry}": ${path.error.issues[0].message}` };
    const origin = zoneOrigin.safeParse(entry.slice(separator + 1).trim());
    if (!origin.success) return { data: null, error: `"${entry}": ${origin.error.issues[0].message}` };
    if (zones.some((zone) => zone.path === path.data)) {
      return { data: null, error: `"${path.data}" is listed twice` };
    }
    zones.push({ path: path.data, origin: origin.data });
  }
  return { data: zones, error: null };
}

/**
 * The two rewrites each zone needs: its root and everything under it. A plain
 * rewrites() array runs after the site's own pages and public files, so a
 * zone can never shadow a page this site serves.
 * @param {{ path: string, origin: string }[]} zones
 */
export function zoneRewrites(zones) {
  return zones.flatMap(({ path, origin }) => [
    { source: `/${path}`, destination: `${origin}/${path}` },
    { source: `/${path}/:path+`, destination: `${origin}/${path}/:path+` },
  ]);
}
