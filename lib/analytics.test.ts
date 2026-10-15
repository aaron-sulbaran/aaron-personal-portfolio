import { describe, expect, it } from "vitest";
import { allowAnalyticsEvent } from "./analytics";

describe("allowAnalyticsEvent", () => {
  it("keeps every page while no route is private", () => {
    expect(allowAnalyticsEvent("/")).toBe(true);
    expect(allowAnalyticsEvent("/quick")).toBe(true);
    expect(allowAnalyticsEvent("https://aaronsulbaran.com/")).toBe(true);
  });
  it("drops a listed private route and the pages under it, and nothing else", () => {
    const routes = ["/private"];
    expect(allowAnalyticsEvent("/private", routes)).toBe(false);
    expect(allowAnalyticsEvent("/private/edit", routes)).toBe(false);
    expect(allowAnalyticsEvent("https://aaronsulbaran.com/private?x=1", routes)).toBe(false);
    expect(allowAnalyticsEvent("/private-notes", routes)).toBe(true);
    expect(allowAnalyticsEvent("/", routes)).toBe(true);
  });
});
