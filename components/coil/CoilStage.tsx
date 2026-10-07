"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { HOLDING_MODE } from "@/lib/holding";
import type { InputDriver } from "@/lib/coil/drivers";
import { CoilErrorBoundary } from "./CoilErrorBoundary";
import { HeroOverlay, type HeroOverlayHandle } from "./HeroOverlay";
import { canCreateWebGL2 } from "./webglProbe";
import { Poster, decodeHeroStill } from "./Poster";
import type { HeroScene } from "@/lib/coil/heroStill";
import type { CoilCardRef, CoilSceneApi, CoilSceneProps } from "./CoilScene";
// Slice 4: the entrance claim, the loader's tally and the name handoff.
import { COIL } from "@/lib/coil/constants";
import { useHomeController } from "@/components/home/HomeController";
import { SCENE_ITEMS, reportHomeLoad, settleHomeLoad } from "@/lib/loader/progress";
import { provideNameHandoff } from "@/lib/loader/handoff";

// The Coil hero's stage: a layer filling the 100svh hero with the posters
// (Poster.tsx), the WebGL scene over them, and the DOM overlay. The canvas is
// sized from this container, never the viewport.
//
// The scene chunk (three and all) is imported only after first paint and only
// when it can run: not under reduced motion, not in holding mode, and with a
// WebGL 2 context this browser can actually create. Until its first frame the
// field poster waits with it (data-scene="off"); once it cannot run at all
// (no context, a failed chunk, the boundary, a second lost context, reduced
// motion) the hero is "still": the hero still once decoded, the h1 visually
// hidden only then, and the notice. A first lost context shows the field
// poster and remounts once.
// Reduced motion is live: turning it on tears the scene down, off rebuilds it.

type Props = {
  reducedMotion: boolean;
  frozen: boolean;
  interactive: boolean;
  input: InputDriver;
  // "on" once the scene has drawn, "off" while one is on its way, "still" once none can run.
  onSceneChange: (scene: HeroScene) => void;
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
  const [stillDecoded, setStillDecoded] = useState(false);
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
        land: () => apiRef.current?.landName() ?? false,
      }),
    [apiRef],
  );
  useEffect(() => {
    if (eligible) return;
    // No scene will draw: the still decodes now (the h1 hides only once it
    // has), nothing left to wait for, nothing left to play.
    let live = true;
    decodeHeroStill().then(
      () => {
        if (live) setStillDecoded(true);
      },
      () => undefined,
    );
    settleHomeLoad(SCENE_ITEMS.filter((item) => item !== "fonts"));
    completeEntrance?.();
    return () => {
      live = false;
    };
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
      // No real context, no chunk: the hero still carries the hero.
      if (!canCreateWebGL2()) {
        setFailed(true);
        return;
      }
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
    if (!mounted) onSceneChange(eligible ? "off" : "still");
  }, [mounted, eligible, onSceneChange]);

  const handleFirstFrame = useCallback(() => {
    reportHomeLoad("frame"); // slice 4: the loader's tally
    onSceneChange("on");
  }, [onSceneChange]);

  const handleError = useCallback(
    (error: unknown) => {
      console.error("Coil scene failed; the poster stays.", error);
      onSceneChange("off");
      setFailed(true);
    },
    [onSceneChange],
  );

  const handleContextLost = useCallback(() => {
    onSceneChange("off");
    lossesRef.current += 1;
    if (lossesRef.current === 1) setGeneration((n) => n + 1);
    else setFailed(true);
  }, [onSceneChange]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Poster stillReady={!eligible && stillDecoded} />
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
      <HeroOverlay ref={overlayRef} api={apiRef} onRowOpen={onRowOpen} entrance={entrance} />
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

// The API check only, cheap enough for render; the chunk import also probes
// for a real context first (webglProbe.ts). A context that still fails to
// start throws inside the scene and lands on the hero still through the boundary.
// The server renders no scene either way, so this never changes the markup.
function hasWebGL2() {
  return typeof window === "undefined" || typeof WebGL2RenderingContext !== "undefined";
}
