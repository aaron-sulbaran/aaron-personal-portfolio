import type { MetadataRoute } from "next";
import { siteContent } from "@/lib/content";

const BASE = "https://aaronsulbaran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1 },
    { url: `${BASE}/about` },
    { url: `${BASE}/work` },
  ];

  const workRoutes: MetadataRoute.Sitemap = siteContent.workItems.map(
    (item) => ({ url: `${BASE}/work/${item.slug}` })
  );

  return [...staticRoutes, ...workRoutes];
}
