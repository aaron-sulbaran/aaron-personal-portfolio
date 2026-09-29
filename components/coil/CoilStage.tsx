"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { HOLDING_MODE } from "@/lib/holding";
import type { InputDriver } from "@/lib/coil/drivers";
import { CoilErrorBoundary } from "./CoilErrorBoundary";
import { HeroOverlay, type HeroOverlayHandle } from "./HeroOverlay";
import type { CoilCardRef, CoilSceneApi, CoilSceneProps } from "./CoilScene";

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

  useEffect(() => {
    if (!eligible || Scene) return;
    let cancelled = false;
    // After first paint: the poster and the greeting are already on screen.
    const frame = requestAnimationFrame(() => {
      import("./CoilScene").then(
        (module) => {
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

  const handleFirstFrame = useCallback(() => onSceneChange(true), [onSceneChange]);

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
            onCardClick={onCardClick}
          />
        </CoilErrorBoundary>
      ) : null}
      <HeroOverlay ref={overlayRef} api={apiRef} onRowOpen={onRowOpen} />
    </div>
  );
}

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
