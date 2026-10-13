import type { MetadataRoute } from "next";

const BASE = "https://aaronsulbaran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Work and About are sections of the home document. /quick is the short page.
  return [
    { url: BASE, priority: 1 },
    { url: `${BASE}/quick`, priority: 0.8 },
  ];
}
