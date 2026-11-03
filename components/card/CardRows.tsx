"use client";

import { rowBox } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { slideWords, type Slide } from "@/lib/gallery/plan";
import { CardEgg } from "./CardEgg";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { RotatingPhoto } from "./RotatingPhoto";
import { StillPhoto } from "./StillPhoto";
import { afterWords } from "./afterWords";
import { TalosTeam } from "./TalosTeam";
import { Words } from "./Words";

// The desktop gallery (1024px and up), Aaron's pick from the gallery lab
// (round six): the header at the top left; the opening words; then every
// photo, or every group of photos taking turns, its own row with its words
// beside it, vertically centred, the sides alternating from the left; then the
// closing words, the mentors on Mentorship (Talos's sting and Discord channel among its
// paragraphs, its team after them), This site's easter egg line, the links and the close hint. A card's demo video is a row's media like a photo (lib/gallery/card). A
// vertical photo is drawn in one box and a horizontal one in another, and a
// photo narrower than the card's photo column sits against the panel's edge,
// so the words keep one place on each side. A card with no photos has no rows,
// so its paragraphs sit a reading rhythm apart (GALLERY.proseGap), not a row's. The card picture leads the first
// row and carries the flight's slot.

type Props = { gallery: Gallery; renderMedia: boolean; flying: boolean; onClose: () => void };

const EDGE = { left: "justify-start", right: "justify-end" } as const;

export function CardRows({ gallery, renderMedia, flying, onClose }: Props) {
  const { plan, photos, aspects, lead, slot } = gallery;
  // The card picture is always the vertical box (3:4), so the flown card fits it exactly.
  const box = (photo: number) => gallery.boxes?.[photo] ?? (photo === lead ? BOXES.vertical : rowBox(aspects[photo], BOXES, GALLERY.wideFrom, GALLERY.rowMaxCrop));
  const prose = (unit: number) => (
    <div key={`words-${unit}`} className={gallery.key === "talos" ? "flex flex-col" : undefined} style={{ maxWidth: GALLERY.proseMaxWidth, rowGap: GALLERY.proseGap }}>
      <Words gallery={gallery} unit={unit} />
      {afterWords(gallery, unit, flying)}
    </div>
  );
  const row = (slide: Slide, i: number) => {
    const side = i % 2 === 0 ? "left" : "right";
    const turns = slide.photos.length > 1 && !slide.together;
    return (
      <div
        key={`row-${slide.photo}`}
        className={`flex items-center ${side === "right" ? "flex-row-reverse" : "flex-row"}`}
        style={{ columnGap: GALLERY.columnGap }}
        data-row="photo"
        data-side={side}
        data-turns={turns && !slide.together ? slide.photos.length : undefined}
      >
        <div className={`flex shrink-0 ${EDGE[side]}`} style={{ width: slot }}>
          {slide.together ? (
            // A cluster: the row's pieces side by side, all in view, never taking turns (lib/gallery/jobs); more than two wrap
            // after the second into a 2 by 2 block, its second line under its first.
            <div
              className="flex flex-wrap items-start"
              style={{ columnGap: GALLERY.cluster.gap, rowGap: GALLERY.cluster.gap, ...(slide.photos.length > 2 ? { maxWidth: GALLERY.cluster.itemWidth * 2 + GALLERY.cluster.gap } : {}) }}
              data-cluster={slide.photos.length}
            >
              {slide.photos.map((photo) => (
                <StillPhoto key={photo} photo={photos[photo]} index={photo} box={box(photo)} />
              ))}
            </div>
          ) : turns ? (
            <RotatingPhoto gallery={gallery} photos={slide.photos} boxes={slide.photos.map((photo) => box(photo))} />
          ) : (
            <StillPhoto photo={photos[slide.photo]} index={slide.photo} box={box(slide.photo)} slot={slide.photo === lead} renderMedia={slide.photo === lead ? renderMedia : true} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4" style={{ maxWidth: GALLERY.textWidth }} data-text-column="">
          {slideWords(slide).map((unit) => [<Words key={unit} gallery={gallery} unit={unit} />, afterWords(gallery, unit, flying)])}
          {slide.aside?.map((photo) => (
            <div key={photo} className="pt-2" data-aside="">
              <StillPhoto photo={photos[photo]} index={photo} box={box(photo)} />
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact={false} />
      <div className="flex flex-col" style={{ rowGap: plan.slides.length === 0 ? GALLERY.proseGap : GALLERY.rowGap }}>
        {plan.intro.map(prose)}
        {plan.slides.map(row)}
        {plan.closing.map(prose)}
        {gallery.key === "mentorship" && <MentorsList />}
        {gallery.key === "talos" && <TalosTeam />}
        <CardEgg cardKey={gallery.key} onClose={onClose} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
