"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { createPortal } from "react-dom";
import { HOLDING_MODE } from "@/lib/holding";
import type { InputDriver } from "@/lib/coil/drivers";
import { CoilErrorBoundary } from "./CoilErrorBoundary";
import { HeroOverlay, type HeroOverlayHandle } from "./HeroOverlay";
import { canCreateWebGL2 } from "./webglProbe";
import { Poster } from "./Poster";
import { useHeroStill } from "./useHeroStill";
import { StillNotice } from "./StillNotice";
import { stillCause, type HeroScene, type StillFailure } from "@/lib/coil/heroStill";
import type { CoilCardRef, CoilSceneApi, CoilSceneProps } from "./CoilScene";
import { useHomeController } from "@/components/home/HomeController";

// The Coil's stage: a layer filling its frame in the cards section with the
// posters (Poster.tsx), the WebGL scene over them, and the DOM overlay. The
// canvas is sized from this container, never the viewport.
//
// The scene chunk (three and all) is imported only after first paint and only
// when it can run: not under reduced motion, not in holding mode, and with a
// WebGL 2 context this browser can actually create. Until its first frame the
// field poster waits with it (data-scene="off"); once it cannot run at all
// (no context, a failed chunk, the boundary, a second lost context, reduced
// motion) the hero is "still": the hero still once the current theme's has
// decoded (useHeroStill.ts), the h1 visually hidden only then, and the
// notice. A first lost context shows the field poster and remounts once.
// Reduced motion is live: turning it on tears the scene down, off rebuilds it.

type Props = {
  reducedMotion: boolean;
  frozen: boolean;
  interactive: boolean;
  input: InputDriver;
  // The hero's scene state, as the controller holds it (data-scene).
  scene: HeroScene;
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
  scene: heroScene,
  onSceneChange,
  api,
  onCardClick,
  onRowOpen,
}: Props) {
  const [Scene, setScene] = useState<ComponentType<CoilSceneProps> | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failure, setFailure] = useState<StillFailure | null>(null);
  const lossesRef = useRef(0);
  const overlayRef = useRef<HeroOverlayHandle>(null);
  const ownApiRef = useRef<CoilSceneApi>(null);
  const apiRef = api ?? ownApiRef;
  // The stage's frame (this stage's parent): the notice renders into it.
  const [hero, setHero] = useState<HTMLElement | null>(null);
  const stageRef = useCallback((stage: HTMLDivElement | null) => setHero(stage?.parentElement ?? null), []);

  const eligible = !reducedMotion && !HOLDING_MODE && !failure && hasWebGL2();

  const controller = useHomeController();
  const entrance = controller ? controller.entrance : AT_REST;
  const ready = controller?.phase === "ready";
  const completeEntrance = controller?.completeEntrance;
  // No scene will draw: the still decodes now.
  const still = useHeroStill(!eligible);

  useEffect(() => {
    if (!eligible || Scene) return;
    let cancelled = false;
    // After first paint: the poster and the greeting are already on screen.
    const frame = requestAnimationFrame(() => {
      // No real context, no chunk: the hero still carries the hero.
      if (!canCreateWebGL2()) {
        setFailure("noWebgl");
        return;
      }
      import("./CoilScene").then(
        (module) => {
          if (!cancelled) setScene(() => module.default);
        },
        () => {
          if (!cancelled) setFailure("unavailable");
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

  const handleFirstFrame = useCallback(() => onSceneChange("on"), [onSceneChange]);

  const handleError = useCallback(
    (error: unknown) => {
      console.error("Coil scene failed; the hero still carries the page.", error);
      onSceneChange("off");
      setFailure("unavailable");
    },
    [onSceneChange],
  );

  const handleContextLost = useCallback(() => {
    onSceneChange("off");
    lossesRef.current += 1;
    if (lossesRef.current === 1) setGeneration((n) => n + 1);
    else setFailure("unavailable");
  }, [onSceneChange]);

  return (
    <div ref={stageRef} data-coil-stage="" className="pointer-events-auto absolute inset-0 overflow-hidden">
      <Poster still={still} />
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
            nameShown={false}
          />
        </CoilErrorBoundary>
      ) : null}
      <HeroOverlay
        ref={overlayRef}
        api={apiRef}
        onRowOpen={onRowOpen}
        entrance={entrance}
      />
      {heroScene === "still" && ready && hero
        ? createPortal(<StillNotice cause={stillCause({ reducedMotion, hasApi: hasWebGL2(), failure })} />, hero)
        : null}
    </div>
  );
}

// No entrance (outside a controller): at rest from the first frame.
const AT_REST = { startMs: Number.NEGATIVE_INFINITY, nameFromLoader: false };

// The API check only, cheap enough for render; the chunk import also probes
// for a real context first (webglProbe.ts). A context that still fails to
// start throws inside the scene and lands on the hero still through the boundary.
// The server renders no scene either way, so this never changes the markup.
function hasWebGL2() {
  return typeof window === "undefined" || typeof WebGL2RenderingContext !== "undefined";
}
