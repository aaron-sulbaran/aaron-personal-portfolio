"use client";

import { clickPlan, dispatchDeal, getDeal } from "@/lib/home/deal";
import { scrollToCards } from "@/lib/home/dealScroll";

// What page 1 calls to deal: a click on its "Deal me in" (the placeholder
// button today). The plan comes from the state (lib/home/deal.ts clickPlan,
// tested). The click path holds the entrance back while it runs: it awaits the
// "before the deal scrolls" hook, scrolls to the cards (never taking the
// reader's own scroll back), and the entrance plays on the arrival, which is
// when the hold lifts. Already dealt, it only scrolls back to the cards, with
// no replay; under reduced motion it deals at once and jumps.

// The seam for what page 1 does before the page scrolls (the carousel's fast
// spin plugs in here). The deal waits for it, and its hold keeps the entrance
// from starting meanwhile. A no-op today.
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
  // The riffle is not part of this page (the deck is being replaced), so the
  // plan is asked with it off: a click scrolls.
  const plan = clickPlan(getDeal(), reducedMotion, false);
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
