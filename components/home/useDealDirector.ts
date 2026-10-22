"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { CoilEntrance } from "@/components/coil/CoilScene";
import { COIL } from "@/lib/coil/constants";
import type { HeroScene } from "@/lib/coil/heroStill";
import { claimDealMirror, dealTrigger, dispatchDeal, getDeal, subscribeDeal } from "@/lib/home/deal";
import { entranceTuningOf, getKnobs } from "@/lib/home/dealKnobs";
import { openParts, playOpen, prepareOpen, type OpenHandle } from "@/lib/home/dealOpen";

// The deal's director: it watches where the cards section is in the viewport,
// starts the entrance when the reader's scroll asks for it
// (lib/home/deal.ts dealTrigger, pure and tested), runs the DOM half of the
// entrance (lib/home/dealOpen.ts) next to the Coil's own timeline, and says
// when the deal is over. The click path (lib/home/dealFlow.ts) only holds the
// entrance back until its scroll has arrived; this takes it from there.
//
// Vertical scroll is never hijacked: the director only reads it.

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// No entrance: the coil is at rest from its first frame.
export const AT_REST: CoilEntrance = { startMs: Number.NEGATIVE_INFINITY, nameFromLoader: false };

type Session = {
  open: OpenHandle | null;
  needsScene: boolean;
  sceneDone: boolean;
  domDone: boolean;
  safety: number;
};

type Args = {
  sectionRef: RefObject<HTMLElement | null>;
  scene: HeroScene;
  reducedMotion: boolean;
  setEntrance: (entrance: CoilEntrance | null) => void;
};

export function useDealDirector({ sectionRef, scene, reducedMotion, setEntrance }: Args) {
  const live = useRef({ scene, reducedMotion });
  const session = useRef<Session | null>(null);
  const direction = useRef({ y: 0, down: false });
  const sceneWait = useRef<{ timer: number; over: boolean } | null>(null);
  const evaluateRef = useRef<() => void>(() => {});

  useEffect(() => {
    live.current = { scene, reducedMotion };
  }, [scene, reducedMotion]);

  // Before the first paint the home's own state takes over <html data-deal>
  // from the head script's "pending", and a deal that is already done (reduced
  // motion, or a return to the home by client navigation) puts the Coil at rest.
  useIsoLayoutEffect(() => {
    const release = claimDealMirror();
    if (getDeal().phase === "dealt") setEntrance(AT_REST);
    return release;
  }, [setEntrance]);

  const endSession = useCallback(() => {
    const current = session.current;
    if (!current) return;
    window.clearTimeout(current.safety);
    session.current = null;
  }, []);

  // The deal is over: the Coil's clock has run out (or there is no scene) and
  // the columns are in. Interactivity (opening a card, the wheel) starts here.
  const maybeFinish = useCallback(() => {
    const current = session.current;
    if (!current || !current.domDone || (current.needsScene && !current.sceneDone)) return;
    endSession();
    dispatchDeal({ type: "finish" });
  }, [endSession]);

  // Everything at once, whatever is running: a title chosen before the deal is
  // over, reduced motion coming on, the safety net.
  const settle = useCallback(() => {
    const current = session.current;
    endSession();
    current?.open?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "skip" });
  }, [endSession, setEntrance]);

  const begin = useCallback(() => {
    const state = getDeal();
    if (state.phase === "dealt") {
      dispatchDeal({ type: "enter", source: "view" });
      return;
    }
    const section = sectionRef.current;
    if (!section || session.current) return;
    const sceneState = live.current.scene;
    // The scene is on its way: the cards wait for its first frame, a few
    // seconds at most (the section stays closed meanwhile).
    if (sceneState === "off" && !sceneWait.current?.over) {
      if (!sceneWait.current) {
        const wait = { timer: 0, over: false };
        wait.timer = window.setTimeout(() => {
          wait.over = true;
          evaluateRef.current();
        }, COIL.deal.trigger.waitSceneMs);
        sceneWait.current = wait;
      }
      return;
    }
    const knobs = getKnobs();
    // No scene will draw (the still path): the stage cross-fades. Otherwise it
    // opens as a circle around the Coil, a scene still on its way included (it
    // starts its entrance at its first frame).
    const mode = sceneState === "still" ? "fade" : "radial";
    const parts = openParts(section);
    prepareOpen(parts, mode);
    const next: Session = { open: null, needsScene: mode === "radial", sceneDone: false, domDone: false, safety: 0 };
    session.current = next;
    next.safety = window.setTimeout(settle, knobs.dealMs + knobs.columnsDelayMs + 4000);
    if (mode === "radial") setEntrance({ startMs: performance.now(), nameFromLoader: false, tuning: entranceTuningOf(knobs) });
    dispatchDeal({ type: "enter", source: "view" });
    next.open = playOpen(parts, mode, knobs, () => {
      next.domDone = true;
      maybeFinish();
    });
  }, [maybeFinish, sectionRef, setEntrance, settle]);

  const evaluate = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const box = section.getBoundingClientRect();
    const trigger = dealTrigger(
      { sectionTop: box.top, sectionBottom: box.bottom, viewportHeight: window.innerHeight, scrollingDown: direction.current.down },
      getDeal(),
      // The riffle is not part of this page (the deck is being replaced).
      false,
    );
    if (trigger === "enter") begin();
  }, [begin, sectionRef]);
  useEffect(() => {
    evaluateRef.current = evaluate;
  }, [evaluate]);

  // The Coil's clock ran out (CoilStage's onEntranceEnd).
  const completeScene = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.sceneDone = true;
    maybeFinish();
  }, [maybeFinish]);

  // The reader's scroll, read (never written).
  useEffect(() => {
    direction.current.y = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== direction.current.y) direction.current = { y, down: y > direction.current.y };
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          evaluateRef.current();
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    void document.fonts?.ready.then(() => evaluateRef.current());
    evaluateRef.current();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The deal's own changes: a hold lifting (the click path arrived), a scene
  // that is ready at last, a skip or a reset from outside.
  useEffect(() => {
    return subscribeDeal(() => {
      const state = getDeal();
      if (state.phase === "dealt" && session.current) {
        // Skipped from outside while dealing: put everything in its end state.
        const current = session.current;
        endSession();
        current.open?.finish();
        setEntrance(AT_REST);
      } else if (state.phase === "dealt" && state.entrances === 0) {
        setEntrance(AT_REST);
      } else if (state.phase === "idle") {
        // The lab's replay: closed again, the Coil's clock waits for a new entrance.
        const current = session.current;
        endSession();
        current?.open?.kill();
        const section = sectionRef.current;
        if (section) prepareClosed(section);
        setEntrance(null);
      }
      evaluateRef.current();
    });
  }, [endSession, sectionRef, setEntrance]);

  useEffect(() => {
    evaluateRef.current();
  }, [scene]);

  // Still path or a dead scene mid-deal: nothing will report the Coil's end.
  useEffect(() => {
    const current = session.current;
    if (current?.needsScene && scene === "still") {
      current.sceneDone = true;
      maybeFinish();
    }
  }, [scene, maybeFinish]);

  // Reduced motion, live: dealt at once, whatever was running.
  useEffect(() => {
    if (!reducedMotion) return;
    const current = session.current;
    endSession();
    current?.open?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "reduced" });
  }, [reducedMotion, endSession, setEntrance]);

  useEffect(
    () => () => {
      const current = session.current;
      endSession();
      current?.open?.kill();
      if (sceneWait.current) window.clearTimeout(sceneWait.current.timer);
    },
    [endSession],
  );

  return { completeScene, settle };
}

// A replay hides the section's parts the way the closed state does, by clearing
// whatever inline style the last run left (the CSS of data-deal="closed" holds
// them back from there).
function prepareClosed(section: HTMLElement) {
  const parts = openParts(section);
  parts.stage?.style.removeProperty("clip-path");
  parts.stage?.style.removeProperty("opacity");
  [...parts.labels, ...parts.titles].forEach((el) => {
    el.style.removeProperty("opacity");
    el.style.removeProperty("transform");
  });
}
