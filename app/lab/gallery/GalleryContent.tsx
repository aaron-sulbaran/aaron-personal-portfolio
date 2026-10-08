"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { drawnShape, type LabCard } from "./cards";
import { DesktopGallery } from "./DesktopGallery";
import { interleave, panelWidthIn, readingOrder } from "./rows";
import { CloseHint, Header, Links, TextBlock } from "./parts";
import { PhoneStage } from "./PhoneStage";
import type { Settings } from "./settings";
import { desktopSteps, phoneSteps, type StepOptions } from "./timing";
import { useMaskIn, type Schedule } from "./useMaskIn";

// What the modal holds: the desktop rows or the phone stage, the masks that
// bring them in, and the measurements the panel reports (does the first row
// fit above the fold, where the flight lands, how much of the height the
// stage takes).

export type Frame = { width: number; height: number; scale: number };

export type Measure = {
  mode: "desktop" | "phone";
  foldPx: number;
  // Desktop: the bottom of the first row with a photo. Phone: the top of
  // the first block's second line, so its first two lines are in view.
  keyBottomPx: number;
  fits: boolean;
  textColumnPx?: number;
  // Desktop: the bottom of the first photo itself, without its caption.
  photoBottomPx?: number;
  stagePx?: number;
  // Where the flown card picture's slot starts; null when it has no slot on
  // screen (a phone stage that opens on another photo).
  flownTopPx?: number | null;
};

type Props = {
  card: LabCard;
  shapes: number[];
  s: Settings;
  phone: boolean;
  theme: "light" | "dark";
  reduced: boolean;
  frame: Frame;
  runKey: string;
  onSchedule: (schedule: Schedule) => void;
  onMeasure: (measure: Measure) => void;
};

// The backdrop's side padding and the panel's padding, by layout.
const DESKTOP_SIDE = 40;
const DESKTOP_PAD = 40;
const PHONE_INSET = 72;

export function GalleryContent({ card, shapes, s, phone, theme, reduced, frame, runKey, onSchedule, onMeasure }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const aspects = useMemo(() => card.photos.map((_, i) => drawnShape(card, i, shapes[i])), [card, shapes]);
  const rows = useMemo(
    () => interleave(card.blocks.length, card.photos.map((p, i) => ({ block: p.block, aspect: aspects[i] })), { extrasPerRow: s.extrasPerRow, wideFrom: s.wideFrom, lead: card.flownPhoto, leadMode: s.leadMode }),
    [card, aspects, s.extrasPerRow, s.wideFrom, s.leadMode],
  );
  const order = useMemo(() => readingOrder(rows), [rows]);
  const hasLinks = card.links.length > 0;
  const innerWidth = phone ? frame.width - PHONE_INSET : panelWidthIn(frame.width, s.panelWidth, DESKTOP_SIDE) - 2 * DESKTOP_PAD;

  const stepsFor = useCallback(
    (lines: (id: string) => number) => {
      const o: StepOptions = { flownPhoto: card.flownPhoto, hasCaption: (p) => !!card.photos[p].caption, hasLinks, lines };
      return phone ? phoneSteps(card.blocks.length, order[0], { ...o, stageCaption: card.photos.some((p) => p.caption) }) : desktopSteps(rows, o);
    },
    [phone, card, hasLinks, rows, order],
  );

  const shapeKey = aspects.map((a) => a.toFixed(3)).join(",");
  useMaskIn(rootRef, { active: true, reduced, s, runKey: `${runKey}|${phone ? "phone" : "desktop"}|${shapeKey}`, stepsFor, onSchedule });

  const settingsKey = `${s.panelWidth}|${s.photoWidth}|${s.rowGap}|${s.columnGap}|${s.textAlign}|${s.extrasPerRow}|${s.stageMaxHeight}|${s.wideFrom}|${s.wideWidth}|${s.wideMaxHeight}|${s.stackGap}|${s.stageFit}|${s.leadMode}|${shapeKey}`;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>("[data-gallery-dialog]");
    if (!root || !scroller) return;
    const measure = () => {
      const top = scroller.getBoundingClientRect().top - scroller.scrollTop * frame.scale;
      const local = (y: number) => (y - top) / frame.scale;
      const flown = root.querySelector<HTMLElement>("[data-tile-slot]");
      if (!phone) {
        const firstRow = root.querySelector<HTMLElement>("[data-row]");
        const bottom = firstRow ? local(firstRow.getBoundingClientRect().bottom) : 0;
        const text = root.querySelector<HTMLElement>('[data-row="pair"] > [data-mask^="block-"]');
        const firstPhoto = firstRow?.querySelector<HTMLElement>("[data-photo-frame] > div");
        onMeasure({
          mode: "desktop",
          foldPx: frame.height,
          keyBottomPx: Math.round(bottom),
          fits: bottom <= frame.height,
          textColumnPx: text ? Math.round(text.getBoundingClientRect().width / frame.scale) : undefined,
          photoBottomPx: firstPhoto ? Math.round(local(firstPhoto.getBoundingClientRect().bottom)) : undefined,
          flownTopPx: flown ? Math.round(local(flown.getBoundingClientRect().top)) : undefined,
        });
        return;
      }
      const stage = root.querySelector<HTMLElement>("[data-stage-frame]");
      const block = root.querySelector<HTMLElement>('[data-mask="block-0"] p');
      const lineHeight = block ? parseFloat(getComputedStyle(block).lineHeight) || 24 : 24;
      const secondLine = block ? local(block.getBoundingClientRect().top) + 2 * lineHeight : 0;
      const flownOnStage = card.flownPhoto !== undefined && order[0] === card.flownPhoto;
      onMeasure({
        mode: "phone",
        foldPx: frame.height,
        keyBottomPx: Math.round(secondLine),
        fits: secondLine <= frame.height,
        stagePx: stage ? Math.round(stage.getBoundingClientRect().height / frame.scale) : undefined,
        flownTopPx: card.flownPhoto === undefined ? (flown ? Math.round(local(flown.getBoundingClientRect().top)) : undefined) : flownOnStage && stage ? Math.round(local(stage.getBoundingClientRect().top)) : null,
      });
    };
    // After the panel's own 280ms entrance, which scales it, and the stage's ease.
    const id = window.setTimeout(measure, 340 + (phone ? s.stageEaseMs : 0));
    return () => window.clearTimeout(id);
  }, [phone, frame.width, frame.height, frame.scale, settingsKey, card, order, onMeasure, s.stageEaseMs]);

  // Keyed by card and shapes: React replaces the content whole rather than
  // patching inside a paragraph SplitText has split.
  const contentKey = `${card.id}|${shapeKey}|${s.leadMode}`;

  if (!phone) {
    return (
      <div key={contentKey} ref={rootRef} className="flex flex-col gap-8">
        <DesktopGallery card={card} rows={rows} s={s} theme={theme} shapes={shapes} innerWidth={innerWidth} />
      </div>
    );
  }

  return (
    <div key={contentKey} ref={rootRef} className="mt-12 flex flex-col gap-6">
      <PhoneStage
        key={`${card.id}-${runKey}-${s.autoAdvance}`}
        photos={order.map((i) => card.photos[i])}
        aspects={order.map((i) => aspects[i])}
        order={order}
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
