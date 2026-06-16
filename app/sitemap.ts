import type { MetadataRoute } from "next";
import { siteContent } from "@/lib/content";

const BASE = "https://aaronsulbaran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Work and About are now in-page sections of the home document, reached via
  // /#work and /#about (the old standalone routes redirect there), so only the
  // home page and the real case-study routes belong in the sitemap.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1 },
  ];

  const workRoutes: MetadataRoute.Sitemap = siteContent.workItems.map(
    (item) => ({ url: `${BASE}/work/${item.slug}` })
  );

  return [...staticRoutes, ...workRoutes];
}
