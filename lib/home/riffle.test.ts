import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { riffleSteps } from "@/lib/home/riffle";

describe("the riffle's plan", () => {
  const plan = riffleSteps(COIL.deal.deck.cards, COIL.deal.riffle.ms);

  it("splits the deck into two halves, bottom and top", () => {
    expect(plan.halves).toEqual(["L", "L", "L", "R", "R", "R"]);
    expect(riffleSteps(5, 800).halves).toEqual(["L", "L", "L", "R", "R"]);
  });

  it("brings every card back exactly once, alternating halves, one falling at a time in order", () => {
    expect(plan.drops).toHaveLength(COIL.deal.deck.cards);
    expect(plan.drops.map((drop) => drop.card).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(plan.drops.map((drop) => drop.half)).toEqual(["L", "R", "L", "R", "L", "R"]);
    for (let i = 1; i < plan.drops.length; i++) expect(plan.drops[i].startMs).toBeGreaterThan(plan.drops[i - 1].startMs);
  });

  it("keeps each half's own order (the lower half's cards fall bottom first)", () => {
    const lower = plan.drops.filter((drop) => drop.half === "L").map((drop) => drop.card);
    const upper = plan.drops.filter((drop) => drop.half === "R").map((drop) => drop.card);
    expect(lower).toEqual([0, 1, 2]);
    expect(upper).toEqual([3, 4, 5]);
  });

  it("parts before the first card falls back, and squares up before the end", () => {
    expect(plan.drops[0].startMs).toBeGreaterThan(0);
    expect(plan.drops[0].startMs).toBeLessThan(plan.splitEndMs);
    expect(plan.squareStartMs).toBeLessThan(plan.totalMs);
    for (const drop of plan.drops) expect(drop.startMs + drop.durationMs).toBeLessThanOrEqual(plan.totalMs + 1e-9);
  });

  it("runs under a second by default and scales with the duration", () => {
    expect(plan.totalMs).toBeLessThan(1000);
    const slow = riffleSteps(COIL.deal.deck.cards, plan.totalMs * 2);
    expect(slow.drops[3].startMs).toBeCloseTo(plan.drops[3].startMs * 2, 9);
  });

  it("handles a deck of one, two or none", () => {
    expect(riffleSteps(0, 800).drops).toEqual([]);
    expect(riffleSteps(1, 800).drops).toHaveLength(1);
    expect(riffleSteps(2, 800).drops.map((drop) => drop.half)).toEqual(["L", "R"]);
  });
});
