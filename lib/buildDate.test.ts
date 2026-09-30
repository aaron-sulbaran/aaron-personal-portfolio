import { describe, expect, it } from "vitest";
import { lastUpdatedMonth } from "@/lib/buildDate";
import { siteContent } from "@/lib/content";

describe("the footer's last updated month", () => {
  it("names the build's month in Austin time", () => {
    expect(lastUpdatedMonth("2026-09-29T15:00:00.000Z")).toBe("September 2026");
    // 02:00 UTC on October 1 is still September 30 in Austin.
    expect(lastUpdatedMonth("2026-10-01T02:00:00.000Z")).toBe("September 2026");
  });

  it("reads as the tagline", () => {
    expect(siteContent.footer.tagline(lastUpdatedMonth("2026-09-29T15:00:00.000Z"))).toBe(
      "This site grows with me. Last updated September 2026",
    );
  });
});
