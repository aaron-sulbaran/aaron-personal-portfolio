"use client";

import { useEffect } from "react";
import { RELAYOUT_EVENT } from "@/components/soundtrack/path/pathView";
import { dispatchDeal } from "@/lib/home/deal";
import { getKnobs, subscribeKnobs } from "@/lib/home/dealKnobs";
import { applyStoredDealKnobs } from "@/lib/home/dealLab";
import { introDomPlan, type DomProps } from "@/lib/home/introDom";
import { DEAL_LAB_KEY, HERO_LAB_KEY, HERO_REPLAY_KEY } from "@/lib/home/introLabKey";
import { clampIntroKnobs, getIntroKnobs, parseStoredIntroKnobs, setIntroKnobs, subscribeIntroKnobs } from "@/lib/home/introKnobs";
import { replayLoader } from "@/lib/home/introReplay";

// Dev only (HeroLabMount never loads it in production). The hero lab
// (/lab/hero) shows this page in two frames and one knob panel drives both
// through localStorage and the storage event; this is each frame's end of it:
//
//   - it applies the saved knobs when the page loads and whenever they change,
//   - writes them onto the page as the attributes and custom properties the
//     CSS reads (lib/home/introDom.ts, the same plan the server rendered with
//     the defaults), and asks the wave to lay itself out again, since a move
//     that resizes nothing it watches would leave it on the old route,
//   - and replays the loader or the deal when the lab's counters tick.

function writeDom(el: Element, { attrs, vars }: DomProps) {
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (const [name, value] of Object.entries(vars)) (el as HTMLElement).style.setProperty(name, value);
}

function applyDom() {
  const first = document.querySelector("[data-first-screen]");
  const about = document.querySelector("[data-about]");
  const deal = getKnobs();
  const plan = introDomPlan({ ...getIntroKnobs(), ribbonDesktopPx: deal.ribbonCardHeightPx, ribbonPhonePx: deal.ribbonCardHeightPhonePx });
  if (first) {
    writeDom(first, plan.firstScreen);
    first.querySelectorAll("[data-first-blocks] > [data-block]").forEach((block, i) => plan.firstBlocks[i] && writeDom(block, plan.firstBlocks[i]));
  }
  if (about) {
    writeDom(about, plan.about);
    // The phone's copy of block 2 comes first and has no stagger of its own.
    about.querySelectorAll("[data-about-blocks] > [data-block]:not(:first-child)").forEach((block, i) => plan.aboutBlocks[i] && writeDom(block, plan.aboutBlocks[i]));
  }
  requestAnimationFrame(() => window.dispatchEvent(new Event(RELAYOUT_EVENT)));
}

function applyStoredIntroKnobs() {
  try {
    const stored = parseStoredIntroKnobs(window.localStorage.getItem(HERO_LAB_KEY));
    if (stored) setIntroKnobs(clampIntroKnobs(stored, getIntroKnobs()));
  } catch {
    // Storage blocked: the defaults stand.
  }
}

type Replays = { loader?: number; deal?: number };

function readReplays(): Replays {
  try {
    return JSON.parse(window.localStorage.getItem(HERO_REPLAY_KEY) ?? "{}") as Replays;
  } catch {
    return {};
  }
}

export default function IntroLabBridge() {
  useEffect(() => {
    applyStoredIntroKnobs();
    applyStoredDealKnobs();
    applyDom();
    let seen = readReplays();
    const unsubscribe = subscribeIntroKnobs(applyDom);
    const unsubscribeDeal = subscribeKnobs(applyDom);
    const onStorage = (event: StorageEvent) => {
      if (event.key === HERO_LAB_KEY) applyStoredIntroKnobs();
      else if (event.key === DEAL_LAB_KEY) applyStoredDealKnobs();
      else if (event.key === HERO_REPLAY_KEY) {
        const now = readReplays();
        if (now.loader !== seen.loader) replayLoader();
        if (now.deal !== seen.deal) {
          window.scrollTo({ top: 0, behavior: "instant" });
          dispatchDeal({ type: "reset" });
        }
        seen = now;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      unsubscribeDeal();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
