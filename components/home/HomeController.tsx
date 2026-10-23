"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { useBodyScrollLock } from "@/lib/modal";
import { claimHomeReadiness, publishHomeReadiness, useHomeReadiness, type HomeReadiness } from "@/lib/home/readiness";
import { markSeen } from "@/lib/home/seen";
import { isQuietArrival } from "@/lib/home/arrival";
import {
  applyRestore,
  persistScrollPosition,
  readRecovery,
  relandAfterFonts,
  takeManualScrollRestoration,
} from "@/lib/home/recovery";
import { COIL } from "@/lib/coil/constants";
import { coilIsTheirs, dispatchDeal, getDeal, subscribeDeal, useDeal } from "@/lib/home/deal";
import { createHoverArm, disarmHover, moveHover } from "@/lib/home/hoverArm";
import { useDealDirector } from "./useDealDirector";
import { StageRail } from "./StageRail";
import { QUERIES, useCapabilities } from "./useCapabilities";
import type { Drivers } from "@/lib/coil/drivers";
import { CardModal } from "@/components/card/CardModal";
import type { CoilEntrance } from "@/components/coil/CoilScene";
import type { HeroScene } from "@/lib/coil/heroStill";
import type { CoilCardRef, CoilSceneApi } from "@/components/coil/CoilScene";
import { FlyingTile } from "@/components/FlyingTile";
import { Portal } from "@/components/Portal";

// The Coil's renderer-neutral home controller, and the cards section it
// renders (#work): the Coil between two columns of titles. It owns everything
// about the section that is not drawing: readiness, the entrance scroll lock,
// which modal is open, seen marking, focus restoration, deep-reload recovery,
// the flight's state, driver selection, and live reduced motion. The scene and
// the columns talk to it through useHomeController().
//
// The deal (lib/home/deal.ts, useDealDirector) is what this section waits for:
// closed until the cards are dealt, the Coil's entrance playing on the click or
// when the reader scrolls into the stage's range (its clock is handed to the
// scene as a new `entrance`), and nothing opens (a card, the wheel, a hover)
// until it is over, apart from the Coil itself, which takes the wheel and the
// pointer the moment it is unfurled. The Coil's canvas is a sticky stage that
// starts at page 1's foot (the rail below). The deal never locks the scroll: on a click its own
// scroll is one the reader's wheel, touch or key takes back.
//
// Nothing here renders per frame: the scene reads what it needs once per
// change, and the per-frame state lives in the scene's own loop.

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type OpenOrigin = HTMLElement | null;

// After the Coil's glide to a tapped title lands, a beat before the card flies.
const TURN_SETTLE_MS = 60;

type Selection = { key: CardKey; origin: OpenOrigin };

// The shared-element flight from a curved card into its modal: which card
// flies and which way. The scene draws the flown card itself and reads its
// seat from the frozen pose on every frame (see FlyingTile). Null whenever
// nothing flies (a book row, no scene, reduced motion); the modals then draw
// their own media (renderMedia).
export type CoilFlight = {
  key: string;
  kind: "photo" | "work";
  slot: number;
  photoSrc?: string;
  phase: "out" | "closing";
  revealed: boolean;
};

export type HomeControllerValue = {
  phase: HomeReadiness;
  // This load skipped the entrance (a deep reload, a section hash, reduced motion, or a quiet arrival).
  fastStart: boolean;
  // This load landed past the hero (a deep reload or a section hash).
  deep: boolean;
  reducedMotion: boolean;
  drivers: Drivers;
  modalOpen: boolean;
  flight: CoilFlight | null;
  // A title in a column: the Coil turns to its card (at once for a pointer,
  // which hovered it there already), then the card flies open.
  openTitle: (key: CardKey, origin: HTMLElement) => void;
  // A title under the pointer or keyboard focus: its card glides to the
  // front of the visible helix and the coil holds still on it (null when it
  // leaves). The pointer's title wins over the focused one. Nothing without a
  // scene.
  focusCard: (key: string | null, source?: RowSource) => void;
  // The scene claims the entrance before paint (its layout effect runs before
  // the controller's) and completes it once the band has opened; with no claim
  // the controller goes straight to ready.
  claimEntrance: () => () => void;
  completeEntrance: () => void;
  // When the entrance plays (slice 4): null until the loader hands the pane
  // over; at rest from the first frame on a fast start.
  entrance: CoilEntrance | null;
};

// Which signal a title sent: the pointer over it, or keyboard focus on it.
export type RowSource = "pointer" | "focus";

const HomeControllerContext = createContext<HomeControllerValue | null>(null);

export function useHomeController() {
  return useContext(HomeControllerContext);
}

// ---------------------------------------------------------------- controller

type Props = {
  // The columns beside the Coil (the section's own layout).
  children?: ReactNode;
};

export function HomeController({ children }: Props) {
  const phase = useHomeReadiness();
  const { drivers, reducedMotion } = useCapabilities();

  const [fastStart, setFastStart] = useState(false);
  const [deep, setDeep] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flight, setFlight] = useState<CoilFlight | null>(null);
  const sceneApiRef = useRef<CoilSceneApi>(null);
  // data-scene: "on" once the scene has drawn (the canvas name replaces the DOM
  // h1, which stays for assistive tech), "off" while one is on its way, "still"
  // once none can run (the hero still).
  const [heroScene, setHeroScene] = useState<HeroScene>("off");
  const entranceClaimsRef = useRef(0);
  // Null until the deal starts (the wheel turns in the teaser, the field closed); the deal's own once it does; at rest once dealt.
  const [entrance, setEntrance] = useState<CoilEntrance | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const deal = useDeal();
  const director = useDealDirector({ sectionRef, scene: heroScene, reducedMotion, setEntrance });

  // Before paint, once per load: own the readiness store, take manual scroll
  // restoration, decide whether this load lands deep, land it, and pick the
  // start phase. A deep load or reduced motion is a fast start: no entrance,
  // no lock. Without a scene claiming the entrance the hero is ready at once.
  //
  // The lock: when a scene claims the entrance the phase is "entering" from
  // here and the scroll lock covers it, releasing once when it completes.
  // Nothing claims it: the deal gates the section with its own state (the
  // Coil is not interactive and no title answers until it is dealt) because
  // the deal must never lock the reader's scroll, so the page is ready at once.
  useIsoLayoutEffect(() => {
    const releaseReadiness = claimHomeReadiness();
    const releaseRestoration = takeManualScrollRestoration();
    const recovery = readRecovery();
    const reduced = window.matchMedia(QUERIES.reduce).matches;
    // Back from the Express lane: at rest under the transition's mask, no loader.
    const quiet = isQuietArrival();
    const fast = recovery.deep || reduced || quiet;
    if (recovery.deep) applyRestore(recovery.target);
    const stopReland = relandAfterFonts(recovery.target);
    const entering = !fast && entranceClaimsRef.current > 0;
    publishHomeReadiness(entering ? "entering" : "ready");
    // A layout-effect state write re-renders before paint, which is the point:
    // consumers of fastStart must see it on the first painted frame.
    setFastStart(fast);
    setDeep(recovery.deep);
    return () => {
      stopReland();
      releaseRestoration();
      releaseReadiness();
    };
  }, []);

  useEffect(() => persistScrollPosition(), []);

  // Scroll stays locked for the whole entrance (the ref-counted lock, so an
  // overlapping Menu cannot wedge the body), plus a hard block on wheel and
  // touch so a flick cannot skip the intro. Fast starts never enter.
  const entranceLocked = phase === "entering";
  useBodyScrollLock(entranceLocked);
  useEffect(() => {
    if (!entranceLocked) return;
    const prevent = (event: Event) => event.preventDefault();
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
    };
  }, [entranceLocked]);

  const claimEntrance = useCallback(() => {
    entranceClaimsRef.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entranceClaimsRef.current = Math.max(0, entranceClaimsRef.current - 1);
    };
  }, []);

  // The Coil's entrance clock ran out: it is unfurled, and the Coil is the
  // reader's from this moment (the wheel and the pointer; no waiting for the
  // columns). The deal is over once the columns are in too (the director says),
  // and the page is ready as it always was.
  const { completeScene, settle } = director;
  const completeEntrance = useCallback(() => {
    dispatchDeal({ type: "unfurl" });
    completeScene();
    publishHomeReadiness("ready");
  }, [completeScene]);

  // ---- fx-input: the title hover signal ----
  // The pointer's title and the focused title are tracked apart, and the scene
  // hears only a change of the title that wins (a click that also focuses the
  // hovered title starts no second glide). A pointer's hover waits for a real
  // pointer move after the deal ends (or the page loads): the columns arriving
  // under a parked pointer is no hover, and must not turn the Coil
  // (lib/home/hoverArm.ts, as wheel capture already waits). The title it is
  // parked on is remembered and answers once the pointer has moved.
  const rowsRef = useRef<{ pointer: string | null; focus: string | null; sent: string | null }>({
    pointer: null,
    focus: null,
    sent: null,
  });
  const hoverArmRef = useRef(createHoverArm());
  const parkedRef = useRef<string | null>(null);
  const focusCard = useCallback((key: string | null, source: RowSource = "pointer") => {
    // Nothing answers a hover before the cards are dealt.
    if (key !== null && getDeal().phase !== "dealt") return;
    if (source === "pointer") {
      parkedRef.current = key;
      if (key !== null && !hoverArmRef.current.armed) return;
    }
    const rows = rowsRef.current;
    rows[source] = key;
    const next = rows.pointer ?? rows.focus;
    if (next === rows.sent) return;
    rows.sent = next;
    sceneApiRef.current?.focusCard(next);
  }, []);
  useEffect(() => {
    const arm = hoverArmRef.current;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (moveHover(arm, event.clientX, event.clientY) && parkedRef.current !== null) focusCard(parkedRef.current, "pointer");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // The deal ending (the columns arrive) waits for a real move again.
    let wasDealt = getDeal().phase === "dealt";
    const unsubscribe = subscribeDeal(() => {
      const dealt = getDeal().phase === "dealt";
      if (dealt && !wasDealt) disarmHover(arm);
      wasDealt = dealt;
    });
    return () => {
      window.removeEventListener("pointermove", onMove);
      unsubscribe();
    };
  }, [focusCard]);
  // ---- end fx-input ----

  // A card in the scene (or its title or its row in the unwound list): freeze the scene so
  // the rendered pose is the flight pose, and open its modal with the card
  // flying in, at any window width (input by capability, Layer 1). A touch tap
  // (slot -1), reduced motion or a slot off screen opens it like a book row,
  // the modal drawing its own media. The flown card lands on the slot of the
  // layout the modal opens in (components/card/CardHeader, StillPhoto).
  const openFromScene = useCallback(
    (key: string, slot: number, origin: OpenOrigin) => {
      if (selection || flight) return;
      const card = strandCardByKey.get(key);
      if (!card) return;
      const api = sceneApiRef.current;
      if (api && slot >= 0 && !reducedMotion && api.flightQuadOf(slot)) {
        api.freeze(true);
        setFlight({ key: card.key, kind: card.kind, slot, photoSrc: card.face.kind === "photo" ? card.face.src : undefined, phase: "out", revealed: false });
      }
      setSelection({ key: card.key, origin });
    },
    [selection, flight, reducedMotion],
  );

  // A tap on a touch screen opens the modal with no flight: the modal draws
  // its own media (renderMedia).
  const handleCardClick = useCallback(
    (card: CoilCardRef) => openFromScene(card.key, card.tap ? -1 : card.slot, null),
    [openFromScene],
  );
  const handleRowOpen = useCallback(
    (key: string, origin: HTMLElement) => openFromScene(key, sceneApiRef.current?.slotOfKey(key) ?? -1, origin),
    [openFromScene],
  );

  // A title: a pointer hovered it there already, so its card is at the front
  // and flies at once. A touch has no hover, so the Coil turns to the card
  // first (one glide) and the card flies when it arrives.
  const openTitle = useCallback(
    (key: CardKey, origin: HTMLElement) => {
      // A title chosen before the deal is over (a keyboard or a screen reader
      // reached it): the deal is over now, and the card opens as a book row
      // does, with no flight.
      if (getDeal().phase !== "dealt") {
        settle();
        openFromScene(key, -1, origin);
        return;
      }
      if (drivers.input !== "coarse" || !sceneApiRef.current) {
        handleRowOpen(key, origin);
        return;
      }
      focusCard(key, "pointer");
      window.setTimeout(() => {
        handleRowOpen(key, origin);
        focusCard(null, "pointer");
      }, COIL.hoverJumpMs + TURN_SETTLE_MS);
    },
    [drivers.input, focusCard, handleRowOpen, openFromScene, settle],
  );

  const handleFlyOutComplete = useCallback(() => setFlight((f) => (f ? { ...f, revealed: true } : f)), []);
  // The scene has already put the mesh back and resumed itself (the landing
  // never waits on a render); this only lets the flight's layer go.
  const handleClosingComplete = useCallback(() => setFlight(null), []);
  // The scene could not fly the card: the modal draws its own media.
  const handleFlightUnavailable = useCallback(() => {
    sceneApiRef.current?.freeze(false);
    setFlight(null);
  }, []);

  // Close: the card counts as seen now, at close, on every path (flight or
  // not), and focus returns to the row or control that opened it. Next frame
  // with preventScroll: the dialog's own focus return runs first, and a focus
  // scroll must never move the page under the visitor.
  const closeModal = useCallback(() => {
    if (!selection) return;
    if (flight) setFlight({ ...flight, phase: "closing", revealed: false });
    markSeen(selection.key);
    const origin = selection.origin;
    setSelection(null);
    if (!origin) return;
    requestAnimationFrame(() => {
      if (origin.isConnected) origin.focus({ preventScroll: true });
    });
  }, [selection, flight]);

  const modalOpen = selection !== null;
  // The modal draws its own image in the slot unless a flown card is parked
  // over it (a flight going home no longer covers the slot).
  const renderMedia = flight?.phase !== "out";

  const value = useMemo<HomeControllerValue>(
    () => ({
      phase,
      fastStart,
      deep,
      reducedMotion,
      drivers,
      modalOpen,
      flight,
      openTitle,
      focusCard,
      claimEntrance,
      completeEntrance,
      entrance,
    }),
    [
      phase,
      fastStart,
      deep,
      reducedMotion,
      drivers,
      modalOpen,
      flight,
      openTitle,
      focusCard,
      claimEntrance,
      completeEntrance,
      entrance,
    ],
  );

  return (
    <HomeControllerContext.Provider value={value}>
      <section
        ref={sectionRef}
        id="work"
        data-wave-anchor="cards"
        data-coil-section=""
        aria-label={siteContent.columns.ariaLabel}
        data-scene={heroScene}
        data-composition={drivers.composition}
        data-input={drivers.input}
        // The browser keeps every vertical swipe (and pinch zoom); horizontal
        // ones reach the scene's drag-to-spin.
        className="group/hero relative flex min-h-[100svh] w-full flex-col bg-background [touch-action:pan-y_pinch-zoom] md:block md:min-h-[100svh]"
      >
        <StageRail
          sectionRef={sectionRef}
          reducedMotion={reducedMotion}
          frozen={modalOpen || flight !== null}
          interactive={phase === "ready" && coilIsTheirs(deal)}
          input={drivers.input}
          scene={heroScene}
          onSceneChange={setHeroScene}
          api={sceneApiRef}
          onCardClick={handleCardClick}
          onRowOpen={handleRowOpen}
        />
        {children}
      </section>
      <CardModal cardKey={selection?.key ?? null} onClose={closeModal} renderMedia={renderMedia} flying={flight?.phase === "out"} />
      <Portal>
        {flight && (
          <FlyingTile
            key={flight.key}
            kind={flight.kind}
            slot={flight.slot}
            scene={sceneApiRef}
            photoSrc={flight.photoSrc}
            phase={flight.phase}
            revealed={flight.revealed}
            onFlyOutComplete={handleFlyOutComplete}
            onClosingComplete={handleClosingComplete}
            onUnavailable={handleFlightUnavailable}
          />
        )}
      </Portal>
    </HomeControllerContext.Provider>
  );
}
