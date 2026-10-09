"use client";

import { useLayoutEffect, type RefObject } from "react";
import type { LabCard } from "./cards";

// What the panel's readout reports, measured from the drawn modal after its
// own entrance: does the first row fit above the fold, where the flight
// lands, how much of the height the stage takes, and on the pager whether
// any photo is cropped by its stage and whether the first page's words
// scroll.

export type Frame = { width: number; height: number; scale: number };

export type Measure = {
  mode: "desktop" | "phone";
  foldPx: number;
  // Desktop: the bottom of the first row with a photo. Phone stage: the top
  // of the first block's second line. Pager: the bottom of the controls.
  keyBottomPx: number;
  fits: boolean;
  textColumnPx?: number;
  // Desktop: the bottom of the first photo itself, without its caption.
  photoBottomPx?: number;
  stagePx?: number;
  // Where the flown card's slot starts; null when it has no slot on screen
  // (a phone stage that opens on another photo).
  flownTopPx?: number | null;
  // The pager: photos whose frame leaves their stage or strip frame (always 0), and the
  // first page's words against the room they have.
  pager?: { pages: number; crops: number; textPx: number; wordsPx: number };
  panelPx?: number;
};

type Options = { phone: boolean; pager: boolean; frame: Frame; card: LabCard; firstStagePhoto: number | undefined; settingsKey: string; delayMs: number; onMeasure: (measure: Measure) => void };

export function useGalleryMeasure(rootRef: RefObject<HTMLElement | null>, { phone, pager, frame, card, firstStagePhoto, settingsKey, delayMs, onMeasure }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>("[data-gallery-dialog]");
    if (!root || !scroller) return;
    const measure = () => {
      const top = scroller.getBoundingClientRect().top - scroller.scrollTop * frame.scale;
      const local = (y: number) => (y - top) / frame.scale;
      const size = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().height / frame.scale : 0);
      const flown = root.querySelector<HTMLElement>("[data-tile-slot]");
      const flownTopPx = flown ? Math.round(local(flown.getBoundingClientRect().top)) : undefined;
      const panel = root.closest<HTMLElement>("[data-gallery-panel]");
      const panelPx = panel ? Math.round(panel.getBoundingClientRect().width / frame.scale) : undefined;
      if (!phone) {
        const firstRow = root.querySelector<HTMLElement>("[data-row]");
        const bottom = firstRow ? local(firstRow.getBoundingClientRect().bottom) : 0;
        const text = root.querySelector<HTMLElement>('[data-row="pair"] > [data-mask^="block-"], [data-row="photo"] [data-text-column]');
        const firstPhoto = firstRow?.querySelector<HTMLElement>("[data-photo-frame] > div");
        onMeasure({
          mode: "desktop",
          foldPx: frame.height,
          keyBottomPx: Math.round(bottom),
          fits: bottom <= frame.height,
          textColumnPx: text ? Math.round(text.getBoundingClientRect().width / frame.scale) : undefined,
          photoBottomPx: firstPhoto ? Math.round(local(firstPhoto.getBoundingClientRect().bottom)) : undefined,
          flownTopPx,
          panelPx,
        });
        return;
      }
      if (pager) {
        const pages = [...root.querySelectorAll<HTMLElement>("[data-pager-page]")];
        let crops = 0;
        const outside = (photo: DOMRect, box: DOMRect) => photo.top < box.top - 0.5 || photo.bottom > box.bottom + 0.5 || photo.left < box.left - 0.5 || photo.right > box.right + 0.5;
        for (const page of pages) {
          // Every photo the stage draws (a turning group's too), and every
          // photo in a strip against its own frame.
          const stage = page.querySelector("[data-pager-stage]");
          const box = stage?.getBoundingClientRect();
          if (stage && box) for (const photo of stage.querySelectorAll("[data-photo-frame]")) if (outside(photo.getBoundingClientRect(), box)) crops++;
          for (const frame of page.querySelectorAll("[data-strip-frame]")) {
            const photo = frame.querySelector("[data-photo-frame]");
            if (photo && outside(photo.getBoundingClientRect(), frame.getBoundingClientRect())) crops++;
          }
        }
        const controls = root.querySelector<HTMLElement>("[data-pager-controls]");
        const bottom = controls ? local(controls.getBoundingClientRect().bottom) : 0;
        const text = pages[0]?.querySelector<HTMLElement>("[data-pager-text]");
        onMeasure({
          mode: "phone",
          foldPx: frame.height,
          keyBottomPx: Math.round(bottom),
          fits: bottom <= frame.height && crops === 0,
          stagePx: Math.round(size(pages[0]?.querySelector("[data-pager-stage]"))),
          flownTopPx,
          pager: { pages: pages.length, crops, textPx: Math.round(size(text)), wordsPx: Math.round(text ? text.scrollHeight : 0) },
        });
        return;
      }
      const stage = root.querySelector<HTMLElement>("[data-stage-frame]");
      const block = root.querySelector<HTMLElement>('[data-mask="block-0"] p');
      const lineHeight = block ? parseFloat(getComputedStyle(block).lineHeight) || 24 : 24;
      const secondLine = block ? local(block.getBoundingClientRect().top) + 2 * lineHeight : 0;
      const flownOnStage = card.flownPhoto !== undefined && firstStagePhoto === card.flownPhoto;
      onMeasure({
        mode: "phone",
        foldPx: frame.height,
        keyBottomPx: Math.round(secondLine),
        fits: secondLine <= frame.height,
        stagePx: stage ? Math.round(size(stage)) : undefined,
        flownTopPx: card.flownPhoto === undefined ? flownTopPx : flownOnStage && stage ? Math.round(local(stage.getBoundingClientRect().top)) : null,
      });
    };
    const id = window.setTimeout(measure, delayMs);
    return () => window.clearTimeout(id);
  }, [rootRef, phone, pager, frame.width, frame.height, frame.scale, settingsKey, card, firstStagePhoto, delayMs, onMeasure]);
}
