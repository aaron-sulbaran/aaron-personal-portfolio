"use client";

import { useEffect, useState, type RefObject } from "react";
import { ScrollTrigger } from "@/lib/quick/gsap";

// The track as the variants draw it: its size, the lane's width (the road's
// column), and each checkpoint's centre in px from the track's top. A checkpoint
// is an element with data-quick-key; its centre is its first displayed
// data-quick-anchor child's (a variant may show a different one per breakpoint),
// or its own. Measured after mount and whenever the track resizes, so the server
// markup never waits on it.

export interface TrackGeometry {
  width: number;
  height: number;
  lane: number;
  tops: { key: string; y: number }[];
}

function measure(track: HTMLElement): TrackGeometry {
  const box = track.getBoundingClientRect();
  const tops = [...track.querySelectorAll<HTMLElement>("[data-quick-key]")].map((item) => {
    const anchor = [...item.querySelectorAll<HTMLElement>("[data-quick-anchor]")].find((el) => el.getClientRects().length > 0) ?? item;
    const rect = anchor.getBoundingClientRect();
    return { key: item.dataset.quickKey ?? "", y: Math.round(rect.top + rect.height / 2 - box.top) };
  });
  const lane = track.querySelector<HTMLElement>("[data-quick-lane]")?.getBoundingClientRect().width ?? 0;
  return { width: Math.round(box.width), height: Math.round(box.height), lane: Math.round(lane), tops };
}

const sameGeometry = (a: TrackGeometry, b: TrackGeometry) => JSON.stringify(a) === JSON.stringify(b);

export function useTrackGeometry(trackRef: RefObject<HTMLElement | null>, layoutKey: string): TrackGeometry | null {
  const [geometry, setGeometry] = useState<TrackGeometry | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure(track);
        setGeometry((prev) => (prev && sameGeometry(prev, next) ? prev : next));
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(track);
    const pending = [...track.querySelectorAll("img")].filter((img) => !img.complete);
    const loaded = () => {
      update();
      ScrollTrigger.refresh();
    };
    for (const img of pending) img.addEventListener("load", loaded, { once: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const img of pending) img.removeEventListener("load", loaded);
    };
  }, [trackRef, layoutKey]);

  return geometry;
}
