"use client";

import type { ComponentProps, RefObject } from "react";
import { CoilStage } from "@/components/coil/CoilStage";
import { useStageLead } from "./useStageLead";

// The Coil's frame in the cards section, and the rail its canvas sticks in.
// The rail reaches up over the home's first screen by --run-lead
// (useStageLead, which this mounts and which writes the property on the
// section) and is as tall as the lead plus a screen, or the frame where that is
// taller. The stage is a screen (or the frame) tall and sticks at the top of the
// screen from the page's first pixel, so the ribbon, the wheel, the band and
// the Coil are one object on one canvas through the deal. On a phone the frame
// is shorter than a screen and the stage reaches below it, over the columns
// (--stage-overhang). Layout only; the stage's props come from the controller.

type Props = ComponentProps<typeof CoilStage> & {
  sectionRef: RefObject<HTMLElement | null>;
};

export function StageRail({ sectionRef, ...stage }: Props) {
  useStageLead(sectionRef, stage.scene, stage.reducedMotion);
  return (
    <div data-coil-frame="" className="relative min-h-[34svh] flex-1 md:absolute md:inset-0 md:min-h-0">
      <div
        data-coil-rail=""
        className="pointer-events-none absolute inset-x-0"
        style={{ top: "calc(-1 * var(--run-lead, 0px))", height: "calc(var(--run-lead, 0px) + max(100%, 100svh))" }}
      >
        <div data-coil-sticky="" className="sticky top-0" style={{ height: "calc(100% - var(--run-lead, 0px))" }}>
          <CoilStage {...stage} />
        </div>
      </div>
    </div>
  );
}
