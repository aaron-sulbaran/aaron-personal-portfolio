"use client";

import { useCallback, useRef } from "react";
import { gsap } from "@/lib/quick/gsap";
import { lanePath, lanePoints, laneSamples, lengthAtY, type LaneSamples } from "@/lib/quick/road";
import { CLOSE_KEY } from "@/lib/quick/years";
import { MISUKI_BOX, MisukiShape } from "./Misuki";
import type { VariantProps } from "./types";
import { useCheckpointTrack } from "./useCheckpointTrack";
import { useTrackGeometry, type TrackGeometry } from "./useTrackGeometry";
import { RAIL_X, YearList } from "./YearList";

// The rail as a road: the line becomes a narrow lane that runs straight
// through every year's node and leans gently aside once between two years
// (lib/quick/road). The accent trail follows the reader both ways, as the rail's fill does;
// Misuki drives the lane with the reader, both ways, nose down the page, and
// under reduced motion she is parked at the end. She is drawn over the
// year nodes, in a second layer on the lane's own coordinates.

const LANE_PX = 10;
const CAR_PX = 56;
const REDUCE = "(prefers-reduced-motion: reduce)";

const laneTops = (g: TrackGeometry) => g.tops.filter((top) => top.key.startsWith("year-") || top.key === CLOSE_KEY).map((top) => top.y);

export function RoadVariant({ rows, closing, runKey, speed, forceReduced, onOpen }: VariantProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const carRef = useRef<SVGGElement>(null);
  const carTweenRef = useRef<gsap.core.Tween | null>(null);
  const samplesRef = useRef<LaneSamples | null>(null);
  const shownRef = useRef({ p: 0 });
  const geometry = useTrackGeometry(trackRef, runKey);
  const tops = geometry ? laneTops(geometry) : [];
  const d = tops.length ? lanePath(lanePoints(tops, RAIL_X)) : "";
  const end = tops.at(-1) ?? 0;

  const build = useCallback((g: TrackGeometry) => {
    const trail = trailRef.current;
    const car = carRef.current;
    const ys = laneTops(g);
    if (!trail || !car || !ys.length) return () => {};
    const samples = laneSamples(lanePoints(ys, RAIL_X));
    samplesRef.current = samples;
    const fill = gsap.fromTo(trail, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1, ease: "none", paused: true });
    carTweenRef.current?.kill();
    carTweenRef.current = gsap.to(car, {
      motionPath: { path: trail, align: trail, alignOrigin: [0.5, 0.5], autoRotate: true },
      duration: 1,
      ease: "none",
      paused: true,
    });
    return (depth: number) => fill.progress(lengthAtY(samples, depth * g.height));
  }, []);

  const onDepth = useCallback((depth: number, g: TrackGeometry) => {
    const samples = samplesRef.current;
    const tween = carTweenRef.current;
    if (!samples || !tween) return;
    const target = lengthAtY(samples, depth * g.height);
    gsap.killTweensOf(shownRef.current);
    if (forceReduced || window.matchMedia(REDUCE).matches) {
      shownRef.current.p = 1;
      tween.progress(1);
      return;
    }
    gsap.to(shownRef.current, { p: target, duration: 0.5, ease: "power3.out", onUpdate: () => tween.progress(shownRef.current.p) });
  }, [forceReduced]);

  useCheckpointTrack(trackRef, { geometry, runKey, speed, forceReduced, build, onDepth });

  const scale = CAR_PX / MISUKI_BOX.width;
  return (
    <div ref={trackRef} className="relative">
      {d ? (
        <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={RAIL_X * 2} height={end} viewBox={`0 0 ${RAIL_X * 2} ${end}`}>
          <path d={d} className="stroke-border" strokeWidth={LANE_PX} strokeLinecap="round" fill="none" />
          <path d={d} className="stroke-background" strokeWidth="1" strokeDasharray="4 8" fill="none" />
          <path ref={trailRef} d={d} className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      ) : (
        <span aria-hidden="true" className="absolute inset-y-0 left-6 w-2.5 -translate-x-1/2 rounded-full bg-border" />
      )}
      <YearList rows={rows} closing={closing} onOpen={onOpen} />
      {d && (
        <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={RAIL_X * 2} height={end} viewBox={`0 0 ${RAIL_X * 2} ${end}`}>
          <g ref={carRef} className="text-foreground">
            <g transform={`scale(${scale})`}>
              <MisukiShape />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
