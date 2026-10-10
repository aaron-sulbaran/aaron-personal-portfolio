"use client";

import { boxFor } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { slideWords, type Slide } from "@/lib/gallery/plan";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { RotatingPhoto } from "./RotatingPhoto";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// The desktop gallery (1024px and up), Aaron's pick from the gallery lab
// (round six): the header at the top left; the opening words; then every
// photo, or every group of photos taking turns, its own row with its words
// beside it, vertically centred, the sides alternating from the left; then the
// closing words, the mentors on Mentorship, the links and the close hint. A
// vertical photo is drawn in one box and a horizontal one in another, and a
// photo narrower than the card's photo column sits against the panel's edge,
// so the words keep one place on each side. The card picture leads the first
// row and carries the flight's slot.

type Props = { gallery: Gallery; renderMedia: boolean };

const EDGE = { left: "justify-start", right: "justify-end" } as const;

export function CardRows({ gallery, renderMedia }: Props) {
  const { plan, photos, aspects, lead, slot } = gallery;
  const box = (photo: number) => boxFor(aspects[photo], BOXES, GALLERY.wideFrom);
  const prose = (unit: number) => (
    <div key={`words-${unit}`} style={{ maxWidth: GALLERY.proseMaxWidth }}>
      <Words gallery={gallery} unit={unit} />
    </div>
  );
  const row = (slide: Slide, i: number) => {
    const side = i % 2 === 0 ? "left" : "right";
    const turns = slide.photos.length > 1;
    return (
      <div
        key={`row-${slide.photo}`}
        className={`flex items-center ${side === "right" ? "flex-row-reverse" : "flex-row"}`}
        style={{ columnGap: GALLERY.columnGap }}
        data-row="photo"
        data-side={side}
        data-turns={turns ? slide.photos.length : undefined}
      >
        <div className={`flex shrink-0 ${EDGE[side]}`} style={{ width: slot }}>
          {turns ? (
            <RotatingPhoto gallery={gallery} photos={slide.photos} boxes={slide.photos.map((photo) => box(photo))} />
          ) : (
            <StillPhoto photo={photos[slide.photo]} index={slide.photo} box={box(slide.photo)} slot={slide.photo === lead} renderMedia={slide.photo === lead ? renderMedia : true} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4" style={{ maxWidth: GALLERY.textWidth }} data-text-column="">
          {slideWords(slide).map((unit) => (
            <Words key={unit} gallery={gallery} unit={unit} />
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact={false} />
      <div className="flex flex-col" style={{ rowGap: GALLERY.rowGap }}>
        {plan.intro.map(prose)}
        {plan.slides.map(row)}
        {plan.closing.map(prose)}
        {gallery.key === "mentorship" && <MentorsList />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
