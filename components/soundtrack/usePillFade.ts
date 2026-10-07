"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { DOCK } from "@/lib/waveform/dock";

// The pill's introduction at its dock: opacity over DOCK.fadeMs when the
// band's bottom edge rises above the dock line (DOCK.passedPx), and the same
// fade out when the band comes back below it. It never moves, so reduced motion gets the same fade. A reversal
// starts from the opacity it has. `present`: the root shows (in, or fading
// away). `landed`: fully in, which starts the label's hold.
export function usePillFade(target: RefObject<HTMLElement | null>, shown: boolean) {
  const [exiting, setExiting] = useState(false);
  const [landed, setLanded] = useState(false);
  const [previous, setPrevious] = useState(shown);
  const tween = useRef<gsap.core.Tween | null>(null);
  const out = useRef(false);

  if (shown !== previous) {
    setPrevious(shown);
    setExiting(!shown);
    setLanded(false);
  }

  useLayoutEffect(() => {
    const el = target.current;
    if (shown === out.current) return;
    out.current = shown;
    const running = tween.current?.isActive() ?? false;
    tween.current?.kill();
    tween.current = null;
    // No wrapper (the phone query matched): nothing to fade.
    if (!el) {
      out.current = false;
      gsap.delayedCall(0, () => setExiting(false));
      return;
    }
    const seconds = DOCK.fadeMs / 1000;
    if (shown) {
      const from = running ? Number(gsap.getProperty(el, "opacity")) : 0;
      tween.current = gsap.fromTo(el, { opacity: from }, {
        opacity: 1,
        duration: seconds * (1 - from),
        ease: "none",
        onComplete: () => {
          gsap.set(el, { clearProps: "opacity" });
          tween.current = null;
          setLanded(true);
        },
      });
      return;
    }
    // The wrapper keeps its 0 until the next fade in sets its own, so the
    // pill never flashes at rest before React hides the root.
    tween.current = gsap.to(el, {
      opacity: 0,
      duration: seconds * Number(gsap.getProperty(el, "opacity")),
      ease: "none",
      onComplete: () => {
        tween.current = null;
        setExiting(false);
      },
    });
  }, [shown, target]);

  useLayoutEffect(() => () => void tween.current?.kill(), []);

  return { present: shown || exiting, landed };
}
