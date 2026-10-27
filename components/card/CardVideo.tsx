"use client";

import { useEffect, useRef } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// A card's demo video (today Muse Friends, beside the Hackathons card's HackTX
// paragraph; the file, poster and label are the card's content, lib/content/cards.ts).
// Native controls, muted, never autoplaying, its poster until it is played, and
// only its metadata fetched before that. It fills the words' column, keeps its
// own shape (the width and height hold its box before the poster arrives), and is
// drawn as the modal's photos are, rounded, with the card shadow token. It masks
// in with its paragraph (lib/gallery/steps).
//
// Chrome lays out its native controls once and does not redo it while the video is
// off screen, so a video on a phone pager page that is not the current one showed
// a control bar a few pixels wide when turned to. Each time the video comes into
// view, unless it is playing or focused, its controls are attached again so they
// are laid out at the size it is drawn.
export function CardVideo({ cardKey }: { cardKey: CardKey }) {
  const video = siteContent.cards[cardKey].modal.video;
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
  if (!video) return null;
  return (
    <figure data-mask={partId.video} data-mask-kind="photo" data-card-video="" className="m-0 w-full rounded-xl [box-shadow:var(--shadow-card)]">
      <div data-mask-media="" className="overflow-hidden rounded-xl">
        <video
          ref={ref}
          src={video.src}
          poster={video.poster}
          width={video.width}
          height={video.height}
          aria-label={video.label}
          controls
          playsInline
          muted
          preload="metadata"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  );
}
