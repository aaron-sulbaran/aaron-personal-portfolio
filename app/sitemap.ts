import type { MetadataRoute } from "next";
import { builtAtDate } from "@/lib/buildDate";

const BASE = "https://aaronsulbaran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Work and About are sections of the home document. /quick is the short page.
  // lastModified is the build's own timestamp, the source of the footer's "Last updated".
  const lastModified = builtAtDate();
  return [
    { url: BASE, lastModified, priority: 1 },
    { url: `${BASE}/quick`, lastModified, priority: 0.8 },
  ];
}
