import type { MetadataRoute } from "next";

const BASE = "https://aaronsulbaran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Work and About are sections of the home document (/#work, /#about); the site has no other public page.
  return [{ url: BASE, priority: 1 }];
}
