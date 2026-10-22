"use client";

import { clickPlan, dispatchDeal, getDeal } from "@/lib/home/deal";
import { scrollToCards } from "@/lib/home/dealScroll";

// What page 1 calls to deal: a click on its "Deal me in". The plan comes from
// the state (lib/home/deal.ts clickPlan, tested). With the scene ready the
// director's starter plays the deal's one clock at once, scroll included. If it
// cannot yet, the click path holds the entrance back while it runs: it awaits
// the "before the deal scrolls" hook, scrolls to the cards (never taking the
// reader's own scroll back), and the entrance plays on the arrival, which is
// when the hold lifts. Already dealt, it only scrolls back to the cards, with
// no replay; under reduced motion it deals at once and jumps.

// The deal's own starter: the director (components/home/useDealDirector.ts)
// registers it, and it plays the one clock (the wheel's spin, the page's own
// scroll, the flatten and all) when the scene is ready. It returns false when
// it cannot yet (the scene is still on its way): the click then falls back to
// scrolling, and the arrival deals.
export type DealStarter = () => boolean;
let dealStarter: DealStarter | null = null;

export function setDealStarter(starter: DealStarter | null): () => void {
  dealStarter = starter;
  return () => {
    if (dealStarter === starter) dealStarter = null;
  };
}

// The seam for what page 1 does before the page scrolls on the fallback path.
// The deal waits for it, and its hold keeps the entrance from starting
// meanwhile. A no-op today.
export type BeforeDealScroll = () => Promise<void>;

const noop: BeforeDealScroll = () => Promise.resolve();
let beforeDealScroll: BeforeDealScroll = noop;

// Registers the hook (null clears it); returns the cleanup.
export function setBeforeDealScroll(hook: BeforeDealScroll | null): () => void {
  const next = hook ?? noop;
  beforeDealScroll = next;
  return () => {
    if (beforeDealScroll === next) beforeDealScroll = noop;
  };
}

// Resolves when the click's scroll has arrived (or was interrupted by the reader).
export async function startClickDeal(reducedMotion: boolean): Promise<void> {
  const plan = clickPlan(getDeal(), reducedMotion);
  switch (plan) {
    case "none":
      return;
    case "back":
      scrollToCards(reducedMotion);
      return;
    case "jump":
      dispatchDeal({ type: "skip" });
      scrollToCards(true);
      return;
    default: {
      if (dealStarter?.()) return;
      dispatchDeal({ type: "hold", on: true });
      try {
        await beforeDealScroll();
      } catch {
        // A hook that fails must not keep the cards from dealing.
      }
      await new Promise<void>((resolve) => {
        scrollToCards(false, () => {
          dispatchDeal({ type: "hold", on: false });
          resolve();
        });
      });
    }
  }
}
