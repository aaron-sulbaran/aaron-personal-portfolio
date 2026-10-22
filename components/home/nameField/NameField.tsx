"use client";

import { useCallback, useRef, useState } from "react";
import { useDocumentTheme } from "@/components/footer/useDocumentTheme";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { COIL } from "@/lib/coil/constants";
import { useIntroKnobs } from "@/lib/home/useIntroKnobs";
import { reportIntroLoad } from "@/lib/home/introLoad";
import { nameFieldMask } from "@/lib/home/nameField";
import { LiveNameField } from "./LiveNameField";
import { PosterNameField } from "./PosterNameField";
import { useStageBox } from "./useStageBox";

// The field behind page 1's name. Live: the footer's own field in raw WebGL 2
// with a radial alpha mask, drawn over the stage (never under reduced motion,
// never when no WebGL 2 context can be made). Otherwise, and until the live
// field has drawn its first frame, the poster under the same mask. The mask is
// worked out from the heading's box and ends above the first paragraph (a
// field is never behind body text). It sits first in the stage, under the
// heading, and the loader's load waits for its first frame (or, where it
// cannot run, its poster).
export function NameField() {
  const layer = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionLive();
  const theme = useDocumentTheme();
  const knobs = useIntroKnobs();
  const box = useStageBox(layer, knobs.namePosition);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const onFirstFrame = useCallback(() => {
    setDrawn(true);
    reportIntroLoad("field");
  }, []);
  const onFail = useCallback(() => setFailed(true), []);

  const { shares, strength } = COIL.intro.field;
  const mask = box
    ? nameFieldMask({ stage: box.stage, heading: box.heading, knobs: { size: knobs.fieldSize, offsetX: knobs.fieldOffsetX, offsetY: knobs.fieldOffsetY, strength }, shares })
    : null;
  const live = box !== null && mask !== null && !reduced && !failed;
  const state = reduced || failed ? "poster" : drawn ? "live" : "waiting";

  return (
    <div ref={layer} aria-hidden="true" data-name-field={state} className="pointer-events-none absolute inset-0 overflow-hidden">
      {mask && <PosterNameField mask={mask} hidden={live && drawn} report={reduced || failed} />}
      {live && <LiveNameField box={box} mask={mask} theme={theme} onFirstFrame={onFirstFrame} onFail={onFail} />}
    </div>
  );
}
