import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { blockIds, headingSizeCss, introDomPlan } from "@/lib/home/introDom";

describe("page 1's layout as DOM", () => {
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS, 4);

  it("names the position, the phone layout and where the wave goes on the section", () => {
    expect(plan.section.attrs).toEqual({ "data-name-position": "center", "data-phone-layout": "storyFirst", "data-wave-after": "2" });
  });

  it("carries the lockup's proportions, the name's size and the gap between blocks", () => {
    expect(plan.section.vars["--lk"]).toBe(headingSizeCss());
    expect(plan.section.vars["--story-gap"]).toBe(`${COIL.intro.stagger.gapRem}rem`);
    expect(plan.section.vars["--lk-greet"]).toBe("0.18000");
  });

  it("gives every block a side and a shift, alternating, the band and the disclosure none", () => {
    const sides = blockIds(4).map((id) => plan.items[id].attrs["data-side"]);
    expect(sides).toEqual(["left", "right", "left", "right"]);
    expect(plan.items["block-2"].vars["--shift"]).toBe(String(COIL.intro.stagger.offset));
    expect(plan.items["block-1"].vars["--shift"]).toBe("0");
    expect(plan.items.band.attrs["data-side"]).toBeUndefined();
    expect(plan.items.more.vars["--shift"]).toBeUndefined();
  });

  it("orders the band between block 2 and block 3 by default", () => {
    const order = (id: string) => Number(plan.items[id].vars["--o-d"]);
    expect(order("block-2")).toBeLessThan(order("band"));
    expect(order("band")).toBeLessThan(order("block-3"));
  });

  it("folds blocks 2 to 4 on a phone only in teaser peeks", () => {
    expect(blockIds(4).map((id) => plan.items[id].attrs["data-collapsible"])).toEqual(["false", "false", "false", "false"]);
    const peeks = introDomPlan({ ...DEFAULT_INTRO_KNOBS, phoneLayout: "teaserPeeks" }, 4);
    expect(blockIds(4).map((id) => peeks.items[id].attrs["data-collapsible"])).toEqual(["false", "true", "true", "true"]);
    expect(peeks.section.attrs["data-phone-layout"]).toBe("teaserPeeks");
    expect(Number(peeks.items.band.vars["--o-p"])).toBeLessThan(Number(peeks.items.more.vars["--o-p"]));
    expect(Number(peeks.items.more.vars["--o-p"])).toBeLessThan(Number(peeks.items["block-2"].vars["--o-p"]));
  });
});
