import { describe, expect, it } from "vitest";
import { siteContent } from "./content";
import { OPEN_GRAPH_BASE, TWITTER_BASE, pageShare } from "./pageShare";

describe("pageShare", () => {
  const share = pageShare({ path: "/quick", title: "Quick | Me", description: "The short one." });

  it("points the share URL and the canonical at the page, not the home", () => {
    expect(share.openGraph.url).toBe("/quick");
    expect(share.alternates.canonical).toBe("/quick");
  });

  it("gives the page its own title and description on both cards", () => {
    expect(share.openGraph).toMatchObject({ title: "Quick | Me", description: "The short one." });
    expect(share.twitter).toMatchObject({ title: "Quick | Me", description: "The short one." });
  });

  it("names the share card again, since a page-level openGraph drops the root's file image", () => {
    expect(share.openGraph.images).toEqual([{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: siteContent.meta.title }]);
    expect(share.twitter.images).toEqual(share.openGraph.images);
  });

  it("carries the shared fields a page-level openGraph would otherwise drop", () => {
    expect(share.openGraph.siteName).toBe(siteContent.meta.title);
    expect(share.openGraph.type).toBe("website");
    expect(share.twitter.card).toBe("summary_large_image");
    expect(share.openGraph).toMatchObject(OPEN_GRAPH_BASE);
    expect(share.twitter).toMatchObject(TWITTER_BASE);
  });
});
