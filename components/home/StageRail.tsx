"use client";

import type { ComponentProps, CSSProperties, RefObject } from "react";
import { CoilStage } from "@/components/coil/CoilStage";
import { COIL } from "@/lib/coil/constants";
import { useStageLead } from "./useStageLead";

// The Coil's frame in the cards section, and the rail its canvas sticks in.
// The rail is the frame, reaching up over page 1's foot by --run-lead
// (useStageLead, which this mounts and which writes the property on the
// section). The stage is as tall as the frame and sticks at the top of the
// screen, so the ribbon, the wheel, the band and the Coil are one object on one
// canvas through the deal. On a phone the frame is page 2's band, at least
// COIL.phone.bandSvh of the screen, with the columns under it; from md up it
// fills the section and the columns flank it. Layout only; the stage's props
// come from the controller.

const PHONE_BAND = { "--coil-phone-band": `${COIL.phone.bandSvh}svh` } as CSSProperties;

type Props = ComponentProps<typeof CoilStage> & {
  sectionRef: RefObject<HTMLElement | null>;
};

export function StageRail({ sectionRef, ...stage }: Props) {
  useStageLead(sectionRef, stage.scene, stage.reducedMotion);
  return (
    <div data-coil-frame="" className="relative min-h-[var(--coil-phone-band)] flex-1 md:absolute md:inset-0 md:min-h-0" style={PHONE_BAND}>
      <div data-coil-rail="" className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "calc(100% + var(--run-lead, 0px))" }}>
        <div data-coil-sticky="" className="sticky top-0" style={{ height: "calc(100% - var(--run-lead, 0px))" }}>
          <CoilStage {...stage} />
        </div>
      </div>
    </div>
  );
}
