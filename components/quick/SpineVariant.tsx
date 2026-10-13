"use client";

import { useCallback, useRef } from "react";
import { quickCopy, type QuickEntry, type QuickSign } from "@/lib/content/quick";
import { gsap } from "@/lib/quick/gsap";
import { ClosingSign } from "./ClosingSign";
import { EntryText, LogoThumb, PhotoThumb, SignText } from "./parts";
import type { VariantProps } from "./types";
import { useCheckpointTrack } from "./useCheckpointTrack";
import { useTrackGeometry, type TrackGeometry } from "./useTrackGeometry";

// Drawn spine: a centre line that DrawSVG draws down to the reader's high water,
// nodes that fill as it reaches them, entries alternating left and right from md
// up and in one column beside the line on phones. Signs sit on the line.

const LINE_X = "left-4 md:left-1/2";

function Node({ className = "", small = false }: { className?: string; small?: boolean }) {
  const size = small ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  return (
    <span
      data-quick-anchor=""
      aria-hidden="true"
      className={`absolute -translate-x-1/2 rounded-full bg-accent ring-4 ring-background transition-colors duration-300 motion-reduce:transition-none group-data-[lit=false]/item:bg-background group-data-[lit=false]/item:shadow-[inset_0_0_0_2px_var(--color-border)] ${size} ${className}`}
    />
  );
}

function SpineEntry({ entry, left }: { entry: QuickEntry; left: boolean }) {
  return (
    <li data-quick-key={entry.id} className={`group/item relative pl-12 md:w-1/2 ${left ? "md:pl-0 md:pr-12" : "md:ml-auto md:pl-12"}`}>
      <Node className={`top-1.5 left-4 ${left ? "md:left-full" : "md:left-0"}`} />
      <div className={`flex flex-col-reverse items-start gap-4 ${left ? "md:flex-row md:justify-between" : "md:flex-row-reverse md:justify-end"}`}>
        <EntryText entry={entry} />
        {entry.photo ? <PhotoThumb entry={entry} /> : <LogoThumb entry={entry} />}
      </div>
    </li>
  );
}

function SpineSign({ sign }: { sign: QuickSign }) {
  return (
    <li data-quick-key={sign.key} className="group/item relative pl-12 md:pl-0 md:text-center">
      <Node small className="top-1.5 left-4 md:hidden" />
      <div
        data-quick-anchor=""
        className="md:relative md:inline-block md:rounded-full md:bg-background md:px-4 md:py-1.5 md:ring-1 md:ring-inset md:ring-accent md:transition-shadow md:duration-300 motion-reduce:transition-none md:group-data-[lit=false]/item:ring-border"
      >
        <SignText sign={sign} />
      </div>
    </li>
  );
}

export function SpineVariant({ items, runKey, speed, forceReduced }: VariantProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const geometry = useTrackGeometry(trackRef, runKey);
  const lineEnd = geometry?.tops.at(-1)?.y ?? 0;

  const build = useCallback((g: TrackGeometry) => {
    const path = lineRef.current;
    const end = g.tops.at(-1)?.y ?? 0;
    if (!path || end <= 0) return () => {};
    const draw = gsap.fromTo(path, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1, ease: "none", paused: true });
    return (depth: number) => draw.progress(Math.min(1, (depth * g.height) / end));
  }, []);
  useCheckpointTrack(trackRef, { geometry, runKey, speed, forceReduced, build });

  const entryIndex = new Map(items.filter((item) => item.kind === "entry").map((item, i) => [item.key, i]));
  return (
    <div ref={trackRef} className="relative">
      {geometry && lineEnd > 0 ? (
        <svg aria-hidden="true" className={`pointer-events-none absolute top-0 -translate-x-1/2 overflow-visible ${LINE_X}`} width="4" height={lineEnd} viewBox={`0 0 4 ${lineEnd}`}>
          <path d={`M2 0V${lineEnd}`} className="stroke-border" strokeWidth="2" fill="none" />
          <path ref={lineRef} d={`M2 0V${lineEnd}`} className="stroke-accent" strokeWidth="2" fill="none" />
        </svg>
      ) : (
        <span aria-hidden="true" className={`absolute inset-y-0 w-0.5 -translate-x-1/2 bg-border ${LINE_X}`} />
      )}
      <ol aria-label={quickCopy.listLabel} className="relative flex flex-col gap-12 md:gap-14">
        {items.map((item) => {
          if (item.kind === "sign") return <SpineSign key={item.key} sign={item.sign} />;
          return <SpineEntry key={item.key} entry={item.entry} left={(entryIndex.get(item.key) ?? 0) % 2 === 0} />;
        })}
      </ol>
      <ClosingSign centered className="mt-20 pl-12 md:mx-auto md:max-w-xl md:pl-0 md:pt-10" node={<Node className="top-1.5 left-4 md:left-1/2 md:top-0" />} />
    </div>
  );
}
