/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 only serves qualities listed here (default [75]); GlassTile asks
  // for 88 and PhotoModal for 90, which would otherwise fall back silently.
  images: {
    qualities: [75, 88, 90],
  },
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
