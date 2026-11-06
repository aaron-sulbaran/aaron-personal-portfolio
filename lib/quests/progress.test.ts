import { describe, expect, it } from "vitest";
import { runProgress, totalFound, totalQuests } from "./progress";
import { ALL_QUEST_IDS, questIds } from "./registry";
import type { QuestState } from "./types";

const state = (found: Record<string, number>): QuestState => ({ found, clockMs: 0, finishes: {} });

describe("runProgress", () => {
  it("asks Any% for cards, pops and eggs, and not the MVP", () => {
    const run = runProgress(state({}), "any");
    expect(run.groups.map((g) => [g.group, g.needed])).toEqual([["cards", 5], ["pops", 3], ["eggs", 1]]);
    expect(run.neededTotal).toBe(9);
    expect(run.complete).toBe(false);
  });

  it("asks 100% for everything", () => {
    const run = runProgress(state({}), "full");
    expect(run.groups.map((g) => [g.group, g.needed])).toEqual([["cards", 14], ["pops", 8], ["eggs", 2], ["mvp", 1]]);
    expect(run.neededTotal).toBe(25);
  });

  it("dates a group by its needed-th find and caps the count at needed", () => {
    const cards = questIds("cards");
    const found: Record<string, number> = {};
    [900, 100, 500, 300, 700, 200].forEach((at, i) => (found[cards[i]] = at));
    const group = runProgress(state(found), "any").groups[0];
    expect(group.found).toBe(5);
    expect(group.left).toBe(0);
    expect(group.done).toBe(true);
    expect(group.doneAtMs).toBe(700);
  });

  it("leaves doneAtMs null while a group is short", () => {
    const group = runProgress(state({ "card:talos": 10 }), "any").groups[0];
    expect(group).toMatchObject({ found: 1, needed: 5, left: 4, done: false, doneAtMs: null });
  });

  it("completes Any% without the MVP, and 100% only with all of it", () => {
    const found: Record<string, number> = {};
    questIds("cards").slice(0, 5).forEach((id) => (found[id] = 1));
    questIds("pops").slice(0, 3).forEach((id) => (found[id] = 2));
    found["egg:logo"] = 3;
    expect(runProgress(state(found), "any").complete).toBe(true);
    expect(runProgress(state(found), "full").complete).toBe(false);
    const everything = Object.fromEntries(ALL_QUEST_IDS.map((id) => [id, 4]));
    const full = runProgress(state(everything), "full");
    expect(full.complete).toBe(true);
    expect(full.foundTotal).toBe(25);
  });

  it("counts every find uncapped for the button", () => {
    expect(totalQuests()).toBe(25);
    expect(totalFound(state(Object.fromEntries(ALL_QUEST_IDS.map((id) => [id, 0]))))).toBe(25);
    expect(totalFound(state({ "card:talos": 1, "bogus": 2 }))).toBe(1);
  });
});

describe("runProgress with custom rules", () => {
  it("uses the rules given instead of the defaults", () => {
    const rules = { any: { cards: 2, pops: 0, eggs: 0, mvp: 0 }, full: { cards: 1, pops: 0, eggs: 0, mvp: 0 } };
    const run = runProgress({ found: { "card:talos": 1, "card:band": 2 }, clockMs: 0, finishes: {} }, "any", rules);
    expect(run.groups.map((g) => [g.group, g.needed])).toEqual([["cards", 2]]);
    expect(run.complete).toBe(true);
  });
});
