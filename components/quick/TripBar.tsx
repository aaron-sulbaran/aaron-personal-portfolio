"use client";

import { Flag } from "lucide-react";
import { useImperativeHandle, useRef, type Ref, type RefObject } from "react";
import { quickCopy } from "@/lib/content/quick";
import { useHeaderHidden } from "@/lib/menu";
import { gsap } from "@/lib/quick/gsap";
import { barPosition, stopAt } from "@/lib/quick/trip";
import { CLOSE_KEY, tripStops, type YearRow } from "@/lib/quick/years";
import { Misuki } from "./Misuki";
import type { TrackGeometry } from "./useTrackGeometry";

// The trip bar: a slim road held at the top of the viewport, under the site's
// bar (it follows the bar's headroom), with the whole trip on it from the
// first year to what's next. Misuki drives it with the reader, both ways
// (lib/quick/trip maps the rail's depth onto the bar's even stops); each stop
// lights as the rail reaches its year and stays lit (data-quick-mark, painted
// by useCheckpointTrack). A stop is a button that scrolls to its year. It sits
// in its own band above the rail, opaque, so the rail scrolls under it and
// never shares a pixel with it. Below sm the last stop is a flag, so its
// label never runs into the last year's.

export type TripHandle = { drive: (depth: number, geometry: TrackGeometry) => void };

const CAR_PX = 64;
const NAV_PX = 72;
const REDUCE = "(prefers-reduced-motion: reduce)";

type Props = { ref?: Ref<TripHandle>; rootRef: RefObject<HTMLDivElement | null>; rows: readonly YearRow[]; reduced: boolean };

export function TripBar({ ref, rootRef, rows, reduced }: Props) {
  const roadRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef({ p: 0 });
  const headerHidden = useHeaderHidden();
  const stops = tripStops(rows);

  useImperativeHandle(
    ref,
    () => ({
      drive(depth, geometry) {
        const road = roadRef.current;
        const car = carRef.current;
        const fill = fillRef.current;
        if (!road || !car || !fill || geometry.height <= 0) return;
        const at = new Map(geometry.tops.map((top) => [top.key, top.y / geometry.height]));
        const target = barPosition(depth, stops.map((stop) => at.get(stop.key) ?? 1));
        const paint = () => {
          const width = road.clientWidth;
          car.style.transform = `translate3d(${(shownRef.current.p * width - CAR_PX / 2).toFixed(1)}px, 0, 0)`;
          fill.style.transform = `scaleX(${shownRef.current.p.toFixed(4)})`;
        };
        gsap.killTweensOf(shownRef.current);
        if (reduced || window.matchMedia(REDUCE).matches) {
          shownRef.current.p = target;
          paint();
          return;
        }
        gsap.to(shownRef.current, { p: target, duration: 0.45, ease: "power3.out", onUpdate: paint });
      },
    }),
    [stops, reduced],
  );

  const goTo = (key: string) => {
    const smooth = !reduced && !window.matchMedia(REDUCE).matches;
    document.getElementById(key)?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
  };

  return (
    <div
      ref={rootRef}
      data-trip-bar=""
      className="sticky z-20 -mx-6 mb-12 border-b border-border bg-background px-6 pb-3 pt-2 transition-[top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      style={{ top: headerHidden ? 0 : NAV_PX }}
    >
      <nav aria-label={quickCopy.tripLabel} className="relative mx-auto h-[60px]" style={{ paddingInline: CAR_PX / 2 }}>
        <div ref={roadRef} className="relative h-full">
          <div aria-hidden="true" className="absolute inset-x-0 top-[26px] h-[2px] rounded-full bg-border" />
          <div ref={fillRef} aria-hidden="true" className="absolute inset-x-0 top-[26px] h-[2px] origin-left scale-x-0 rounded-full bg-accent" />
          <ol className="absolute inset-0">
            {stops.map((stop, i) => (
              <li key={stop.key} data-quick-mark={stop.key} className="group/mark absolute top-0 -translate-x-1/2" style={{ left: `${stopAt(i, stops.length) * 100}%` }}>
                <button
                  type="button"
                  onClick={() => goTo(stop.key)}
                  aria-label={quickCopy.tripTo(stop.label)}
                  className="flex flex-col items-center rounded-md px-1 pt-[21px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span aria-hidden="true" className="block h-3 w-3 rounded-full bg-accent ring-[3px] ring-background transition-colors duration-300 motion-reduce:transition-none group-data-[lit=false]/mark:bg-border" />
                  <span aria-hidden="true" className="mt-1.5 flex h-4 items-center whitespace-nowrap font-label text-label-sm text-foreground transition-colors duration-300 group-data-[lit=false]/mark:text-muted">
                    {stop.key === CLOSE_KEY ? (
                      <>
                        <Flag className="h-3.5 w-3.5 sm:hidden" strokeWidth={1.8} />
                        <span className="max-sm:hidden">{stop.label}</span>
                      </>
                    ) : (
                      stop.label
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div ref={carRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-[4.5px] text-foreground" style={{ width: CAR_PX }}>
            <Misuki width={CAR_PX} />
          </div>
        </div>
      </nav>
    </div>
  );
}
