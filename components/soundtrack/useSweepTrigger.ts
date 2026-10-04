"use client";

import type { RefObject } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { PHONE_QUERY } from "@/lib/waveform/layout";
import type { WaveConductor } from "./waveConductor";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The sweep follows one ScrollTrigger on the band: it writes a target and
// animates nothing; the conductor eases toward it (lib/waveform/sweep.ts), so
// an anchor jump plays as a short glide and the reversal is free. onLeave and
// onLeaveBack pin the ends for jumps, and creation and refresh snap, so a
// deep load past the band starts on the horizon with no glide.
//
// Phones have no horizon this pass, so on the phone query (the one the strip
// is gated by, so the two agree at any width) there is no trigger and the
// train stays in the band. The ref must be filled in a layout effect declared
// before this hook (BandStage does), since useGSAP runs as a layout effect. A
// live reduced-motion toggle rebuilds the conductor, so it reverts the old
// trigger and builds one on the new conductor (revertOnUpdate).
export function useSweepTrigger(conductorRef: RefObject<WaveConductor | null>) {
  const still = useReducedMotionLive();

  useGSAP(
    () => {
      const conductor = conductorRef.current;
      if (!conductor) return;
      const mm = gsap.matchMedia();
      mm.add(`not all and ${PHONE_QUERY}`, () => {
        const st = ScrollTrigger.create({
          trigger: "#listen",
          start: "center 60%",
          end: "bottom 15%",
          onUpdate: (self) => conductor.setSweepTarget(self.progress),
          onLeave: () => conductor.setSweepTarget(1),
          onLeaveBack: () => conductor.setSweepTarget(0),
          onRefresh: (self) => conductor.setSweepTarget(self.progress, true),
        });
        conductor.setSweepTarget(st.progress, true);
        return () => {
          st.kill();
          conductor.setSweepTarget(0, true);
        };
      });
      return () => mm.revert();
    },
    { dependencies: [still], revertOnUpdate: true },
  );
}
