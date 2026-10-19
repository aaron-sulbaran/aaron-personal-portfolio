"use client";

import { useEffect, useMemo, useRef } from "react";
import { quickEntries } from "@/lib/content/quick";
import { writeAnswer } from "@/lib/quick/invite";
import { nextLines, type NextChoice } from "@/lib/quick/next";
import type { QuickVariant, TitleMode } from "@/lib/quick/settings";
import { DEFAULT_TEXTS, yearLines, type QuickTexts } from "@/lib/quick/texts";
import { yearRows } from "@/lib/quick/years";
import { ClosingSign } from "./ClosingSign";
import { LaneHeader } from "./LaneHeader";
import { RailVariant } from "./RailVariant";
import { RoadVariant } from "./RoadVariant";
import { useLaneMaskIn } from "./useLaneMaskIn";
import { useQuickModal } from "./useQuickModal";
import { WhatsNext } from "./WhatsNext";

// The Express lane: its head, then the years in the chosen variant, What's next
// and the closing row below the rail, and the card modal its tiles open. A new variant, new words or a replay is a new run,
// so the variant remounts and its checkpoints start again. visit: this
// is the real page, so arriving answers the first-visit invite for good.

type Props = {
  variant?: QuickVariant;
  titleMode?: TitleMode;
  titleDelayMs?: number;
  titleStaggerMs?: number;
  titleDurationMs?: number;
  texts?: QuickTexts;
  // What's next: the variant, A (the What's next section) and B (the line under the intro).
  nextVariant?: NextChoice;
  showNextA?: boolean;
  showLookingB?: boolean;
  speed?: number;
  forceReduced?: boolean;
  replay?: number;
  visit?: boolean;
};

export function ExpressLane({ variant = "rail", titleMode, titleDelayMs, titleStaggerMs, titleDurationMs, texts = DEFAULT_TEXTS, nextVariant = "two-tracks", showNextA = true, showLookingB = true, speed = 1, forceReduced = false, replay = 0, visit = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { open, modal } = useQuickModal();
  const rows = useMemo(() => yearRows(quickEntries, yearLines(texts)), [texts]);
  const lines = nextLines(nextVariant, texts);
  const next = showNextA && lines.full ? lines.full : null;
  const looking = showLookingB && lines.short ? lines.short : null;
  const runKey = `${variant}:${replay}:${rows.map((row) => row.line.length).join(".")}`;
  useLaneMaskIn(rootRef);

  useEffect(() => {
    if (!visit) return;
    try {
      writeAnswer(localStorage, "used");
    } catch {
      // Blocked storage: nothing to remember.
    }
  }, [visit]);

  const shared = { rows, runKey, speed, forceReduced, onOpen: open };
  return (
    <div ref={rootRef}>
      <LaneHeader
        key={`${titleMode}:${titleDelayMs}:${titleStaggerMs}:${titleDurationMs}:${forceReduced}:${replay}`}
        intro={texts.intro}
        looking={looking}
        canJump={next !== null}
        tipBack={texts.tipBack}
        titleMode={titleMode}
        titleDelayMs={titleDelayMs}
        titleStaggerMs={titleStaggerMs}
        titleDurationMs={titleDurationMs}
        forceReduced={forceReduced}
      />
      {variant === "road" ? <RoadVariant key={runKey} {...shared} /> : <RailVariant key={runKey} {...shared} trip={variant === "trip"} />}
      {next && <WhatsNext line={next} />}
      <ClosingSign className="mt-24 scroll-mt-40" />
      {modal}
    </div>
  );
}
