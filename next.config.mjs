/** @type {import('next').NextConfig} */
const nextConfig = {
  // The build's own timestamp, inlined at build time: the footer's "Last
  // updated" month is the month this build shipped, never a hand-kept string.
  env: {
    SITE_BUILT_AT: new Date().toISOString(),
  },
  // Next 16 only serves qualities listed here (default [75]); PhotoModal and
  // the flight's sharp copy ask for 90, which would otherwise fall back
  // silently. 88 was the retired GlassTile's.
  images: {
    qualities: [75, 88, 90],
  },
  // The Coil scene (components/coil/CoilScene.tsx) imports vanilla three as
  // ES modules; transpiling keeps it on the app's own browser targets.
  transpilePackages: ["three"],
  // The standalone /work and /about pages were folded into the single scrolling
  // home document. Redirect their old URLs to the in-page anchors so existing
  // links and shares still resolve. /work/[slug] case studies stay real routes
  // (the exact "/work" source does not match nested paths).
  async redirects() {
    return [
      { source: "/work", destination: "/#work", permanent: false },
      { source: "/about", destination: "/#about", permanent: false },
    ];
  },
};

export default nextConfig;
