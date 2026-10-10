import Image from "next/image";
import type { Box } from "@/lib/gallery/boxes";
import type { GalleryPhoto } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { CARD_PICTURE_SIZES, galleryRowSizes } from "@/lib/photoSizes";

// A photo in its box (object-fit: cover), its caption under it. The card picture
// carries the flight's landing slot; while a flown card is parked over it the
// image stays in the page at no opacity, so its alt text is still read. Not
// draggable: a mouse drag on an image would start the browser's own drag and
// cancel the phone pager's pointer stream.
type Props = { photo: GalleryPhoto; index: number; box: Box; slot?: boolean; renderMedia?: boolean; sizes?: string; caption?: string | null };

export function StillPhoto({ photo, index, box, slot = false, renderMedia = true, sizes, caption = photo.caption }: Props) {
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-2.5" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index}>
      <div className="relative w-full" style={{ aspectRatio: `${box.width} / ${box.height}` }}>
        <div data-mask={partId.photo(index)} data-mask-kind="photo" {...(slot ? { "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
          <div data-mask-media="" className="absolute inset-0">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              quality={90}
              draggable={false}
              sizes={sizes ?? (slot ? CARD_PICTURE_SIZES : galleryRowSizes(photo.width / photo.height, box))}
              className="object-cover"
              style={{ opacity: renderMedia ? 1 : 0 }}
            />
          </div>
        </div>
      </div>
      {caption && (
        <figcaption data-mask={partId.caption(index)} data-mask-kind="text" data-mask-split="" className="font-label text-label text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
