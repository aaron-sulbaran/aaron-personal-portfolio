"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GALLERY } from "@/lib/gallery/constants";

// The stage of a name tag or the post's card on a phone's pager page. Either is as tall as its words, and a short phone (Safari's 664px
// tall window, an in-app browser's) can leave a page less room than that, which would cut a tip off at the page's foot. So the stage is shrunk
// to the room from its top centre, never below GALLERY.pager.fitFloor (a tip stays readable), and has the scaled height, so the page's
// words take the rest. With the room it needs, it is not scaled at all.
export function FitStage({ room, children }: { room: number; children: ReactNode }) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState(0);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const read = () => setNatural(el.offsetHeight);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = natural > 0 && room > 0 ? Math.min(1, Math.max(GALLERY.pager.fitFloor, room / natural)) : 1;
  return (
    <div className="relative w-full shrink-0" style={{ height: natural > 0 ? natural * scale : undefined }} data-pager-stage="" data-fit-scale={scale < 1 ? scale.toFixed(3) : undefined}>
      <div ref={inner} className="flex w-full items-start justify-center" style={{ transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
