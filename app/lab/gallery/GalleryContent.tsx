"use client";

import { useCallback, useMemo, useRef } from "react";
import { drawnShape, type LabCard } from "./cards";
import { cardLayout, DESKTOP_PAD, desktopColumns, stepsOf } from "./cardSteps";
import { DesktopGallery } from "./DesktopGallery";
import { CloseHint, Header, Links, TextBlock } from "./parts";
import { PhonePager } from "./PhonePager";
import { PhoneStage } from "./PhoneStage";
import { EASES, type Settings } from "./settings";
import { UniformGallery } from "./UniformGallery";
import { useGalleryMeasure, type Frame, type Measure } from "./useGalleryMeasure";
import { useMaskIn, type Schedule } from "./useMaskIn";

// What the modal holds: on desktop the round four or five rows (every photo
// its own row, or a group's photos taking turns in one) or the interleaved
// rows of rounds one to three; on a phone the round four pager (round five
// gives it one page a photo, a group's pages sharing its words; round six a
// page a paragraph with the group turning in its stage, or the other phone
// groupings) or the earlier stage over a scroll. The masks bring them in and
// the measurements feed the panel's readout.

export type { Frame, Measure };

type Props = {
  card: LabCard;
  shapes: number[];
  s: Settings;
  phone: boolean;
  theme: "light" | "dark";
  reduced: boolean;
  frame: Frame;
  // The panel's width on desktop: the setting, or round four's columns.
  panelWidth: number;
  runKey: string;
  onSchedule: (schedule: Schedule) => void;
  onMeasure: (measure: Measure) => void;
  onDismiss: () => void;
};

// The backdrop's side padding, and on a phone the backdrop's and the panel's
// padding with the panel's 1px border.
const DESKTOP_SIDE = 40;
const PHONE_INSET = 74;

export function GalleryContent({ card, shapes, s, phone, theme, reduced, frame, panelWidth, runKey, onSchedule, onMeasure, onDismiss }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const aspects = useMemo(() => card.photos.map((_, i) => drawnShape(card, i, shapes[i])), [card, shapes]);
  const layout = useMemo(() => cardLayout(card, aspects, s), [card, aspects, s]);
  const rows = s.desktopLayout === "rows";
  const pager = s.phoneLayout === "pager";
  const innerWidth = phone ? frame.width - PHONE_INSET : Math.max(0, Math.min(panelWidth, frame.width - 2 * DESKTOP_SIDE)) - 2 * DESKTOP_PAD;

  const stepsFor = useCallback((lines: (id: string) => number) => stepsOf(card, layout, s, phone ? "phone" : "desktop", lines), [card, layout, s, phone]);
  const shapeKey = aspects.map((a) => a.toFixed(3)).join(",");
  const modeKey = phone ? (pager ? `pager-${s.extras}-${s.phoneGrouping}` : "stage") : rows ? `rows-${s.extras}` : "interleaved";
  useMaskIn(rootRef, { active: true, reduced, s, runKey: `${runKey}|${modeKey}|${shapeKey}`, stepsFor, onSchedule });

  const settingsKey = `${panelWidth}|${s.photoWidth}|${s.rowGap}|${s.columnGap}|${s.textAlign}|${s.extrasPerRow}|${s.stageMaxHeight}|${s.wideFrom}|${s.wideWidth}|${s.wideMaxHeight}|${s.stackGap}|${s.stageFit}|${s.leadMode}|${s.verticalWidth}|${s.horizontalWidth}|${s.horizontalShape}|${s.textWidth}|${s.photoAlign}|${s.wordlessMaxHeight}|${modeKey}|${shapeKey}`;
  useGalleryMeasure(rootRef, { phone, pager, frame, card, firstStagePhoto: layout.order[0], settingsKey, delayMs: 340 + (phone && !pager ? s.stageEaseMs : 0), onMeasure });

  // Keyed by card, shapes and layout: React replaces the content whole
  // rather than patching inside a paragraph SplitText has split.
  const contentKey = `${card.id}|${shapeKey}|${s.leadMode}|${modeKey}`;

  if (!phone) {
    return (
      <div key={contentKey} ref={rootRef} className="flex flex-col gap-8">
        {rows ? (
          <UniformGallery card={card} plan={layout.plan} aspects={aspects} s={s} theme={theme} slot={desktopColumns(aspects, s).slot} reduced={reduced} runKey={runKey} />
        ) : (
          <DesktopGallery card={card} rows={layout.rows} s={s} theme={theme} shapes={shapes} innerWidth={innerWidth} />
        )}
      </div>
    );
  }

  if (pager) {
    return (
      <div key={contentKey} ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <PhonePager
          key={`${card.id}-${runKey}-${s.autoAdvance}`}
          card={card}
          pages={layout.pages}
          grouping={s.extras === "rotate" ? s.phoneGrouping : "repeat"}
          s={s}
          runKey={runKey}
          wordlessCapPx={(frame.height * s.wordlessMaxHeight) / 100}
          aspects={aspects}
          theme={theme}
          innerWidth={innerWidth}
          capPx={(frame.height * s.stageMaxHeight) / 100}
          slideMs={s.slideMs}
          flickPx={s.flickPx}
          ease={EASES[s.ease].css}
          autoSeconds={s.autoAdvance}
          startAfterMs={s.landingMs + s.maskMs}
          reduced={reduced}
          scale={frame.scale}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  return (
    <div key={contentKey} ref={rootRef} className="mt-12 flex flex-col gap-6">
      <PhoneStage
        key={`${card.id}-${runKey}-${s.autoAdvance}`}
        photos={layout.order.map((i) => card.photos[i])}
        aspects={layout.order.map((i) => aspects[i])}
        order={layout.order}
        innerWidth={innerWidth}
        maxHeightPx={(frame.height * s.stageMaxHeight) / 100}
        fit={s.stageFit}
        easeMs={s.stageEaseMs}
        autoSeconds={s.autoAdvance}
        crossfadeMs={s.crossfadeMs}
        startAfterMs={s.landingMs + s.maskMs}
        reduced={reduced}
        flownPhoto={card.flownPhoto}
        scale={frame.scale}
      />
      <Header card={card} theme={theme} compact />
      <div className="flex flex-col gap-4">
        {card.blocks.map((_, b) => (
          <TextBlock key={b} card={card} block={b} compact />
        ))}
      </div>
      <Links card={card} />
      <CloseHint />
    </div>
  );
}
