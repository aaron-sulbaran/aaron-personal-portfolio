"use client";

import { useEffect, useMemo, useRef } from "react";
import { takeDealLock, type DealLock, type LockEnd } from "@/lib/home/dealLock";
import { scrollVelocity, type ScrollSample } from "@/lib/home/handScroll";
import { attachReaderInput, type ReaderInput } from "@/lib/home/readerInput";

// The deal's cutscene, for the deal's director (useDealDirector.ts). With the
// scene drawing, the deal is a cutscene (docs/coil-input-model.md,
// docs/superpowers/specs/2026-10-22-wheel-deal-motion.md section 4): from the
// moment it starts, by a click or by the reader's own scroll past the trigger, to
// the Coil's unfurl, the page takes the reader's wheel, touch and scroll keys
// (lib/home/dealLock.ts) and its own eased scroll brings the page to page 2's top,
// which nothing the reader does can kill or add to. On the reader's scroll it
// takes over at the page's own speed and direction (lib/home/handScroll.ts), so
// there is no stop and no start. The lock lets go after the unfurl, once the
// reader's input has been quiet for a moment (the tail of the fling that started
// it never reaches the page) or sooner when the input is the reader's own and not
// a tail dying away (a wheel kept turning, a fresh swipe, a new touch), and at the
// latest a few seconds after it took input, whatever happened. On a first visit
// it also waits for the click prompt's line to land (holdFor), never past its cap.
// It is for the reader's scroll and the click only: a page's own scroll that
// crosses the trigger (a Menu link, an anchor) plays the deal as it always did,
// and so does a deal with no scene (the still path), whose click scroll the
// reader's wheel, touch or key still takes back.
//
// This hook holds the lock (it outlives the deal's session by its tail), what the
// reader's input has been, and the page's recent scroll positions (the speed the
// hand leg starts at).
export type DealCutscene = {
  // Takes the lock for a new deal; an earlier one lets go first. onRelease: why this one let go, whenever it does.
  take: (onRelease: (why: LockEnd) => void) => DealLock;
  // The lock lets go now (a deal that ends some way other than its own end).
  drop: () => void;
  current: () => DealLock | null;
  // The page's scroll right now is the reader's own input.
  readersScroll: (now: number) => boolean;
  // How fast the page is scrolling, px/s down the page.
  scrollSpeed: (now: number) => number;
};

export function useDealCutscene(): DealCutscene {
  const lock = useRef<DealLock | null>(null);
  const reader = useRef<ReaderInput | null>(null);
  const samples = useRef<ScrollSample[]>([]);

  // The reader's own input, read (never written): whose scroll a scroll is.
  useEffect(() => {
    const { input, detach } = attachReaderInput();
    reader.current = input;
    return () => {
      detach();
      reader.current = null;
    };
  }, []);

  // The page's scroll, read (never written): how fast it goes.
  useEffect(() => {
    const onScroll = () => {
      const rows = samples.current;
      rows.push({ t: performance.now(), y: window.scrollY });
      if (rows.length > 8) rows.shift();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return useMemo<DealCutscene>(() => {
    const drop = () => {
      const held = lock.current;
      lock.current = null;
      held?.release();
    };
    return {
      take(onRelease) {
        drop();
        const taken = takeDealLock((why) => {
          if (lock.current === taken) lock.current = null;
          onRelease(why);
        });
        lock.current = taken;
        return taken;
      },
      drop,
      current: () => lock.current,
      readersScroll: (now) => reader.current?.driving(now) ?? false,
      scrollSpeed: (now) => scrollVelocity(samples.current, now),
    };
  }, []);
}
