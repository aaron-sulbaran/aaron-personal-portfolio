import { siteContent } from "@/lib/content";
import { OG_SIZE } from "@/lib/og/constants";

// Next replaces the parent's openGraph and twitter objects whole when a page
// sets its own, so the fields the root layout sets for every page live here
// and both the layout and each page spread them.
export const OPEN_GRAPH_BASE = {
  siteName: siteContent.meta.title,
  type: "website",
} as const;

export const TWITTER_BASE = { card: "summary_large_image" } as const;

// The root's file-based card (app/opengraph-image.tsx) is attached to the root
// segment only, so a page that sets openGraph must name it again.
const SHARE_IMAGE = { url: "/opengraph-image", ...OG_SIZE, type: "image/png", alt: siteContent.meta.title } as const;

type Share = { path: string; title: string; description: string };

// A page's own share tags and canonical; path is relative to metadataBase.
export function pageShare({ path, title, description }: Share) {
  return {
    openGraph: { ...OPEN_GRAPH_BASE, title, description, url: path, images: [SHARE_IMAGE] },
    twitter: { ...TWITTER_BASE, title, description, images: [SHARE_IMAGE] },
    alternates: { canonical: path },
  };
}
