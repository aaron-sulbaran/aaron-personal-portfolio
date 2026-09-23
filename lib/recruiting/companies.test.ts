import { describe, expect, it } from "vitest";
import { summarizeCompanies } from "./companies";

describe("summarizeCompanies", () => {
  it("collapses repeats, most repeated first, then alphabetical", () => {
    expect(summarizeCompanies(["Tesla", "Google", "Apple", "Google", "Tesla", "Google"])).toEqual({
      items: ["Google ×3", "Tesla ×2", "Apple"],
      more: 0,
    });
  });

  it("caps a long list and counts the rest", () => {
    const names = Array.from({ length: 30 }, (_, i) => `Co ${String(i).padStart(2, "0")}`);
    const { items, more } = summarizeCompanies(names, 12);
    expect(items).toHaveLength(12);
    expect(more).toBe(18);
  });

  it("is empty for no names", () => {
    expect(summarizeCompanies([])).toEqual({ items: [], more: 0 });
  });
});
