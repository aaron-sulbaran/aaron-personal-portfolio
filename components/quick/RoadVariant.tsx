"use client";

import { useCallback, useRef } from "react";
import { quickCopy, type QuickEntry, type QuickSign } from "@/lib/content/quick";
import { gsap } from "@/lib/quick/gsap";
import { lengthAtY, roadPoints, roadSamples } from "@/lib/quick/road";
import { ClosingSign } from "./ClosingSign";
import { EntryText, LogoThumb, PhotoThumb, SignText } from "./parts";
import { RoadArt } from "./RoadArt";
import type { VariantProps } from "./types";
import { useCheckpointTrack } from "./useCheckpointTrack";
import { useTrackGeometry, type TrackGeometry } from "./useTrackGeometry";

// The road: a winding road in a lane beside the résumé, with a stop at every
// checkpoint and a year sign at each new year, ending at the closing sign.
// Misuki drives it with the reader (MotionPath, rotating with the road) and the
// accent trail is drawn behind her. Under reduced motion she is parked at the end.

function Anchor() {
  return <span data-quick-anchor="" aria-hidden="true" className="absolute left-0 top-3 h-px w-px" />;
}

function RoadEntry({ entry }: { entry: QuickEntry }) {
  return (
    <li data-quick-key={entry.id} className="group/item relative">
      <Anchor />
      <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:justify-between">
        <EntryText entry={entry} />
        {entry.photo ? <PhotoThumb entry={entry} /> : <LogoThumb entry={entry} />}
      </div>
    </li>
  );
}

function RoadSign({ sign }: { sign: QuickSign }) {
  return (
    <li data-quick-key={sign.key} className="group/item relative">
      <Anchor />
      <div className="inline-flex rounded-md px-3 py-1.5 ring-1 ring-inset ring-accent transition-shadow duration-300 motion-reduce:transition-none group-data-[lit=false]/item:ring-border">
        <SignText sign={sign} />
      </div>
    </li>
  );
}

export function RoadVariant({ items, runKey, speed, forceReduced }: VariantProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const carRef = useRef<SVGGElement>(null);
  const geometry = useTrackGeometry(trackRef, runKey);

  const build = useCallback((g: TrackGeometry) => {
    const trail = trailRef.current;
    const car = carRef.current;
    if (!trail || !car || g.lane <= 0 || !g.tops.length) return () => {};
    const samples = roadSamples(roadPoints(g.tops.map((top) => top.y), g.lane));
    const tl = gsap.timeline({ paused: true, defaults: { ease: "none", duration: 1 } });
    tl.fromTo(trail, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%" }, 0);
    tl.to(car, { motionPath: { path: trail, align: trail, alignOrigin: [0.5, 0.72], autoRotate: true } }, 0);
    return (depth: number) => tl.progress(lengthAtY(samples, depth * g.height));
  }, []);
  useCheckpointTrack(trackRef, { geometry, runKey, speed, forceReduced, build });

  return (
    <div ref={trackRef} className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-x-10">
      <div data-quick-lane="" aria-hidden="true" className="relative">
        {geometry && geometry.lane > 0 ? (
          <RoadArt geometry={geometry} items={items} trailRef={trailRef} carRef={carRef} />
        ) : (
          <span className="absolute inset-y-0 left-1/2 w-2.5 -translate-x-1/2 rounded-full bg-border" />
        )}
      </div>
      <div>
        <ol aria-label={quickCopy.listLabel} className="flex flex-col gap-12">
          {items.map((item) => (item.kind === "entry" ? <RoadEntry key={item.key} entry={item.entry} /> : <RoadSign key={item.key} sign={item.sign} />))}
        </ol>
        <ClosingSign className="mt-20" node={<Anchor />} />
      </div>
    </div>
  );
}
