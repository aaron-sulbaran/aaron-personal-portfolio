"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { CoilEntrance } from "@/components/coil/CoilScene";
import { COIL } from "@/lib/coil/constants";
import type { HeroScene } from "@/lib/coil/heroStill";
import { claimDealMirror, dealTrigger, dispatchDeal, getDeal, subscribeDeal, type DealSource } from "@/lib/home/deal";
import { setDealStarter } from "@/lib/home/dealFlow";
import { entranceTuningOf, getKnobs } from "@/lib/home/dealKnobs";
import { takeDealLock, type DealLock } from "@/lib/home/dealLock";
import { createDealMaster, type DealMaster } from "@/lib/home/dealMaster";
import { scrollVelocity, type ScrollSample } from "@/lib/home/handScroll";
import { attachReaderInput, type ReaderInput } from "@/lib/home/readerInput";
import { finishIntroArrival } from "@/lib/home/introArrivalEnd";
import { clearOpen, openParts, prepareOpen, type OpenParts } from "@/lib/home/dealOpen";
import { stageGone, stickyProgress } from "@/lib/home/stickyRange";

// The deal's director: it watches where the reader is on page 1's foot and the
// cards section, opens the section at once when a load or a jump finds it in
// view, starts the deal when the reader's scroll asks for it
// (lib/home/deal.ts dealTrigger, pure and tested) or when "Deal me in" is
// clicked (lib/home/dealFlow.ts calls the starter registered here), and
// plays it as one master timeline (lib/home/dealMaster.ts): the Coil's own
// clock, the teaser's text, the page's scroll and the columns. It says when the
// deal is over.
//
// With the scene drawing, the deal is a cutscene (docs/coil-input-model.md,
// docs/superpowers/specs/2026-10-22-wheel-deal-motion.md section 4): from the
// moment it starts, by a click or by the reader's own scroll past the trigger, to
// the Coil's unfurl, the page takes the reader's wheel, touch and scroll keys
// (lib/home/dealLock.ts) and its own eased scroll brings the page to page 2's top,
// which nothing the reader does can kill or add to. On the reader's scroll it
// takes over at the page's own speed and direction (lib/home/handScroll.ts), so
// there is no stop and no start. The lock lets go after the unfurl, once the
// reader's input has been quiet for a moment (the tail of the fling that started
// it never reaches the page), and at the latest a few seconds after it took
// input, whatever happened. It is for the reader's scroll and the click only: a
// page's own scroll that crosses the trigger (a Menu link, an anchor) plays the
// deal as it always did, and so does a deal with no scene (the still path), whose
// click scroll the reader's wheel, touch or key still takes back.

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
  // The cutscene's lock (it outlives the session by its tail), what the reader's input
  // has been, and the page's recent scroll positions (the speed the hand leg starts at).
  const lockRef = useRef<DealLock | null>(null);
  const readerRef = useRef<ReaderInput | null>(null);
  const samples = useRef<ScrollSample[]>([]);

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

  // The cutscene's lock lets go now (a deal that ends some way other than its own end).
  const dropLock = useCallback(() => {
    const lock = lockRef.current;
    lockRef.current = null;
    lock?.release();
  }, []);

  // The deal is over: the Coil's clock has run out (or there is no scene) and
  // the columns are in. Interactivity (opening a card, the wheel) starts here.
  const maybeFinish = useCallback(() => {
    const current = session.current;
    if (!current || !current.domDone || (current.needsScene && !current.sceneDone)) return;
    endSession();
    // The deal ran its course: the lock keeps the reader's input out only until it has been quiet.
    lockRef.current?.unfurled();
    dispatchDeal({ type: "finish" });
  }, [endSession]);

  // Everything at once, whatever is running: a title chosen before the deal is
  // over, the stage leaving the screen mid-deal, reduced motion coming on, the
  // safety net. The master goes to its end (the scroll child stopped where it
  // is) and the Coil to rest.
  const settle = useCallback(() => {
    const current = session.current;
    endSession();
    dropLock();
    current?.master?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "skip" });
  }, [dropLock, endSession, setEntrance]);

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
      // Page 1's words are all there before the page starts to move.
      finishIntroArrival();
      // No scene will draw (the still path): the stage cross-fades. Otherwise
      // the Coil's own clock runs the deal, a scene still on its way included
      // (it starts at its first frame).
      const mode = sceneState === "still" ? "fade" : "scene";
      // The cutscene: with the scene drawing, a click or the reader's own scroll (not
      // a page's own, which plays the deal as it always did) holds the reader's input
      // until the Coil is unfurled. Taken before anything else of the deal runs.
      const now = performance.now();
      const cutscene = mode === "scene" && (source === "click" || (source === "scroll" && (readerRef.current?.driving(now) ?? false)));
      const velocity = cutscene && source === "scroll" ? scrollVelocity(samples.current, now) : 0;
      if (cutscene) {
        dropLock();
        const lock = takeDealLock((why) => {
          if (lockRef.current === lock) lockRef.current = null;
          // A lock that let go early (the cap, a hidden tab) leaves the page to the reader: the deal's scroll stops where it is.
          if (why === "cap" || why === "hidden") session.current?.master?.stopScroll();
        });
        lockRef.current = lock;
      }
      const parts = openParts(section);
      prepareOpen(parts, mode);
      const next: Session = { master: null, parts, needsScene: mode === "scene", sceneDone: false, domDone: false, stageSeen: false, safety: 0 };
      session.current = next;
      const master = createDealMaster({
        parts,
        mode,
        knobs,
        scroll: source === "click" ? { kind: "click", holds: cutscene } : cutscene ? { kind: "hand", velocity } : null,
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
    [dropLock, maybeFinish, sectionRef, setEntrance, settle],
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

  // The reader's own input, read (never written): whose scroll a scroll is.
  useEffect(() => {
    const { input, detach } = attachReaderInput();
    readerRef.current = input;
    return () => {
      detach();
      readerRef.current = null;
    };
  }, []);

  // The page's scroll, read (never written here): which way it goes and how fast.
  useEffect(() => {
    direction.current.y = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const rows = samples.current;
      rows.push({ t: performance.now(), y });
      if (rows.length > 8) rows.shift();
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
      // The Coil is unfurled: the lock's quiet gap starts (it lets go once the reader's input has been quiet).
      if (state.unfurled || state.phase === "dealt") lockRef.current?.unfurled();
      if (state.phase === "dealt" && session.current) {
        // Skipped from outside while dealing: put everything in its end state.
        const current = session.current;
        endSession();
        dropLock();
        current.master?.finish();
        setEntrance(AT_REST);
      } else if (state.phase === "dealt" && state.entrances === 0) {
        setEntrance(AT_REST);
      } else if (state.phase === "idle") {
        // The lab's replay: closed again, the wheel turns, a new entrance waits.
        const current = session.current;
        endSession();
        dropLock();
        current?.master?.kill();
        const section = sectionRef.current;
        if (section) clearOpen(openParts(section));
        setEntrance(null);
      }
      evaluateRef.current();
    });
  }, [dropLock, endSession, sectionRef, setEntrance]);

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
    dropLock();
    current?.master?.finish();
    setEntrance(AT_REST);
    dispatchDeal({ type: "reduced" });
  }, [reducedMotion, dropLock, endSession, setEntrance]);

  useEffect(
    () => () => {
      const current = session.current;
      endSession();
      dropLock();
      current?.master?.kill();
      if (sceneWait.current) window.clearTimeout(sceneWait.current.timer);
    },
    [dropLock, endSession],
  );

  return { completeScene, settle };
}
