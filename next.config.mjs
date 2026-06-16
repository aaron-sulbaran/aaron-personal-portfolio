/** @type {import('next').NextConfig} */
const nextConfig = {
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
