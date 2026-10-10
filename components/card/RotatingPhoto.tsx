"use client";

import { useState } from "react";
import { siteContent } from "@/lib/content";
import { groupFrame, type Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { galleryRowSizes } from "@/lib/photoSizes";
import { GroupCaptions, GroupLayer } from "./GroupParts";

// A row's photos taking turns in one frame beside words that never change
// (the gallery lab, rounds five and six). The frame is the group's largest
// box and each photo is drawn in its own box centred in it, so nothing changes
// size; the caption under it changes with the photo, and the dots under the
// captions say which photo shows and step to one.

type Props = { gallery: Gallery; photos: readonly number[]; boxes: readonly Box[] };

const g = siteContent.modals.gallery;

export function RotatingPhoto({ gallery, photos, boxes }: Props) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const frame = groupFrame(boxes);
  const sizesOf = (photo: number, i: number) => galleryRowSizes(gallery.photos[photo].width / gallery.photos[photo].height, boxes[i]);
  const hasCaptions = photos.some((photo) => gallery.photos[photo].caption);
  return (
    <div role="group" aria-roledescription={g.roleCarousel} aria-label={g.rotatorLabel(count)} className="flex shrink-0 flex-col gap-2.5" style={{ width: frame.width }} data-rotator="" data-rotator-index={index}>
      <div className="relative shrink-0" style={{ width: frame.width, height: frame.height }} data-rotator-frame="">
        {photos.map((photo, i) => (
          <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={sizesOf(photo, i)} />
        ))}
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={(photo) => gallery.photos[photo].caption} />}
      <div data-mask={partId.rotator(photos[0])} data-mask-kind="text" className="-ml-1 flex items-center">
        {photos.map((photo, i) => (
          <button
            key={photo}
            type="button"
            aria-label={g.photoOf(i + 1, count)}
            aria-current={i === index ? "true" : undefined}
            onClick={() => setIndex(i)}
            className="group inline-flex h-8 items-center justify-center px-1"
            data-rotator-dot={i}
          >
            <span className={i === index ? "block h-1.5 w-5 rounded-full bg-accent" : "block h-1.5 w-1.5 rounded-full bg-muted transition-colors duration-200 group-hover:bg-foreground"} />
          </button>
        ))}
      </div>
    </div>
  );
}
