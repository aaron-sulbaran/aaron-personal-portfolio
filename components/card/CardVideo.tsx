"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { GalleryVideo } from "@/lib/gallery/card";

// A card's demo video (today Muse Friends, beside the Hackathons card's HackTX
// paragraph; the file, poster and label are the card's content,
// lib/content/cards.ts), drawn in the media slot a photo takes, inside
// StillPhoto's frame: the same 4:3 box, radius and (lack of) shadow as the
// photos. The demo is 16:9 and a 4:3 centre crop would cut its mascots and its
// first headline, so it is letterboxed: the 16:9 video at the frame's width,
// centred, with the bars a few percent off the page's surface, so the frame
// still reads 4:3 on either theme (colour from the tokens, mixed). Native
// controls, muted, never autoplaying, its poster until it is played, and only
// its metadata fetched before that. The frame's mask-in wipes it like a photo.
//
// Chrome lays out its native controls once and does not redo it while the video
// is off screen, so a video on a phone pager page that is not the current one
// showed a control bar a few pixels wide when turned to. Each time the video
// comes into view, unless it is playing or focused, its controls are attached
// again so they are laid out at the size it is drawn.
const BARS: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))" };

export function CardVideo({ video, label }: { video: GalleryVideo; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!element.paused || document.activeElement === element) return;
      element.controls = false;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.controls = true;
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.controls = true;
    };
  }, []);
  return (
    <div data-card-video="" className="absolute inset-0 flex items-center" style={BARS}>
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        width={video.width}
        height={video.height}
        aria-label={label}
        controls
        playsInline
        muted
        preload="metadata"
        className="block h-auto w-full"
      />
    </div>
  );
}
