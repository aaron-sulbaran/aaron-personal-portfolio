"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { LAB_COPY, type LabCard } from "./cards";
import { PagerStrip } from "./PagerStrip";
import { PhoneRotator } from "./PhoneRotator";
import { slideText, type Page, type StageKind } from "./plan";
import { Caption, Links, Note, TextBlock } from "./parts";
import { gallerySizes, type Box } from "./rows";
import type { Settings } from "./settings";
import { partId } from "./timing";

// One page of the pager: the stage, exactly as tall as what it draws fitted
// whole, the caption, then the words in their own area, which scrolls only
// when they are longer than the room (a soft fade at its foot says so).
// Round six: the stage holds one photo, or (A) a group taking turns; a
// wordless page (B) is a photo and its caption alone; (C) puts the rest of
// a group in a strip under the words. Pages off screen are inert and hidden
// from assistive tech.

// `repeated`: blocks an earlier page already shows (round five's group
// pages), which take a mask id of this page's own.
type Props = {
  card: LabCard;
  page: Page;
  index: number;
  count: number;
  kind: StageKind;
  stage: { photos: number[]; frame: Box; boxes: Box[] };
  strip: { photos: number[]; itemWidth: number; height: number; boxes: Box[] } | null;
  stripGap: number;
  current: boolean;
  innerWidth: number;
  aspects: number[];
  repeated: number[];
  s: Settings;
  reduced: boolean;
  pressing: boolean;
  scale: number;
  runKey: string;
};

export function PagerPage({ card, page, index, count, kind, stage, strip, stripGap, current, innerWidth, aspects, repeated, s, reduced, pressing, scale, runKey }: Props) {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  const { blocks, note } = slideText(page);
  const beforeCount = page.before.length;
  const maskId = (b: number) => (repeated.includes(b) ? `${partId.block(b)}-page-${index}` : undefined);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const read = () => setScrolls(text.scrollHeight > text.clientHeight + 1);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(text);
    if (text.firstElementChild) observer.observe(text.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={LAB_COPY.pageLabel(index + 1, count)}
      aria-hidden={!current}
      inert={!current}
      className="flex h-full w-full shrink-0 flex-col gap-3"
      data-pager-page={index}
      data-stage-kind={kind}
      data-wordless={page.wordless ? "" : undefined}
    >
      {kind === "turns" ? (
        // A replay or a new start delay starts the turns over from the first photo.
        <PhoneRotator
          key={`${runKey}|${s.rotateDelayMs}`}
          card={card}
          photos={stage.photos}
          frame={stage.frame}
          boxes={stage.boxes}
          aspects={aspects}
          innerWidth={innerWidth}
          s={s}
          reduced={reduced}
          active={current}
          pressing={pressing}
          scale={scale}
        />
      ) : (
        <StillStage card={card} photo={stage.photos[0]} box={stage.frame} aspect={aspects[stage.photos[0]]} innerWidth={innerWidth} />
      )}
      {!page.wordless && (
        <div
          ref={textRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrolls ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]" : ""}`}
          style={{ touchAction: scrolls ? "pan-y" : "none" }}
          data-pager-text=""
          data-scrolls={scrolls ? "" : undefined}
        >
          <div className="flex flex-col gap-4 pb-6">
            {blocks.slice(0, beforeCount).map((b) => (
              <TextBlock key={b} card={card} block={b} compact maskId={maskId(b)} />
            ))}
            {note && <Note photo={card.photos[page.photo]} index={page.photo} compact />}
            {blocks.slice(beforeCount).map((b) => (
              <TextBlock key={b} card={card} block={b} compact maskId={maskId(b)} />
            ))}
            {kind === "strip" && strip && <PagerStrip card={card} photos={strip.photos} layout={strip} aspects={aspects} gap={stripGap} wordsScroll={scrolls} />}
            {page.links && <Links card={card} />}
          </div>
        </div>
      )}
    </div>
  );
}

// One photo standing in its stage, on the stage's floor, its caption under it.
function StillStage({ card, photo: index, box, aspect, innerWidth }: { card: LabCard; photo: number; box: Box; aspect: number; innerWidth: number }) {
  const photo = card.photos[index];
  const caption = photo.captionShort ?? photo.caption;
  const flown = index === card.flownPhoto;
  // The stand-ins are cropped to the real photo's shape. A vertical stand-in
  // in a horizontal slot loses its top at a centred crop, which reads as the
  // stage cropping the photo; the real photo is that shape and loses nothing,
  // so the stand-in's crop keeps the top, where the faces are.
  const standInTop = photo.width / photo.height < aspect - 0.01;
  return (
    <>
      <div className="relative w-full shrink-0" style={{ height: box.height }} data-pager-stage="">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: box.width, height: box.height }} data-photo-frame={index}>
          <div data-mask={partId.photo(index)} data-mask-kind="photo" {...(flown ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
            <div data-mask-media="" className="absolute inset-0">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                quality={90}
                draggable={false}
                sizes={gallerySizes(photo.width / photo.height, aspect, innerWidth)}
                className={`object-cover ${standInTop ? "object-[50%_18%]" : ""}`}
              />
            </div>
          </div>
        </div>
      </div>
      {caption && <Caption id={partId.caption(index)} text={caption} className="shrink-0" />}
    </>
  );
}
