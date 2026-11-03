"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { focusOf, type Box, type StageBox } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { slideWords, type Page, type StageKind } from "@/lib/gallery/plan";
import { END, mentorId, type Trims } from "@/lib/gallery/paginate";
import { partId } from "@/lib/gallery/timing";
import { PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { afterWords } from "./afterWords";
import { CardLinks } from "./CardLinks";
import { FitStage } from "./FitStage";
import { MentorsList } from "./MentorsList";
import { PhoneRotator } from "./PhoneRotator";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// One page of the phone pager (the gallery lab's round six): the stage, as
// tall as the pager gave it and exactly as tall as what it draws (a photo
// whole, or on a short stage kept at a readable width and cropped about its
// subject); the caption; then the words in their own area, with the mentors
// (a block each) and the links after the last of them. Every page has a photo
// and words (lib/gallery/paginate): a photo carried onto a page after its own
// is drawn again with no caption and no mask of its own. The words area
// scrolls, behind a soft fade at its foot, only for one paragraph taller than a
// whole page with nothing left to drop (a very short window). A page with no
// words (a name tag with its tip inside it) centres its stage in the page, since
// nothing is under it: at the top it left half a tall phone's page empty. A page
// that is not current is inert and hidden from assistive tech.
// No page carries the flight's slot (a flown card parks on the header's tile,
// which stays put while the pages turn), so every photo draws itself.

type Stage = { photos: readonly number[]; frame: Box; boxes: readonly StageBox[] };
type Props = { gallery: Gallery; page: Page; index: number; count: number; kind: StageKind; stage: Stage; trims: Trims; current: boolean; pressing: boolean };

const g = siteContent.modals.gallery;
const fade = `linear-gradient(to bottom, black calc(100% - ${GALLERY.pager.wordsFadePx}px), transparent)`;
const WORDS_FADE: CSSProperties = { maskImage: fade, WebkitMaskImage: fade };

export function PagerPage({ gallery, page, index, count, kind, stage, trims, current, pressing }: Props) {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  // The post's own link is the post card's, so the card's link to it is not drawn a second time on a page beside the card. The end block
  // (the card's links) is drawn only when it has something in it: an empty one would still cost a gap. Mentorship's mentors are a block each
  // after the words: the pager says which sit on this page (page.mentors); until it has measured, the page that has the links has them all.
  const embed = gallery.photos[page.photo].embed;
  const skip = embed ? embed.card.href : undefined;
  const links = siteContent.cards[gallery.key].modal.links.filter((link) => link.href !== skip);
  const mentors = gallery.key === "mentorship" ? page.mentors ?? (page.links ? siteContent.cards.mentorship.mentors.people.map((_, i) => i) : []) : [];
  const hasEnd = page.links && links.length > 0;

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    // The words' own height, less the padding they take only while they scroll, so words laid out to fit are never held scrolling by it.
    const read = () => {
      const inner = text.firstElementChild as HTMLElement | null;
      const words = inner ? inner.offsetHeight - parseFloat(getComputedStyle(inner).paddingBottom || "0") : text.scrollHeight;
      setScrolls(words > text.clientHeight + 1);
    };
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
      className={`flex h-full w-full shrink-0 flex-col gap-3 ${page.wordless ? "justify-center" : ""}`}
      data-pager-page={index}
      data-unit={page.unit ?? index}
      data-stage-kind={kind}
      data-wordless={page.wordless ? "" : undefined}
      data-carried={page.carried ? "" : undefined}
    >
      {kind === "turns" ? (
        <PhoneRotator gallery={gallery} photos={stage.photos} frame={stage.frame} boxes={stage.boxes} active={current} pressing={pressing} />
      ) : (
        <StillStage gallery={gallery} photo={page.photo} box={stage.boxes[0]} height={stage.frame.height} carried={!!page.carried} />
      )}
      {!page.wordless && (
        <div
          ref={textRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ touchAction: scrolls ? "pan-y" : "none", ...(scrolls ? WORDS_FADE : {}) }}
          data-pager-text=""
          data-scrolls={scrolls ? "" : undefined}
        >
          {/* The words as blocks the pager can measure (data-block: each paragraph with what follows it, each mentor, then the end block); gap-4 is GALLERY.pager.blockGapPx, and pb-6 (endPadPx) clears the fade only on words that scroll. */}
          <div className={`flex flex-col gap-4 ${scrolls ? "pb-6" : ""}`}>
            {slideWords(page).map((unit) => (
              <div key={unit} className="flex flex-col gap-4" data-block={`w${unit}`} data-trimmed={trims[unit] ? trims[unit] : undefined}>
                {/* A new paragraph element for each trim: the mask-in splits a paragraph into lines, and reverting that split restores the
                    words it was given, so a paragraph trimmed in place would come back whole. */}
                <Words key={trims[unit] ?? 0} gallery={gallery} unit={unit} compact trim={trims[unit] ?? 0} />
                {afterWords(gallery, unit, false)}
              </div>
            ))}
            {mentors.map((mentor) => (
              <div key={mentor} data-block={mentorId(mentor)}>
                <MentorsList compact only={mentor} />
              </div>
            ))}
            {hasEnd && (
              <div className="flex flex-col gap-4" data-block={END}>
                <CardLinks cardKey={gallery.key} skip={skip} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// One photo standing on its stage's floor, its caption under the stage (none when it was shown on an earlier page).
function StillStage({ gallery, photo, box, height, carried }: { gallery: Gallery; photo: number; box: StageBox; height: number; carried: boolean }) {
  const picture = gallery.photos[photo];
  const caption = carried ? null : (picture.captionShort ?? picture.caption);
  // A name tag's height is its tip's, and the post is a link card (a frame as tall as the post would scroll inside the page), so their stage
  // is as tall as the tag or the card, shrunk to the room the pager gave it when that is short (FitStage), and leaves the words the rest.
  if (picture.embed || picture.tag !== undefined) {
    return (
      <FitStage room={height}>
        <StillPhoto photo={picture} index={photo} box={box} caption={null} card />
      </FitStage>
    );
  }
  return (
    <>
      <div className="relative flex w-full shrink-0 items-end justify-center" style={{ height }} data-pager-stage="" data-cropped={box.cropped ? "" : undefined}>
        <StillPhoto photo={picture} index={photo} box={box} sizes={PAGER_PHOTO_SIZES} caption={null} position={focusOf(picture.focus)} mask={!carried} />
      </div>
      {caption && (
        <p data-mask={partId.caption(photo)} data-mask-kind="text" data-mask-split="" className="shrink-0 font-label text-label text-muted">
          {caption}
        </p>
      )}
    </>
  );
}
