import { describe, expect, it } from "vitest";
import { celBeats, celMarkup, celPlan } from "@/lib/mark/cel";
import { CEL_PICK } from "@/lib/mark/constants";
import { BAR_D, BOLT_D, LEG_D } from "@/lib/mark/geometry";

const ids = { glow: "g", wide: "w", pool: "p", bloom: "b" };

describe("the cel strike", () => {
  it("is the same take every time from seed 7, and another take from seed 8", () => {
    expect(celPlan(CEL_PICK)).toEqual(celPlan(CEL_PICK));
    expect(celPlan({ ...CEL_PICK, celSeed: 8 }).frames[6]).not.toEqual(celPlan(CEL_PICK).frames[6]);
  });

  it("strobes three poses on twos with blank frames, impacts on frame 6, the A on frame 7", () => {
    const plan = celPlan(CEL_PICK);
    expect(plan.frames).toHaveLength(19);
    expect([plan.impactFrame, plan.aFrame]).toEqual([6, 7]);
    expect([plan.frames[2].fx.length, plan.frames[5].fx.length]).toEqual([0, 0]);
    expect(plan.frames[6]).toMatchObject({ bolt: true, a: false, bloom: 0.14 });
    expect(plan.frames[7].a).toBe(true);
    expect(plan.fullFlash).toBe(0.14);
  });

  it("lands at 350ms and settles at 1192ms", () => {
    const beats = celBeats(CEL_PICK);
    expect(Math.round(beats.impact * 1000)).toBe(350);
    expect(Math.round(beats.settle * 1000)).toBe(1192);
  });

  it("ends on the three paths alone, so the swap to AsMark is invisible", () => {
    expect(celMarkup(celPlan(CEL_PICK), 18, ids, CEL_PICK)).toBe(
      `<g style="fill:var(--cel-core)"><path d="${BOLT_D}"/><path d="${LEG_D}"/><path d="${BAR_D}"/></g>`,
    );
  });
});
