import Image from "next/image";
import { siteContent } from "@/lib/content";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { partId } from "@/lib/gallery/timing";

// The pieces of a group of photos taking turns (RotatingPhoto on desktop,
// PhoneRotator in a phone page's stage): one photo's layer in the group's
// frame, centred at its own box, and the captions, every one in the same grid
// cell so the caption block is the tallest caption's height. Only the current
// layer and caption show (app/globals.css); useRotator writes the change.

type LayerProps = { gallery: Gallery; photo: number; box: Box; frame: Box; layer: number; current: boolean; sizes: string };

export function GroupLayer({ gallery, photo, box, frame, layer, current, sizes }: LayerProps) {
  const { src, alt } = gallery.photos[photo];
  return (
    <div
      className="absolute"
      style={{ left: (frame.width - box.width) / 2, top: (frame.height - box.height) / 2, width: box.width, height: box.height }}
      aria-hidden={!current}
      data-rotator-layer={layer}
      data-photo-frame={photo}
      data-current={current ? "" : undefined}
    >
      <div data-mask={partId.photo(photo)} data-mask-kind="photo" className="absolute inset-0 overflow-hidden rounded-xl">
        <div data-mask-media="" className="absolute inset-0">
          <div data-rotator-media="" className="absolute inset-0">
            <Image src={src} alt={alt} fill quality={90} draggable={false} sizes={sizes} className="object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}

type CaptionProps = { photos: readonly number[]; index: number; caption: (photo: number) => string | null };

export function GroupCaptions({ photos, index, caption }: CaptionProps) {
  return (
    <div className="grid shrink-0" data-rotator-captions="">
      {photos.map((photo, i) => {
        const text = caption(photo);
        return (
          <div key={photo} className="[grid-area:1/1]" aria-hidden={i !== index} data-rotator-caption={i} data-current={i === index ? "" : undefined}>
            {text && (
              <p data-mask={partId.caption(photo)} data-mask-kind="text" data-mask-split="" className="font-label text-label text-muted">
                {text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The current photo's fill, shared by the desktop dots and the phone marks: it
// grows over the interval while the group runs (keyed by the caller on the
// index so each photo's fill starts again) and stands full under reduced motion.
export function RotatorFill({ reduced, runs }: { reduced: boolean; runs: boolean }) {
  return (
    <span
      className="absolute inset-0 rounded-full bg-accent"
      style={reduced ? undefined : { animationDuration: `${GALLERY.rotate.intervalMs}ms`, animationPlayState: runs ? "running" : "paused" }}
      data-rotator-fill={reduced ? "still" : "timed"}
    />
  );
}

// What a screen reader hears when the photo changes; polite only while the
// group is not turning on its own.
export function RotatorAnnounce({ runs, index, count, caption }: { runs: boolean; index: number; count: number; caption?: string | null }) {
  return (
    <p className="sr-only" aria-live={runs ? "off" : "polite"}>
      {siteContent.modals.gallery.announce(index + 1, count, caption ?? "")}
    </p>
  );
}
