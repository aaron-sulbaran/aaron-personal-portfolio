import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { introDomPlan, nameSizeCss } from "@/lib/home/introDom";

describe("page 1's layout as DOM", () => {
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS);

  it("names the top layout and where block 2 goes on a phone, on the first screen and the about section", () => {
    expect(plan.firstScreen.attrs).toEqual({ "data-top-layout": "beside", "data-phone-block2": "about" });
    expect(plan.about.attrs).toEqual({ "data-phone-block2": "about" });
  });

  it("carries the lockup's proportions, the name's two sizes, the wave's two heights and the gap between blocks", () => {
    expect(plan.firstScreen.vars["--lk-d"]).toBe(nameSizeCss(COIL.intro.name.vwDesktop));
    expect(plan.firstScreen.vars["--lk-p"]).toBe(nameSizeCss(COIL.intro.name.vwPhone));
    expect(plan.firstScreen.vars["--band-d"]).toBe(`${COIL.intro.band.desktopPx}px`);
    expect(plan.firstScreen.vars["--band-p"]).toBe(`${COIL.intro.band.phonePx}px`);
    expect(plan.firstScreen.vars["--story-gap"]).toBe(`${COIL.intro.stagger.gapRem}rem`);
    expect(plan.about.vars["--story-gap"]).toBe(`${COIL.intro.stagger.gapRem}rem`);
    expect(plan.firstScreen.vars["--lk-greet"]).toBe("0.18000");
  });

  it("gives each section's two blocks a side and a shift, alternating", () => {
    expect(plan.firstBlocks.map((block) => block.attrs["data-side"])).toEqual(["left", "right"]);
    expect(plan.aboutBlocks.map((block) => block.attrs["data-side"])).toEqual(["left", "right"]);
    expect(plan.firstBlocks[1].vars["--shift"]).toBe(String(COIL.intro.stagger.offset));
    expect(plan.firstBlocks[0].vars["--shift"]).toBe("0");
  });

  it("follows the knobs", () => {
    const moved = introDomPlan({ ...DEFAULT_INTRO_KNOBS, topLayout: "above", phoneBlock2: "first", bandDesktopPx: 200 });
    expect(moved.firstScreen.attrs).toEqual({ "data-top-layout": "above", "data-phone-block2": "first" });
    expect(moved.about.attrs["data-phone-block2"]).toBe("first");
    expect(moved.firstScreen.vars["--band-d"]).toBe("200px");
  });
});
