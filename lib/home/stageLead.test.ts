import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { ctaStickPx, stageLeadPx, stageReachAbove } from "@/lib/home/stageLead";

describe("the stage's reach up page 1", () => {
  it("reaches above the slot far enough for the wheel's ring on a desktop stage", () => {
    const reach = stageReachAbove(800, 1280);
    const radius = 0.5 * 800 * COIL.deal.wheel.diameterOfHeight * COIL.deal.wheel.scale;
    expect(reach).toBeGreaterThan(radius);
    expect(reach).toBeLessThan(radius * 1.4);
  });

  it("on page 2's phone band, reaches as far as on the band the wheel was tuned on", () => {
    const band = (844 * COIL.phone.bandSvh) / 100;
    const tuned = (844 * COIL.phone.wheelBandSvh) / 100;
    expect(stageReachAbove(band, 390, COIL, true)).toBeCloseTo(stageReachAbove(tuned, 390), 9);
    expect(stageLeadPx({ sectionTop: 1000, slotCenter: 800, frameHeight: band, canvasWidth: 390, phone: true })).toBeCloseTo(200 + stageReachAbove(tuned, 390), 9);
  });

  it("never reaches less than the ribbon's own card needs, however small the stage", () => {
    expect(stageReachAbove(120, 1280)).toBeGreaterThanOrEqual(COIL.deal.ribbon.cardHeightPx / 2);
    expect(stageReachAbove(120, 390)).toBeGreaterThanOrEqual(COIL.deal.ribbon.cardHeightPhonePx / 2);
  });

  it("makes the lead the distance from the stage's top to the cards section's top", () => {
    const facts = { sectionTop: 1000, slotCenter: 800, frameHeight: 800, canvasWidth: 1280 };
    expect(stageLeadPx(facts)).toBeCloseTo(200 + stageReachAbove(800, 1280), 6);
  });

  it("has no lead when the slot is far below the section's top", () => {
    expect(stageLeadPx({ sectionTop: 100, slotCenter: 5000, frameHeight: 800, canvasWidth: 1280 })).toBe(0);
  });

  it("follows the slot: lower on the page, a shorter lead", () => {
    const base = { sectionTop: 1000, frameHeight: 800, canvasWidth: 1280 };
    expect(stageLeadPx({ ...base, slotCenter: 850 })).toBeLessThan(stageLeadPx({ ...base, slotCenter: 750 }));
  });
});

describe("where the button sticks with the ribbon", () => {
  it("is the ribbon's middle, half a slot and the foot's gap down the screen: where the button is as the stage sticks", () => {
    const facts = { frameHeight: 800, canvasWidth: 1280, slotHeight: 170, gapPx: 40 };
    expect(ctaStickPx(facts)).toBeCloseTo(stageReachAbove(800, 1280) + 85 + 40, 9);
  });

  it("follows the foot's gap and the slot's height (the page owns them), and a phone's smaller card", () => {
    const base = { frameHeight: 844, canvasWidth: 390, slotHeight: 120, gapPx: 32 };
    expect(ctaStickPx({ ...base, gapPx: 40 }) - ctaStickPx(base)).toBeCloseTo(8, 9);
    expect(ctaStickPx({ ...base, slotHeight: 140 }) - ctaStickPx(base)).toBeCloseTo(10, 9);
  });

  it("agrees with the stage's lead: the button's block is at the stuck ribbon's foot, and the section is the lead below the stage's top", () => {
    const facts = { sectionTop: 1000, slotCenter: 800, frameHeight: 800, canvasWidth: 1280 };
    const stuckTop = 800 - stageReachAbove(800, 1280); // the stage's top, where it sticks, in the page
    expect(stageLeadPx(facts)).toBeCloseTo(1000 - stuckTop, 9);
    expect(ctaStickPx({ frameHeight: 800, canvasWidth: 1280, slotHeight: 170, gapPx: 40 })).toBeCloseTo(800 + 85 + 40 - stuckTop, 9);
  });
});
