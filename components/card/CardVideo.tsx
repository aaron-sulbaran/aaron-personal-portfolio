"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import type { GalleryVideo } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";

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
// is mostly in view, unless it is playing or focused, its controls are attached
// again so they are laid out at the size it is drawn.
//
// A video that plays once (video.playOnce, today min/Max's answer loop, whose
// first and last frames differ, so looping it would jump) plays itself, muted,
// once the card has landed and the video is mostly in view, and holds on its
// last frame; it stops where it is while it is off screen (a phone's pager page
// turned away from) and goes on when it is back. Each open of the card is a
// fresh video, so it plays again then, and its own controls replay it. Under
// reduced motion it never starts by itself: the poster shows and play is on
// demand, as for every other video here.
const SEEN = 0.5;
const GONE = 0.1;
const BARS: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))" };

export function CardVideo({ video, label }: { video: GalleryVideo; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotionLive();
  const autoplay = !!video.playOnce && !reduced;
  const phase = useRef<"waiting" | "playing" | "held" | "done">("waiting");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let landed = !autoplay;
    let inView = false;
    const start = () => {
      if (!autoplay || !landed || !inView || phase.current !== "waiting") return;
      phase.current = "playing";
      element.play().catch(() => {
        phase.current = "waiting";
      });
    };
    const landing = autoplay
      ? window.setTimeout(() => {
          landed = true;
          start();
        }, GALLERY.mask.landingMs)
      : 0;
    const onEnded = () => {
      phase.current = "done";
    };
    element.addEventListener("ended", onEnded);
    // Only once it is mostly in view: a page sliding in touches the edge (an intersection of ratio 0) while it is still
    // off screen, and attaching then leaves the controls as cramped as before.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        inView = entry.isIntersecting && entry.intersectionRatio >= SEEN;
        if (autoplay && phase.current === "playing" && !element.paused && entry.intersectionRatio < GONE) {
          phase.current = "held";
          element.pause();
          return;
        }
        if (!inView) return;
        if (phase.current === "held") {
          phase.current = "playing";
          element.play().catch(() => {
            phase.current = "held";
          });
          return;
        }
        if (!element.paused || document.activeElement === element) return;
        element.controls = false;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          element.controls = true;
          start();
        });
      },
      { threshold: [GONE, SEEN, 1] },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(landing);
      element.removeEventListener("ended", onEnded);
      cancelAnimationFrame(frame);
      element.controls = true;
    };
  }, [autoplay]);
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
        preload={autoplay ? "auto" : "metadata"}
        className="block h-auto w-full"
      />
    </div>
  );
}
