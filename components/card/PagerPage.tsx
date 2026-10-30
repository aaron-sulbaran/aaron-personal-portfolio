"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { slideWords, type Page, type StageKind } from "@/lib/gallery/plan";
import { partId } from "@/lib/gallery/timing";
import { PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { afterWords } from "./afterWords";
import { CardLinks } from "./CardLinks";
import { FitStage } from "./FitStage";
import { MentorsList } from "./MentorsList";
import { PhoneRotator } from "./PhoneRotator";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// One page of the phone pager (the gallery lab's round six): the stage,
// exactly as tall as what it draws fitted whole; the caption; then the words
// in their own area, which scrolls only when they are longer than the room (a
// soft fade at its foot says so), with the mentors and the links on the last
// page. On the jobs card a paragraph that does not fit under its stage has a
// page of its own (wordsOnly: no stage, the words and the links alone), so
// nothing scrolls inside a page there. A page that is not current is inert and
// hidden from assistive tech.
// No page carries the flight's slot (a flown card parks on the header's tile,
// which stays put while the pages turn), so every photo draws itself.

type Stage = { photos: readonly number[]; frame: Box; boxes: readonly Box[] };
type Props = { gallery: Gallery; page: Page; index: number; count: number; kind: StageKind; stage: Stage; room: number; current: boolean; pressing: boolean };

const g = siteContent.modals.gallery;
const fade = `linear-gradient(to bottom, black calc(100% - ${GALLERY.pager.wordsFadePx}px), transparent)`;
const WORDS_FADE: CSSProperties = { maskImage: fade, WebkitMaskImage: fade };

export function PagerPage({ gallery, page, index, count, kind, stage, room, current, pressing }: Props) {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  // The post's own link is the post card's, so the card's link to it is not drawn a second time on a page beside the card.
  const embed = gallery.photos[page.photo].embed;

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
      aria-roledescription={g.roleSlide}
      aria-label={g.pageLabel(index + 1, count)}
      aria-hidden={!current}
      inert={!current}
      className="flex h-full w-full shrink-0 flex-col gap-3"
      data-pager-page={index}
      data-unit={page.photo}
      data-stage-kind={kind}
      data-wordless={page.wordless ? "" : undefined}
      data-words-only={page.wordsOnly ? "" : undefined}
    >
      {page.wordsOnly ? null : kind === "turns" ? (
        <PhoneRotator gallery={gallery} photos={stage.photos} frame={stage.frame} boxes={stage.boxes} active={current} pressing={pressing} />
      ) : (
        <StillStage gallery={gallery} photo={page.photo} box={stage.boxes[0]} height={stage.frame.height} room={room} />
      )}
      {!page.wordless && (
        <div
          ref={textRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ touchAction: scrolls ? "pan-y" : "none", ...(scrolls ? WORDS_FADE : {}) }}
          data-pager-text=""
          data-scrolls={scrolls ? "" : undefined}
        >
          <div className="flex flex-col gap-4 pb-6">
            {slideWords(page).map((unit) => [<Words key={unit} gallery={gallery} unit={unit} compact />, afterWords(gallery, unit, false)])}
            {page.links && gallery.key === "mentorship" && <MentorsList compact />}
            {page.links && <CardLinks cardKey={gallery.key} skip={embed ? embed.card.href : undefined} />}
          </div>
        </div>
      )}
    </div>
  );
}

// One photo standing on its stage's floor, whole, its caption under the stage.
function StillStage({ gallery, photo, box, height, room }: { gallery: Gallery; photo: number; box: Box; height: number; room: number }) {
  const picture = gallery.photos[photo];
  const caption = picture.captionShort ?? picture.caption;
  // A name tag's height is its tip's, and the post is a link card (a frame as tall as the post would scroll inside the page), so their stage
  // is as tall as the tag or the card (shrunk to the page's room when that is short, FitStage) and leaves the words the rest; a photo stands
  // on the floor of a stage of its own height.
  if (picture.embed || picture.tag !== undefined) {
    return (
      <FitStage room={room}>
        <StillPhoto photo={picture} index={photo} box={box} caption={null} card />
      </FitStage>
    );
  }
  return (
    <>
      <div className="relative flex w-full shrink-0 items-end justify-center" style={{ height }} data-pager-stage="">
        <StillPhoto photo={picture} index={photo} box={box} sizes={PAGER_PHOTO_SIZES} caption={null} />
      </div>
      {caption && (
        <p data-mask={partId.caption(photo)} data-mask-kind="text" data-mask-split="" className="shrink-0 font-label text-label text-muted">
          {caption}
        </p>
      )}
    </>
  );
}
