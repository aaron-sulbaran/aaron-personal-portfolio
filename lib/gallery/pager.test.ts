import { describe, expect, it } from "vitest";
import { pagerReducer } from "@/lib/gallery/pager";

describe("pagerReducer", () => {
  it("turns a page at a time and never past either end", () => {
    let state = { index: 0, count: 3 };
    state = pagerReducer(state, { type: "prev" });
    expect(state.index).toBe(0);
    state = pagerReducer(pagerReducer(pagerReducer(state, { type: "next" }), { type: "next" }), { type: "next" });
    expect(state.index).toBe(2);
    expect(pagerReducer(state, { type: "goto", index: 9 }).index).toBe(2);
  });
  it("takes a new count (a paragraph got a page of its own) and keeps the page, within it", () => {
    expect(pagerReducer({ index: 1, count: 10 }, { type: "count", count: 14 })).toEqual({ index: 1, count: 14 });
    expect(pagerReducer({ index: 9, count: 14 }, { type: "count", count: 10 })).toEqual({ index: 9, count: 10 });
    expect(pagerReducer({ index: 9, count: 14 }, { type: "count", count: 5 })).toEqual({ index: 4, count: 5 });
  });
  it("lets the last page be reached once the count has grown, and not before", () => {
    const grown = pagerReducer({ index: 9, count: 10 }, { type: "count", count: 14 });
    expect(pagerReducer(grown, { type: "next" }).index).toBe(10);
  });
  it("is the same state when the count is the same", () => {
    const state = { index: 2, count: 10 };
    expect(pagerReducer(state, { type: "count", count: 10 })).toBe(state);
  });
});
