import Image from "next/image";
import type { Box } from "@/lib/gallery/boxes";
import type { GalleryPhoto } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { CARD_PICTURE_SIZES, galleryRowSizes } from "@/lib/photoSizes";
import { CardVideo } from "./CardVideo";
import { JobTag } from "./JobTag";
import { LinkedInEmbed } from "./LinkedInEmbed";
import { PostCard } from "./PostCard";
import { EMBED_BORDER } from "@/lib/gallery/jobs";

// A photo in its box (object-fit: cover), its caption under it. The card picture
// carries the flight's landing slot; while a flown card is parked over it the
// image stays in the page at no opacity, so its alt text is still read. Not
// draggable: a mouse drag on an image would start the browser's own drag and
// cancel the phone pager's pointer stream. A card's demo video is drawn in the
// same frame in the image's place (photo.video, components/card/CardVideo). A post is its embedded frame, or with `card` (a phone's
// pager page, which has no room for the frame) a link card (components/card/PostCard). On a phone's page, position keeps a cropped
// photo's subject in view (lib/content/media), and a photo drawn again on a later page (carried) has no mask of its own (mask false).
type Props = { photo: GalleryPhoto; index: number; box: Box; slot?: boolean; renderMedia?: boolean; sizes?: string; caption?: string | null; card?: boolean; position?: string; mask?: boolean };

export function StillPhoto({ photo, index, box, slot = false, renderMedia = true, sizes, caption = photo.caption, card = false, position, mask = true }: Props) {
  // The jobs card's other two kinds of media sit in the same stagger: a name tag (its height is its own, set by its tip) and
  // the embedded post (the photos' radius and a hairline border around the frame, drawn outside the post's own pixels).
  if (photo.tag !== undefined) {
    return (
      <figure className="m-0 flex shrink-0 flex-col" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index} data-media="tag">
        <div data-mask={partId.photo(index)} data-mask-kind="photo" className="overflow-hidden rounded-xl">
          <div data-mask-media="">
            <JobTag job={photo.tag} />
          </div>
        </div>
      </figure>
    );
  }
  if (photo.embed && card) {
    return (
      <figure className="m-0 flex shrink-0 flex-col" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index} data-media="post-card">
        <div data-mask={partId.photo(index)} data-mask-kind="photo" className="overflow-hidden rounded-xl">
          <div data-mask-media="">
            <PostCard card={photo.embed.card} />
          </div>
        </div>
      </figure>
    );
  }
  if (photo.embed) {
    return (
      <figure className="m-0 flex shrink-0 flex-col" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index} data-media="embed">
        <div data-mask={partId.photo(index)} data-mask-kind="photo" className="overflow-hidden rounded-xl border border-border bg-background" style={{ borderWidth: EMBED_BORDER }}>
          <div data-mask-media="">
            <LinkedInEmbed embed={photo.embed} />
          </div>
        </div>
      </figure>
    );
  }
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-2.5" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index}>
      <div className="relative w-full" style={{ aspectRatio: `${box.width} / ${box.height}` }}>
        <div {...(mask ? { "data-mask": partId.photo(index), "data-mask-kind": "photo" } : {})} {...(slot ? { "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
          <div {...(mask ? { "data-mask-media": "" } : {})} className="absolute inset-0">
            {photo.video ? (
              <CardVideo video={photo.video} label={photo.alt} />
            ) : (
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                quality={90}
                draggable={false}
                sizes={sizes ?? (slot ? CARD_PICTURE_SIZES : galleryRowSizes(photo.width / photo.height, box))}
                className="object-cover"
                style={{ opacity: renderMedia ? 1 : 0, ...(position ? { objectPosition: position } : {}) }}
              />
            )}
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
