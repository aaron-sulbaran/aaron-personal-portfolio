"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { CoilEntrance } from "@/components/coil/CoilScene";
import { COIL } from "@/lib/coil/constants";
import type { HeroScene } from "@/lib/coil/heroStill";
import { claimDealMirror, dealTrigger, dispatchDeal, getDeal, subscribeDeal, type DealSource } from "@/lib/home/deal";
import { setDealStarter } from "@/lib/home/dealFlow";
import { entranceTuningOf, getKnobs } from "@/lib/home/dealKnobs";
import { createDealMaster, type DealMaster } from "@/lib/home/dealMaster";
import { clearOpen, openParts, prepareOpen, type OpenParts } from "@/lib/home/dealOpen";
import { stageGone, stickyProgress } from "@/lib/home/stickyRange";

// The deal's director: it watches where the reader is on page 1's foot and the
// cards section, opens the section at once when a load or a jump finds it in
// view, starts the deal when the reader's scroll asks for it
// (lib/home/deal.ts dealTrigger, pure and tested) or when "Deal me in" is
// clicked (lib/home/dealFlow.ts calls the starter registered here), and
// plays it as one master timeline (lib/home/dealMaster.ts): the Coil's own
// clock, the teaser's text, the page's scroll (a click only) and the columns.
// It says when the deal is over.
//
// The reader's own scroll is never taken: by hand it only reads it, and on a
// click the page's scroll is a child of the master that the reader's wheel,
// touch or key kills alone.

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// No entrance: the coil is at rest from its first frame.
export const AT_REST: CoilEntrance = { startMs: Number.NEGATIVE_INFINITY, nameFromLoader: false };

type Session = {
  master: DealMaster | null;
  parts: OpenParts;
  needsScene: boolean;
  sceneDone: boolean;
  domDone: boolean;
  // The stage has been on the screen since the deal began: a stage that is not
  // there yet (the still path's, in the section below the first screen, which
  // the deal's own scroll is bringing up) has not left it.
  stageSeen: boolean;
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
  const beginRef = useRef<(source: DealSource) => boolean>(() => false);

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
  // over, the stage leaving the screen mid-deal, reduced motion coming on, the
  // safety net. The master goes to its end (the scroll child stopped where it
  // is) and the Coil to rest.
  const settle = useCallback(() => {
    const current = session.current;
    endSession();
    current?.master?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "skip" });
  }, [endSession, setEntrance]);

  // Starts the deal; false when it cannot yet (the scene is on its way, so the
  // cards section stays closed meanwhile).
  const begin = useCallback(
    (source: DealSource): boolean => {
      const state = getDeal();
      if (state.phase === "dealt") {
        dispatchDeal({ type: "enter", source: "view" });
        return true;
      }
      const section = sectionRef.current;
      if (!section || session.current) return false;
      // The reader did not scroll the deal in: a load, an anchor jump or a way
      // back up found the cards section in view. It opens at once, dealt, the
      // field open, no deal and no wait for a scene still on its way (the poster
      // carries the field until it draws), so no one reads a blank section.
      if (source === "view") {
        settle();
        return true;
      }
      const sceneState = live.current.scene;
      // The scene is on its way: the cards wait for its first frame, a few
      // seconds at most.
      if (sceneState === "off" && !sceneWait.current?.over) {
        if (!sceneWait.current) {
          const wait = { timer: 0, over: false };
          wait.timer = window.setTimeout(() => {
            wait.over = true;
            evaluateRef.current();
          }, COIL.deal.trigger.waitSceneMs);
          sceneWait.current = wait;
        }
        return false;
      }
      const knobs = getKnobs();
      // No scene will draw (the still path): the stage cross-fades. Otherwise
      // the Coil's own clock runs the deal, a scene still on its way included
      // (it starts at its first frame).
      const mode = sceneState === "still" ? "fade" : "scene";
      const parts = openParts(section);
      prepareOpen(parts, mode);
      const next: Session = { master: null, parts, needsScene: mode === "scene", sceneDone: false, domDone: false, stageSeen: false, safety: 0 };
      session.current = next;
      const master = createDealMaster({
        parts,
        mode,
        knobs,
        scroll: source === "click",
        onDone: () => {
          next.domDone = true;
          maybeFinish();
        },
      });
      next.master = master;
      next.safety = window.setTimeout(settle, master.totalMs + 4000);
      if (mode === "scene") setEntrance({ startMs: performance.now(), nameFromLoader: false, tuning: entranceTuningOf(knobs), clockMs: master.clockMs });
      dispatchDeal({ type: "enter", source });
      master.play();
      // Where the stage stands as the deal begins (the reader may jump away before a scroll event reads it).
      evaluateRef.current();
      return true;
    },
    [maybeFinish, sectionRef, setEntrance, settle],
  );
  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  // "Deal me in" plays the deal at once, scroll included, when it can.
  useEffect(() => setDealStarter(() => beginRef.current("click")), []);

  const evaluate = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const box = section.getBoundingClientRect();
    const rail = section.querySelector<HTMLElement>("[data-coil-rail]")?.getBoundingClientRect();
    const stage = section.querySelector<HTMLElement>("[data-coil-sticky]")?.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const progress = stickyProgress({
      railTop: rail?.top ?? box.top,
      range: rail && stage ? rail.height - stage.height : 0,
      sectionTop: box.top,
      viewportHeight,
    });
    const trigger = dealTrigger(
      { stickyProgress: progress, sectionTop: box.top, sectionBottom: box.bottom, viewportHeight, scrollingDown: direction.current.down },
      getDeal(),
    );
    if (trigger === "enter") beginRef.current(direction.current.down ? "scroll" : "view");
    // A deal under way whose stage has left the screen finishes now, so a
    // scene that stopped drawing is never left mid-deal.
    else if (session.current && stage) {
      if (!stageGone(stage.top, stage.bottom, viewportHeight)) session.current.stageSeen = true;
      else if (session.current.stageSeen) settle();
    }
  }, [sectionRef, settle]);
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

  // The deal's own changes: a scene that is ready at last, a skip or a reset
  // from outside.
  useEffect(() => {
    return subscribeDeal(() => {
      const state = getDeal();
      if (state.phase === "dealt" && session.current) {
        // Skipped from outside while dealing: put everything in its end state.
        const current = session.current;
        endSession();
        current.master?.finish();
        setEntrance(AT_REST);
      } else if (state.phase === "dealt" && state.entrances === 0) {
        setEntrance(AT_REST);
      } else if (state.phase === "idle") {
        // The lab's replay: closed again, the wheel turns, a new entrance waits.
        const current = session.current;
        endSession();
        current?.master?.kill();
        const section = sectionRef.current;
        if (section) clearOpen(openParts(section));
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
    current?.master?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "reduced" });
  }, [reducedMotion, endSession, setEntrance]);

  useEffect(
    () => () => {
      const current = session.current;
      endSession();
      current?.master?.kill();
      if (sceneWait.current) window.clearTimeout(sceneWait.current.timer);
    },
    [endSession],
  );

  return { completeScene, settle };
}
