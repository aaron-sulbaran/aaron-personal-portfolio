import { SECURITY_HEADERS } from "./lib/security/headers.mjs";
import { parseZones, zoneRewrites } from "./lib/zones.mjs";

// Other projects on this domain, from the SITE_ZONES env var (lib/zones.mjs).
// A malformed value fails the build, so a typo never ships a site that
// quietly drops a zone; the live deployment stays as it was.
const zones = parseZones(process.env.SITE_ZONES);
if (zones.error) throw new Error(`SITE_ZONES: ${zones.error}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No x-powered-by header: it names the framework to anyone shopping for its advisories.
  poweredByHeader: false,
  // Next 16.4's next dev writes a managed block into AGENTS.md whenever it sees
  // a coding agent. AGENTS.md is hand-kept (Layer 1 and Layer 2, with a size
  // budget), so it stays off; false also removes a block an older run left.
  agentRules: false,
  // The build's own timestamp, inlined at build time: the footer's "Last
  // updated" month is the month this build shipped, never a hand-kept string.
  env: {
    SITE_BUILT_AT: new Date().toISOString(),
  },
  // Next 16 only serves qualities listed here (default [75]); the card modal and
  // the flight's sharp copy ask for 90, which would otherwise fall back
  // silently.
  images: {
    qualities: [75, 90],
  },
  // The Coil scene (components/coil/CoilScene.tsx) imports vanilla three as
  // ES modules; transpiling keeps it on the app's own browser targets.
  transpilePackages: ["three"],
  // The standalone /work and /about pages were folded into the single scrolling
  // home document. Redirect their old URLs to the in-page anchors so existing
  // links and shares still resolve. Every old /work/... URL, case pages
  // included, lands on the book. Redirects run before public files, so the
  // logo assets under /work/logos/ are excluded.
  async redirects() {
    return [
      { source: "/work", destination: "/#work", permanent: false },
      { source: "/work/:path((?!logos/).*)", destination: "/#work", permanent: false },
      { source: "/about", destination: "/#about", permanent: false },
      { source: "/express", destination: "/quick", permanent: false },
      { source: "/simple", destination: "/quick", permanent: false },
      { source: "/recruiter", destination: "/quick", permanent: false },
    ];
  },
  // Each zone's path goes to its own project (lib/zones.mjs). None are listed
  // in the code; with SITE_ZONES unset this returns no rewrites.
  async rewrites() {
    return zoneRewrites(zones.data);
  },
  // Every response, pages, assets and 404s alike (lib/security/headers.mjs).
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
