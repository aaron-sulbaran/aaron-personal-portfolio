"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { frameState, nextFrame, POP_CYCLE_MS } from "@/lib/inline/cycle";
import type { PopCycleFrame } from "@/lib/inline/view";
// The photos of a pop that cycles (register pop.cycle; "thrill seeker" on page
// 1), one at a time in one square frame that never changes size, each with its
// own caption. While the pop is open the next photo fades in over the last every
// POP_CYCLE_MS, looping; the timer stops the moment the pop closes, and
// TipBubble gives each open a fresh instance, so it always starts from the first
// photo. Every photo is a real image from the start (eager), stacked, so a change
// is only an opacity change: the fade is app/globals.css's, and under reduced
// motion the same change is an instant swap on the same beat. The captions sit in
// one grid cell, so the tallest sets the card's height and no photo changes it.
export function PopCycle({ frames, live }: { frames: readonly PopCycleFrame[]; live: boolean }) {
  const [step, setStep] = useState({ active: 0, previous: -1 });
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setStep(({ active }) => ({ active: nextFrame(active, frames.length), previous: active })), POP_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [live, frames.length]);
  return (
    <>
      <span className="pop-frame pop-cycle rounded-lg">
        {frames.map(({ photo }, index) => (
          <Image key={photo.src} src={photo.src} alt={photo.alt} fill sizes={photo.sizes} loading="eager" data-state={frameState(index, step.active, step.previous)}
            style={photo.focus ? { objectPosition: `${photo.focus.x}% ${photo.focus.y}%` } : undefined} className="pop-cycle-photo object-cover" />
        ))}
      </span>
      {frames.some((frame) => frame.caption) && (
        <span className="pop-captions px-1 font-label text-label-sm leading-snug text-muted">
          {frames.map((frame, index) => (
            <span key={frame.photo.src} data-state={frameState(index, step.active, step.previous)}>{frame.caption}</span>
          ))}
        </span>
      )}
    </>
  );
}
