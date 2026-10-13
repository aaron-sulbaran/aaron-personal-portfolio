"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useHomeController } from "@/components/home/HomeController";
import { HOLDING_MODE } from "@/lib/holding";
import { INVITE_MODE_KEY, INVITE_TIMING, inviteEligible, inviteMayShow, inviteModeFor, invitePieces, readAnswered, writeAnswer, type InviteAnswer, type InviteMode } from "@/lib/quick/invite";
import { getInviteLine, setInviteLine, subscribeInviteLine } from "@/lib/quick/inviteLine";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo, useTransitionState } from "@/lib/quick/transitionStore";
import { InvitePill } from "./InvitePill";
import { InviteToast } from "./InviteToast";

// The first-visit invite to the Express lane, on the home only (a child of
// the HomeController, so it reads the hero's readiness, its entrance, the
// modal and the flight). It arms once the hero is ready and the entrance has
// rested, waits INVITE_TIMING.delayMs, then shows the mode's pieces while the
// hero is in view: never during the loader or the entrance, under a modal,
// the flight or a transition, on a deep landing, or under the holding page,
// and never again once used or dismissed. Mode B hands its line to the hero's
// line slot (lib/quick/inviteLine) and counts as answered once it has played;
// with no scene drawing it falls back to the pill. The lab's mode is read in
// development only.

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Visit = { mode: InviteMode; answered: boolean; hero: HTMLElement | null };

let visit: Visit | null = null;
function readVisit(): Visit {
  const hero = document.querySelector<HTMLElement>("section[data-scene]");
  if (visit && visit.hero === hero) return visit;
  let override: string | null = null;
  try {
    override = storage()?.getItem(INVITE_MODE_KEY) ?? null;
  } catch {
    override = null;
  }
  visit = { mode: inviteModeFor({ development: process.env.NODE_ENV === "development", override }), answered: readAnswered(storage()), hero };
  return visit;
}
const noSubscribe = () => () => {};

export function ExpressInvite() {
  const controller = useHomeController();
  const transition = useTransitionState();
  const page = useSyncExternalStore(noSubscribe, readVisit, () => null);
  const [answeredNow, setAnsweredNow] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const [due, setDue] = useState(false);
  const [lineFallback, setLineFallback] = useState(false);
  const mode = page?.mode ?? "both";
  const pieces = invitePieces(mode);

  useEffect(() => {
    const sentinel = document.querySelector("[data-hero-sentinel]");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const gate = {
    holding: HOLDING_MODE,
    phase: controller?.phase ?? "pre",
    rested: (controller?.entrance ?? null) !== null,
    deep: controller?.deep ?? true,
    modalOpen: controller?.modalOpen ?? false,
    flying: (controller?.flight ?? null) !== null,
    transitioning: transition.phase !== "idle",
    answered: answeredNow || (page?.answered ?? true),
  };
  const live = page !== null && controller !== null;
  const eligible = live && inviteEligible(gate);
  const mayShow = live && inviteMayShow(gate);

  const answer = (choice: InviteAnswer) => {
    writeAnswer(storage(), choice);
    setAnsweredNow(true);
    if (choice === "used") goTo(EXPRESS_PATH);
  };

  useEffect(() => {
    if (!eligible || !pieces.line) return;
    setInviteLine("pending");
    const unsubscribe = subscribeInviteLine(() => {
      const line = getInviteLine();
      if (line === "chosen") answer("used");
      else if (line === "done") answer("dismissed");
    });
    return () => {
      unsubscribe();
      setInviteLine("off");
    };
  }, [eligible, pieces.line]);

  // The hold after the entrance rests, once per visit; mode B decides then
  // whether the hero's slot can carry its line.
  useEffect(() => {
    if (!mayShow || due) return;
    const timer = window.setTimeout(() => {
      setDue(true);
      if (!pieces.line) return;
      if (page?.hero?.dataset.scene === "on" && heroInView) setInviteLine("showing");
      else setLineFallback(true);
    }, INVITE_TIMING.delayMs);
    return () => window.clearTimeout(timer);
  }, [mayShow, due, pieces.line, page, heroInView]);

  const shown = due && mayShow && heroInView;
  const pill = shown && (pieces.pill || lineFallback);
  const toast = shown && pieces.toast;

  return (
    <>
      {page?.hero && createPortal(<InvitePill shown={pill} onGo={() => answer("used")} onDismiss={() => answer("dismissed")} />, page.hero)}
      <InviteToast shown={toast} raised={pill} onGo={() => answer("used")} onDismiss={() => answer("dismissed")} />
    </>
  );
}
