import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { introDomPlan, nameSizeCss } from "@/lib/home/introDom";

describe("page 1's layout as DOM", () => {
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS);

  it("carries the lockup's proportions, the name's two sizes, the wave's two heights, the ribbon's two heights and the gap between blocks", () => {
    expect(plan.page.vars["--lk-d"]).toBe(nameSizeCss(COIL.intro.name.vwDesktop));
    expect(plan.page.vars["--lk-p"]).toBe(nameSizeCss(COIL.intro.name.vwPhone));
    expect(plan.page.vars["--band-d"]).toBe(`${COIL.intro.band.desktopPx}px`);
    expect(plan.page.vars["--band-p"]).toBe(`${COIL.intro.band.phonePx}px`);
    expect(plan.page.vars["--ribbon-d"]).toBe(`${COIL.deal.ribbon.cardHeightPx}px`);
    expect(plan.page.vars["--ribbon-p"]).toBe(`${COIL.deal.ribbon.cardHeightPhonePx}px`);
    expect(plan.page.vars["--story-gap"]).toBe(`${COIL.intro.stagger.gapRem}rem`);
    expect(plan.page.vars["--lk-greet"]).toBe("0.18000");
  });

  it("gives the name's canvas its reach past the lockup", () => {
    expect(plan.page.vars["--name-reach"]).toBe(String(COIL.intro.nameCanvas.reach));
  });

  it("follows the knobs", () => {
    const moved = introDomPlan({ ...DEFAULT_INTRO_KNOBS, bandDesktopPx: 200, ribbonDesktopPx: 220 });
    expect(moved.page.vars["--band-d"]).toBe("200px");
    expect(moved.page.vars["--ribbon-d"]).toBe("220px");
  });
});
