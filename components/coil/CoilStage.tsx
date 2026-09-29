"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { HOLDING_MODE } from "@/lib/holding";
import type { InputDriver } from "@/lib/coil/drivers";
import { CoilErrorBoundary } from "./CoilErrorBoundary";
import { HeroOverlay, type HeroOverlayHandle } from "./HeroOverlay";
import type { CoilCardRef, CoilSceneApi, CoilSceneProps } from "./CoilScene";
// Slice 4: the entrance claim, the loader's tally and the name handoff.
import { COIL } from "@/lib/coil/constants";
import { useHomeController } from "@/components/home/HomeController";
import { SCENE_ITEMS, reportHomeLoad, settleHomeLoad } from "@/lib/loader/progress";
import { provideNameHandoff } from "@/lib/loader/handoff";

// The Coil hero's stage: a layer filling the 100svh hero with the poster (the
// field at its tuned moment, one per theme), the WebGL scene over it, and the
// DOM overlay. The canvas is sized from this container, never the viewport.
//
// The scene chunk (three and all) is imported only after first paint and only
// when it can run: not under reduced motion, not in holding mode, and with
// WebGL 2 present. Until its first frame, and forever when it cannot run or
// fails, the poster and the server-rendered h1 carry the hero. A lost context
// shows the poster and remounts once; a second loss stays on the poster.
// Reduced motion is live: turning it on tears the scene down, off rebuilds it.

type Props = {
  reducedMotion: boolean;
  frozen: boolean;
  interactive: boolean;
  input: InputDriver;
  // The hero shows the canvas name (data-scene="on") only once it has drawn.
  onSceneChange: (drawn: boolean) => void;
  // Slice 5: the controller's handle on the live scene (the flight, the book's
  // hover-jump), a card click in the canvas, and a row of the unwound list.
  api?: RefObject<CoilSceneApi | null>;
  onCardClick?: (card: CoilCardRef) => void;
  onRowOpen?: (key: string, origin: HTMLElement) => void;
};

export function CoilStage({
  reducedMotion,
  frozen,
  interactive,
  input,
  onSceneChange,
  api,
  onCardClick,
  onRowOpen,
}: Props) {
  const [Scene, setScene] = useState<ComponentType<CoilSceneProps> | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const lossesRef = useRef(0);
  const overlayRef = useRef<HeroOverlayHandle>(null);
  const ownApiRef = useRef<CoilSceneApi>(null);
  const apiRef = api ?? ownApiRef;

  const eligible = !reducedMotion && !HOLDING_MODE && !failed && hasWebGL2();

  // ---- slice 4: the entrance ----
  // The scene claims the entrance before paint (this layout effect runs before
  // the controller's) whenever it can run at all; the controller then plays
  // the loader and the entrance under one scroll lock. The loader lands its
  // name on the scene's through the handoff, and the lock releases when the
  // scene's clock ends, or at once if the scene cannot finish (it failed,
  // went away, or never drew within the fallback).
  const controller = useHomeController();
  const entrance = controller ? controller.entrance : AT_REST;
  const completeEntrance = controller?.completeEntrance;
  useIsoLayoutEffect(() => {
    if (HOLDING_MODE || !hasWebGL2() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return controller?.claimEntrance();
  }, []);
  useEffect(
    () =>
      provideNameHandoff({
        target: () => apiRef.current?.nameRect() ?? null,
        land: () => apiRef.current?.landName(),
      }),
    [apiRef],
  );
  useEffect(() => {
    if (eligible) return;
    // No scene will draw: nothing left to wait for, nothing left to play.
    settleHomeLoad(SCENE_ITEMS.filter((item) => item !== "fonts"));
    completeEntrance?.();
  }, [eligible, completeEntrance]);
  useEffect(() => {
    if (!entrance || !Number.isFinite(entrance.startMs) || !completeEntrance) return;
    const endsIn = entrance.startMs + COIL.entrance.durationMs + ENTRANCE_FALLBACK_MS - performance.now();
    const timer = window.setTimeout(completeEntrance, Math.max(0, endsIn));
    return () => window.clearTimeout(timer);
  }, [entrance, completeEntrance]);
  // ---- end slice 4 ----

  useEffect(() => {
    if (!eligible || Scene) return;
    let cancelled = false;
    // After first paint: the poster and the greeting are already on screen.
    const frame = requestAnimationFrame(() => {
      import("./CoilScene").then(
        (module) => {
          reportHomeLoad("chunk"); // slice 4: the loader's tally
          if (!cancelled) setScene(() => module.default);
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [eligible, Scene]);

  const mounted = eligible && Scene !== null;

  useEffect(() => {
    if (!mounted) onSceneChange(false);
  }, [mounted, onSceneChange]);

  const handleFirstFrame = useCallback(() => {
    reportHomeLoad("frame"); // slice 4: the loader's tally
    onSceneChange(true);
  }, [onSceneChange]);

  const handleError = useCallback(
    (error: unknown) => {
      console.error("Coil scene failed; the poster stays.", error);
      onSceneChange(false);
      setFailed(true);
    },
    [onSceneChange],
  );

  const handleContextLost = useCallback(() => {
    onSceneChange(false);
    lossesRef.current += 1;
    if (lossesRef.current === 1) setGeneration((n) => n + 1);
    else setFailed(true);
  }, [onSceneChange]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Poster />
      {mounted && Scene ? (
        <CoilErrorBoundary key={generation} onError={handleError}>
          <Scene
            frozen={frozen}
            interactive={interactive}
            input={input}
            overlay={overlayRef}
            api={apiRef}
            onFirstFrame={handleFirstFrame}
            onContextLost={handleContextLost}
            onError={handleError}
            entrance={entrance}
            onEntranceEnd={completeEntrance}
            onCardClick={onCardClick}
          />
        </CoilErrorBoundary>
      ) : null}
      <HeroOverlay ref={overlayRef} api={apiRef} onRowOpen={onRowOpen} />
    </div>
  );
}

// ---- slice 4 ----
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
// No entrance (outside a controller): at rest from the first frame.
const AT_REST = { startMs: Number.NEGATIVE_INFINITY, nameFromLoader: false };
// A scene that has not ended its entrance this long after it should have
// (a hidden tab, a stalled chunk) still releases the lock.
const ENTRANCE_FALLBACK_MS = 3000;
// ---- end slice 4 ----

// The API check only; a context that still fails to start throws inside the
// scene and lands on the poster through the boundary. The server renders no
// scene either way, so this never changes the markup.
function hasWebGL2() {
  return typeof window === "undefined" || typeof WebGL2RenderingContext !== "undefined";
}

// The field at fieldTime(0), the live field's first frame, with the bottom
// seam, rendered from the scene itself (?coildebug=poster) at 1440x900, one
// file per theme.
function Poster() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Image src="/coil/field-light.avif" alt="" fill unoptimized sizes="100vw" className="object-cover dark:hidden" />
      <Image src="/coil/field-dark.avif" alt="" fill unoptimized sizes="100vw" className="hidden object-cover dark:block" />
    </div>
  );
}
