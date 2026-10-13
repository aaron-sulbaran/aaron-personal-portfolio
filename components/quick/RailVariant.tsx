"use client";

import { useCallback, useRef } from "react";
import { quickCopy, type QuickEntry, type QuickSign } from "@/lib/content/quick";
import { gsap } from "@/lib/quick/gsap";
import { ClosingSign } from "./ClosingSign";
import { EntryMark, EntryText, hasMark, PhotoThumb, SignText } from "./parts";
import { RailYear } from "./RailYear";
import type { VariantProps } from "./types";
import { useCheckpointTrack } from "./useCheckpointTrack";
import { useTrackGeometry, type TrackGeometry } from "./useTrackGeometry";

// Logo rail: the line runs down the left and its nodes are the entries' logos (a
// plain dot where there is none). The line fills with the accent as the reader
// passes, and a large year beside it (md up) ticks to the year of the item in view.

const RAIL_X = 24;
const LIT_RING = "ring-accent transition-shadow duration-300 motion-reduce:transition-none group-data-[lit=false]/item:ring-border";

function Dot({ small = false }: { small?: boolean }) {
  return (
    <span
      data-quick-anchor=""
      aria-hidden="true"
      className={`absolute left-6 -translate-x-1/2 rounded-full bg-accent ring-4 ring-background transition-colors duration-300 motion-reduce:transition-none group-data-[lit=false]/item:bg-border ${small ? "top-1.5 h-2 w-2" : "top-1 h-3.5 w-3.5"}`}
    />
  );
}

function LogoNode({ entry }: { entry: QuickEntry }) {
  const inset = entry.mark?.opaque ? "" : "p-2.5";
  return (
    <span data-quick-anchor="" aria-hidden="true" className={`absolute -top-2 left-6 flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-background ring-2 ${LIT_RING} ${inset}`}>
      <span className="flex h-full w-full items-center justify-center transition-[filter,opacity] duration-300 motion-reduce:transition-none group-data-[lit=false]/item:opacity-50 group-data-[lit=false]/item:grayscale">
        <EntryMark node entry={entry} sizes="48px" />
      </span>
    </span>
  );
}

function RailEntry({ entry, year }: { entry: QuickEntry; year: string }) {
  return (
    <li data-quick-key={entry.id} data-year={year} className="group/item relative pl-20">
      {hasMark(entry) ? <LogoNode entry={entry} /> : <Dot />}
      <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:justify-between">
        <EntryText entry={entry} />
        <PhotoThumb entry={entry} />
      </div>
    </li>
  );
}

function RailSign({ sign, year }: { sign: QuickSign; year: string }) {
  return (
    <li data-quick-key={sign.key} data-year={year} className="group/item relative pl-20">
      <Dot small />
      <SignText sign={sign} />
    </li>
  );
}

export function RailVariant({ items, runKey, speed, forceReduced }: VariantProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const geometry = useTrackGeometry(trackRef, runKey);
  const lineEnd = geometry?.tops.at(-1)?.y ?? 0;

  const build = useCallback((g: TrackGeometry) => {
    const path = lineRef.current;
    const end = g.tops.at(-1)?.y ?? 0;
    if (!path || end <= 0) return () => {};
    const fill = gsap.fromTo(path, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1, ease: "none", paused: true });
    return (depth: number) => fill.progress(Math.min(1, (depth * g.height) / end));
  }, []);
  useCheckpointTrack(trackRef, { geometry, runKey, speed, forceReduced, build });

  return (
    <div className="md:grid md:grid-cols-[minmax(9rem,13rem)_1fr] md:gap-10">
      <div aria-hidden="true" className="hidden md:block">
        <div className="sticky top-28">
          <RailYear trackRef={trackRef} first={items[0]?.year ?? ""} runKey={runKey} speed={speed} forceReduced={forceReduced} />
        </div>
      </div>
      <div ref={trackRef} className="relative">
        {geometry && lineEnd > 0 ? (
          <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={RAIL_X * 2} height={lineEnd} viewBox={`0 0 ${RAIL_X * 2} ${lineEnd}`}>
            <path d={`M${RAIL_X} 0V${lineEnd}`} className="stroke-border" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path ref={lineRef} d={`M${RAIL_X} 0V${lineEnd}`} className="stroke-accent" strokeWidth="4" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <span aria-hidden="true" className="absolute inset-y-0 left-6 w-1 -translate-x-1/2 rounded-full bg-border" />
        )}
        <ol aria-label={quickCopy.listLabel} className="relative flex flex-col gap-12">
          {items.map((item) =>
            item.kind === "entry" ? <RailEntry key={item.key} entry={item.entry} year={item.year} /> : <RailSign key={item.key} sign={item.sign} year={item.year} />,
          )}
        </ol>
        <ClosingSign className="mt-20 pl-20" node={<Dot />} />
      </div>
    </div>
  );
}
