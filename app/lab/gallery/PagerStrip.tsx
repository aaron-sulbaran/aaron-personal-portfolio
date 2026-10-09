"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { coverScale } from "@/lib/photoSizes";
import { LAB_COPY, type LabCard } from "./cards";
import { Caption } from "./parts";
import type { Box } from "./rows";
import { partId } from "./timing";

// Round six on a phone, C: under a page's words, the rest of its group as a
// strip of smaller frames, two whole and a third peeking, each photo fitted
// whole inside its frame on one floor with its caption under it. A strip
// with more than fits scrolls sideways on its own (a finger moves it; the
// pager moves it for a mouse) and snaps to a frame; on a strip that fits, a
// sideways swipe turns the page as it does anywhere else.

type Props = {
  card: LabCard;
  photos: number[];
  layout: { itemWidth: number; height: number; boxes: Box[] };
  aspects: number[];
  gap: number;
  // The words around it scroll, so a vertical drag on the strip is theirs.
  wordsScroll: boolean;
};

export function PagerStrip({ card, photos, layout, aspects, gap, wordsScroll }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const touchAction = overflows ? (wordsScroll ? "pan-x pan-y" : "pan-x") : wordsScroll ? "pan-y" : "none";

  return (
    <div
      ref={ref}
      role="region"
      aria-label={LAB_COPY.morePhotos(photos.length)}
      tabIndex={overflows ? 0 : undefined}
      className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ columnGap: gap, touchAction }}
      data-pager-strip=""
      data-strip-scrolls={overflows ? "" : undefined}
    >
      {photos.map((p, i) => {
        const box = layout.boxes[i];
        const photo = card.photos[p];
        const caption = photo.captionShort ?? photo.caption;
        const standInTop = photo.width / photo.height < aspects[p] - 0.01;
        return (
          <figure key={p} className="m-0 flex shrink-0 snap-start flex-col gap-2" style={{ width: layout.itemWidth }} data-strip-item={p}>
            <div className="relative w-full" style={{ height: layout.height }} data-strip-frame="">
              <div className="absolute bottom-0 left-0" style={{ width: box.width, height: box.height }} data-photo-frame={p}>
                <div data-mask={partId.photo(p)} data-mask-kind="photo" className="absolute inset-0 overflow-hidden rounded-lg">
                  <div data-mask-media="" className="absolute inset-0">
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      quality={90}
                      draggable={false}
                      sizes={`${Math.ceil(box.width * coverScale(photo.width / photo.height, aspects[p]))}px`}
                      className={`object-cover ${standInTop ? "object-[50%_18%]" : ""}`}
                    />
                  </div>
                </div>
              </div>
            </div>
            {caption && (
              <figcaption>
                <Caption id={partId.caption(p)} text={caption} small />
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
