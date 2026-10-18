"use client";

import { useCallback, useRef } from "react";
import { gsap } from "@/lib/quick/gsap";
import { TripBar, type TripHandle } from "./TripBar";
import type { VariantProps } from "./types";
import { useCheckpointTrack } from "./useCheckpointTrack";
import { useTrackGeometry, type TrackGeometry } from "./useTrackGeometry";
import { RAIL_X, YearList } from "./YearList";

// The rail: the line runs down the left from the first checkpoint (Next, when it
// shows) past every year's node and every tile, and fills with the accent down to where the reader is (both ways). With trip,
// the trip bar holds the whole trip at the top of the viewport and Misuki
// drives it with the reader.

export function RailVariant({ rows, next, runKey, speed, forceReduced, onOpen, trip = false }: VariantProps & { trip?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const tripRef = useRef<TripHandle>(null);
  const geometry = useTrackGeometry(trackRef, runKey);
  const lineStart = geometry?.tops[0]?.y ?? 0;
  const lineEnd = geometry?.tops.at(-1)?.y ?? 0;

  const build = useCallback((g: TrackGeometry) => {
    const path = lineRef.current;
    const start = g.tops[0]?.y ?? 0;
    const end = g.tops.at(-1)?.y ?? 0;
    if (!path || end <= start) return () => {};
    const fill = gsap.fromTo(path, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1, ease: "none", paused: true });
    return (depth: number) => fill.progress(Math.min(1, Math.max(0, (depth * g.height - start) / (end - start))));
  }, []);
  const onDepth = useCallback((depth: number, g: TrackGeometry) => tripRef.current?.drive(depth, g), []);
  useCheckpointTrack(trackRef, { geometry, runKey, speed, forceReduced, build, marks: barRef, onDepth: trip ? onDepth : undefined });

  return (
    <div>
      {trip && <TripBar ref={tripRef} rootRef={barRef} rows={rows} withNext={next !== null} reduced={forceReduced} />}
      <div ref={trackRef} className="relative">
        {geometry && lineEnd > 0 ? (
          <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={RAIL_X * 2} height={lineEnd} viewBox={`0 0 ${RAIL_X * 2} ${lineEnd}`}>
            <path d={`M${RAIL_X} ${lineStart}V${lineEnd}`} className="stroke-border" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path ref={lineRef} d={`M${RAIL_X} ${lineStart}V${lineEnd}`} className="stroke-accent" strokeWidth="4" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <span aria-hidden="true" className="absolute inset-y-0 left-6 w-1 -translate-x-1/2 rounded-full bg-border" />
        )}
        <YearList rows={rows} next={next} onOpen={onOpen} />
      </div>
    </div>
  );
}
