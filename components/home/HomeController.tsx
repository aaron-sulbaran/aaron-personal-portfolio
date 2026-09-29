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
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { homeTileByKey, photoBySrc, workItemBySlug, type Photo, type WorkItem } from "@/lib/content";
import { useBodyScrollLock } from "@/lib/modal";
import { claimHomeReadiness, publishHomeReadiness, useHomeReadiness, type HomeReadiness } from "@/lib/home/readiness";
import { markSeen } from "@/lib/home/seen";
import {
  applyRestore,
  persistScrollPosition,
  readRecovery,
  relandAfterFonts,
  takeManualScrollRestoration,
} from "@/lib/home/recovery";
import { sameDrivers, selectDrivers, type Drivers } from "@/lib/coil/drivers";
import type { Quad } from "@/lib/coil/geometry";
import { PhotoModal } from "@/components/PhotoModal";
import { WorkModal } from "@/components/WorkModal";
import { CoilStage } from "@/components/coil/CoilStage";
import type { CoilEntrance } from "@/components/coil/CoilScene";
import { Loader, type LoaderMode } from "@/components/loader/Loader";
import { FONT_ITEMS, SCENE_ITEMS, beginHomeLoad, coilDebugFlags, endHomeLoad } from "@/lib/loader/progress";
import type { CoilCardFaces, CoilCardRef, CoilSceneApi } from "@/components/coil/CoilScene";
import { CoilFlyingTile } from "@/components/FlyingTile";
import { Portal } from "@/components/Portal";
import { HERO_HEADING_ID } from "./HeroText";

// The Coil's renderer-neutral home controller. It owns everything about the
// home that is not drawing: readiness, the entrance scroll lock, which modal is
// open, seen marking, focus restoration, deep-reload recovery, the flight's
// state, driver selection, and live reduced motion. The scene (slice 3) and
// the book talk to it through useHomeController(); TileRing keeps its own copy
// of all this behind the ring flag until it retires.
//
// Nothing here renders per frame: the scene reads what it needs once per
// change, and the per-frame state lives in the scene's own loop.

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type OpenOrigin = HTMLElement | null;

type Selection =
  | { kind: "photo"; key: string; photo: Photo; origin: OpenOrigin }
  | { kind: "work"; key: string; item: WorkItem; origin: OpenOrigin };

// The shared-element flight from a curved card into its modal (slice 5):
// four bent corners at activation, and the home quad recomputed from the frozen
// pose at close and after a resize. Null whenever nothing flies (a book row, no
// scene, reduced motion); the modals then draw their own media (renderMedia).
export type CoilFlight = {
  key: string;
  kind: "photo" | "work";
  slot: number;
  faces: CoilCardFaces;
  photoSrc?: string;
  source: Quad;
  home: Quad;
  phase: "out" | "closing";
  revealed: boolean;
};

export type HomeControllerValue = {
  phase: HomeReadiness;
  // This load skipped the entrance (a deep reload, a section hash, or reduced motion).
  fastStart: boolean;
  reducedMotion: boolean;
  drivers: Drivers;
  modalOpen: boolean;
  flight: CoilFlight | null;
  openPhoto: (photo: Photo, key: string, origin: OpenOrigin) => void;
  openWork: (item: WorkItem, key: string, origin: OpenOrigin) => void;
  // A work row or card that navigates away still counts as seen.
  markVisited: (key: string) => void;
  // A book row under the pointer or focus: its card glides to the front of the
  // visible helix (null when it leaves). Nothing without a scene.
  focusCard: (key: string | null) => void;
  // The scene claims the entrance before paint (its layout effect runs before
  // the controller's) and completes it once the band has opened; with no claim
  // the controller goes straight to ready.
  claimEntrance: () => () => void;
  completeEntrance: () => void;
  // When the entrance plays (slice 4): null until the loader hands the pane
  // over; at rest from the first frame on a fast start.
  entrance: CoilEntrance | null;
};

// No entrance: the coil is at rest from its first frame.
const AT_REST: CoilEntrance = { startMs: Number.NEGATIVE_INFINITY, nameFromLoader: false };

const HomeControllerContext = createContext<HomeControllerValue | null>(null);

export function useHomeController() {
  return useContext(HomeControllerContext);
}

// ---------------------------------------------------------------- capabilities

type CapabilitySnapshot = { drivers: Drivers; reducedMotion: boolean };

const SERVER_CAPABILITIES: CapabilitySnapshot = {
  drivers: { composition: "wide", input: "fine", scene: true },
  reducedMotion: false,
};

const QUERIES = {
  reduce: "(prefers-reduced-motion: reduce)",
  fine: "(pointer: fine)",
  hover: "(hover: hover)",
} as const;

let cachedCapabilities: CapabilitySnapshot = SERVER_CAPABILITIES;

function readCapabilities(): CapabilitySnapshot {
  const reducedMotion = window.matchMedia(QUERIES.reduce).matches;
  const drivers = selectDrivers({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    finePointer: window.matchMedia(QUERIES.fine).matches,
    canHover: window.matchMedia(QUERIES.hover).matches,
    reducedMotion,
  });
  if (cachedCapabilities.reducedMotion !== reducedMotion || !sameDrivers(cachedCapabilities.drivers, drivers)) {
    cachedCapabilities = { drivers, reducedMotion };
  }
  return cachedCapabilities;
}

function subscribeCapabilities(onChange: () => void) {
  const lists = Object.values(QUERIES).map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", onChange));
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    lists.forEach((list) => list.removeEventListener("change", onChange));
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

const serverCapabilities = () => SERVER_CAPABILITIES;

// ---------------------------------------------------------------- controller

type Props = {
  // The hero's server-rendered content (HeroText); the scene mounts beside it.
  hero: ReactNode;
  // What follows the hero and needs the controller (the book).
  children?: ReactNode;
};

export function HomeController({ hero, children }: Props) {
  const phase = useHomeReadiness();
  const { drivers, reducedMotion } = useSyncExternalStore(subscribeCapabilities, readCapabilities, serverCapabilities);

  const [fastStart, setFastStart] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flight, setFlight] = useState<CoilFlight | null>(null);
  const sceneApiRef = useRef<CoilSceneApi>(null);
  // The scene has drawn its first frame: the canvas name replaces the DOM h1
  // (which stays for assistive tech) until the scene goes away.
  const [sceneOn, setSceneOn] = useState(false);
  const entranceClaimsRef = useRef(0);
  // The loader: armed by the server's HTML, resolved before paint.
  const [loaderMode, setLoaderMode] = useState<LoaderMode>({ kind: "pending" });
  const [entrance, setEntrance] = useState<CoilEntrance | null>(null);
  const entranceExpectedRef = useRef(false);

  // Before paint, once per load: own the readiness store, take manual scroll
  // restoration, decide whether this load lands deep, land it, and pick the
  // start phase. A deep load or reduced motion is a fast start: no entrance,
  // no lock. Without a scene claiming the entrance the hero is ready at once.
  //
  // The loader and the lock: a deep load skips the loader entirely. Any other
  // load keeps it (reduced motion gets its plain form, the tally then only
  // waits for the fonts), and when the scene will play the entrance the
  // phase is "entering" from here, so the scroll lock covers the loader and
  // the entrance together and releases once, when the entrance completes.
  useIsoLayoutEffect(() => {
    const releaseReadiness = claimHomeReadiness();
    const releaseRestoration = takeManualScrollRestoration();
    const recovery = readRecovery();
    const reduced = window.matchMedia(QUERIES.reduce).matches;
    const fast = recovery.deep || reduced;
    if (recovery.deep) applyRestore(recovery.target);
    const stopReland = relandAfterFonts(recovery.target);
    const entering = !fast && entranceClaimsRef.current > 0;
    entranceExpectedRef.current = entering;
    const slow = coilDebugFlags(window.location.search).has("slow");
    const tally = beginHomeLoad(entering ? SCENE_ITEMS : FONT_ITEMS, performance.now(), slow);
    publishHomeReadiness(entering ? "entering" : "ready");
    // A layout-effect state write re-renders before paint, which is the point:
    // consumers of fastStart must see it on the first painted frame.
    setFastStart(fast);
    setLoaderMode(recovery.deep ? { kind: "off" } : { kind: "on", reducedMotion: reduced });
    if (!entering) setEntrance(AT_REST);
    return () => {
      endHomeLoad(tally);
      stopReland();
      releaseRestoration();
      releaseReadiness();
    };
  }, []);

  // The loader hands the pane over: the entrance starts (possibly a little
  // in the future, overlapping the loader's exit).
  const revealHero = useCallback((startMs: number, nameFromLoader: boolean) => {
    if (!entranceExpectedRef.current) return;
    setEntrance((current) => current ?? { startMs, nameFromLoader });
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

  const completeEntrance = useCallback(() => {
    publishHomeReadiness("ready");
  }, []);

  const openPhoto = useCallback((photo: Photo, key: string, origin: OpenOrigin) => {
    setSelection((current) => current ?? { kind: "photo", key, photo, origin });
  }, []);

  const openWork = useCallback((item: WorkItem, key: string, origin: OpenOrigin) => {
    setSelection((current) => current ?? { kind: "work", key, item, origin });
  }, []);

  const markVisited = useCallback((key: string) => markSeen(key), []);

  const focusCard = useCallback((key: string | null) => sceneApiRef.current?.focusCard(key), []);

  // A card in the scene (or its row in the unwound list): freeze the scene so
  // the rendered pose is the flight pose, take the card's corners and faces,
  // and open its modal with the clone flying in. Without a scene or a slot on
  // screen it opens like a book row, drawing its own media.
  const openCard = useCallback(
    (key: string, slot: number, origin: OpenOrigin) => {
      if (selection || flight) return;
      const tile = homeTileByKey.get(key);
      if (!tile) return;
      const photo = tile.kind === "photo" ? photoBySrc.get(tile.src) : undefined;
      const item = tile.kind === "work" ? workItemBySlug.get(tile.slug) : undefined;
      if (!photo && !item) return;
      const api = sceneApiRef.current;
      if (api && slot >= 0 && !reducedMotion) {
        api.freeze(true);
        const source = api.flightQuadOf(slot);
        const faces = api.facesOf(slot);
        if (source && faces) {
          setFlight({
            key,
            kind: tile.kind,
            slot,
            faces,
            photoSrc: photo?.src,
            source,
            home: source,
            phase: "out",
            revealed: false,
          });
        } else {
          api.freeze(false);
        }
      }
      if (photo) setSelection({ kind: "photo", key, photo, origin });
      else if (item) setSelection({ kind: "work", key, item, origin });
    },
    [selection, flight, reducedMotion],
  );

  const handleCardClick = useCallback((card: CoilCardRef) => openCard(card.key, card.slot, null), [openCard]);
  const handleRowOpen = useCallback(
    (key: string, origin: HTMLElement) => openCard(key, sceneApiRef.current?.slotOfKey(key) ?? -1, origin),
    [openCard],
  );

  const handleFlightMounted = useCallback(() => {
    if (flight) sceneApiRef.current?.hideSlot(flight.slot);
  }, [flight]);
  const handleFlyOutComplete = useCallback(() => setFlight((f) => (f ? { ...f, revealed: true } : f)), []);
  const handleClosingComplete = useCallback(() => {
    const api = sceneApiRef.current;
    api?.hideSlot(null);
    api?.freeze(false);
    setFlight(null);
  }, []);

  // A resize while a card is out: the frozen scene re-lays out, so its home
  // quad moves. Read it once the scene's own resize has rendered.
  const flying = flight !== null;
  useEffect(() => {
    if (!flying) return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          setFlight((f) => {
            const home = f ? sceneApiRef.current?.flightQuadOf(f.slot) : null;
            return f && home ? { ...f, home } : f;
          });
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [flying]);

  // Close: the card counts as seen now, at close, on every path (flight or
  // not), and focus returns to the row or control that opened it. Next frame
  // with preventScroll: the dialog's own focus return runs first, and a focus
  // scroll must never move the page under the visitor.
  const closeModal = useCallback(() => {
    if (!selection) return;
    if (flight) {
      const home = sceneApiRef.current?.flightQuadOf(flight.slot) ?? flight.home;
      setFlight({ ...flight, home, phase: "closing", revealed: false });
    }
    markSeen(selection.key);
    const origin = selection.origin;
    setSelection(null);
    if (!origin) return;
    requestAnimationFrame(() => {
      if (origin.isConnected) origin.focus({ preventScroll: true });
    });
  }, [selection, flight]);

  const modalOpen = selection !== null;
  // No flight means the modal draws its own image in the slot.
  const renderMedia = flight === null;

  const value = useMemo<HomeControllerValue>(
    () => ({
      phase,
      fastStart,
      reducedMotion,
      drivers,
      modalOpen,
      flight,
      openPhoto,
      openWork,
      markVisited,
      focusCard,
      claimEntrance,
      completeEntrance,
      entrance,
    }),
    [
      phase,
      fastStart,
      reducedMotion,
      drivers,
      modalOpen,
      flight,
      openPhoto,
      openWork,
      markVisited,
      focusCard,
      claimEntrance,
      completeEntrance,
      entrance,
    ],
  );

  return (
    <HomeControllerContext.Provider value={value}>
      <Loader mode={loaderMode} onReveal={revealHero} />
      <section
        aria-labelledby={HERO_HEADING_ID}
        data-scene={sceneOn ? "on" : "off"}
        data-composition={drivers.composition}
        data-input={drivers.input}
        className="group/hero relative flex min-h-[100svh] w-full items-center justify-center px-6 md:px-10"
      >
        <CoilStage
          reducedMotion={reducedMotion}
          frozen={modalOpen || flight !== null}
          interactive={phase === "ready"}
          input={drivers.input}
          onSceneChange={setSceneOn}
          api={sceneApiRef}
          onCardClick={handleCardClick}
          onRowOpen={handleRowOpen}
        />
        <div className="relative">{hero}</div>
      </section>
      {children}
      <PhotoModal
        photo={selection?.kind === "photo" ? selection.photo : null}
        onClose={closeModal}
        renderMedia={renderMedia}
      />
      <WorkModal item={selection?.kind === "work" ? selection.item : null} onClose={closeModal} renderMedia={renderMedia} />
      <Portal>
        {flight && (
          <CoilFlyingTile
            kind={flight.kind}
            faces={flight.faces}
            photoSrc={flight.photoSrc}
            source={flight.source}
            home={flight.home}
            phase={flight.phase}
            revealed={flight.revealed}
            onMounted={handleFlightMounted}
            onFlyOutComplete={handleFlyOutComplete}
            onClosingComplete={handleClosingComplete}
          />
        )}
      </Portal>
    </HomeControllerContext.Provider>
  );
}
