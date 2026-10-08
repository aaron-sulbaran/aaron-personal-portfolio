"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { LabCard } from "./cards";
import { DesktopGallery } from "./DesktopGallery";
import { interleave, readingOrder } from "./layout";
import { CloseHint, Header, Links, TextBlock } from "./parts";
import { PhoneStage } from "./PhoneStage";
import type { Settings } from "./settings";
import { desktopSteps, phoneSteps } from "./timing";
import { useMaskIn, type Schedule } from "./useMaskIn";

// What the modal holds: the desktop rows or the phone stage, the masks that
// bring them in, and the measurements the panel reports (does the first row
// fit above the fold, how much of the height the stage takes).

export type Frame = { width: number; height: number; scale: number };

export type Measure = {
  mode: "desktop" | "phone";
  foldPx: number;
  // Desktop: the bottom of the first row with a photo. Phone: the top of
  // the first block's second line, so its first two lines are in view.
  keyBottomPx: number;
  fits: boolean;
  textColumnPx?: number;
  stagePx?: number;
};

type Props = {
  card: LabCard;
  s: Settings;
  phone: boolean;
  theme: "light" | "dark";
  reduced: boolean;
  frame: Frame;
  runKey: string;
  onSchedule: (schedule: Schedule) => void;
  onMeasure: (measure: Measure) => void;
};

export function GalleryContent({ card, s, phone, theme, reduced, frame, runKey, onSchedule, onMeasure }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(() => interleave(card.blocks.length, card.photos, s.extrasPerRow), [card, s.extrasPerRow]);
  const order = useMemo(() => readingOrder(rows), [rows]);
  const firstPhoto = order[0];
  const hasLinks = card.links.length > 0;

  const stepsFor = useCallback(
    (lines: (id: string) => number) =>
      phone ? phoneSteps(card.blocks.length, { flown: card.flown, hasLinks, lines }) : desktopSteps(rows, firstPhoto, { flown: card.flown, hasLinks, lines }),
    [phone, card, hasLinks, rows, firstPhoto],
  );

  useMaskIn(rootRef, { active: true, reduced, s, runKey: `${runKey}|${phone ? "phone" : "desktop"}`, stepsFor, onSchedule });

  const settingsKey = `${s.panelWidth}|${s.photoWidth}|${s.rowGap}|${s.columnGap}|${s.textAlign}|${s.extrasPerRow}|${s.stageMaxHeight}`;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>("[data-gallery-dialog]");
    if (!root || !scroller) return;
    const measure = () => {
      const top = scroller.getBoundingClientRect().top - scroller.scrollTop * frame.scale;
      const local = (y: number) => (y - top) / frame.scale;
      if (!phone) {
        const firstRow = root.querySelector<HTMLElement>('[data-row="pair"], [data-row="photos"]');
        const bottom = firstRow ? local(firstRow.getBoundingClientRect().bottom) : 0;
        const text = firstRow?.querySelector<HTMLElement>('[data-mask-kind="text"]');
        onMeasure({
          mode: "desktop",
          foldPx: frame.height,
          keyBottomPx: Math.round(bottom),
          fits: bottom <= frame.height,
          textColumnPx: text ? Math.round(text.getBoundingClientRect().width / frame.scale) : undefined,
        });
        return;
      }
      const stage = root.querySelector<HTMLElement>("[data-stage-frame]");
      const block = root.querySelector<HTMLElement>('[data-mask="block-0"] p');
      const lineHeight = block ? parseFloat(getComputedStyle(block).lineHeight) || 24 : 24;
      const secondLine = block ? local(block.getBoundingClientRect().top) + 2 * lineHeight : 0;
      onMeasure({
        mode: "phone",
        foldPx: frame.height,
        keyBottomPx: Math.round(secondLine),
        fits: secondLine <= frame.height,
        stagePx: stage ? Math.round(stage.getBoundingClientRect().height / frame.scale) : undefined,
      });
    };
    // After the panel's own 280ms entrance, which scales it.
    const id = window.setTimeout(measure, 340);
    return () => window.clearTimeout(id);
  }, [phone, frame.width, frame.height, frame.scale, settingsKey, card, onMeasure]);

  if (!phone) {
    return (
      <div ref={rootRef} className="flex flex-col gap-8">
        <DesktopGallery card={card} rows={rows} s={s} theme={theme} firstPhoto={firstPhoto} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mt-12 flex flex-col gap-6">
      <PhoneStage
        key={`${card.id}-${runKey}-${s.autoAdvance}`}
        photos={order.map((i) => card.photos[i])}
        order={order}
        maxHeightPx={(frame.height * s.stageMaxHeight) / 100}
        autoSeconds={s.autoAdvance}
        crossfadeMs={s.crossfadeMs}
        startAfterMs={s.landingMs + s.maskMs}
        reduced={reduced}
        flown={card.flown === "first-photo"}
        scale={frame.scale}
        desktopPhotoWidth={s.photoWidth}
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
