import type { RefObject } from "react";
import { yearMarks, type QuickItem } from "@/lib/quick/items";
import { roadPath, roadPoints, type Point } from "@/lib/quick/road";
import { Misuki } from "./Misuki";
import type { TrackGeometry } from "./useTrackGeometry";

// The road variant's drawing, in the lane's own pixels: the road, its centre
// dashes, the accent trail DrawSVG lays behind the car, a stop at each
// checkpoint (a dot for an entry, a diamond for a dated sign), a year sign at the
// first stop of each year, the finish at the closing sign, and Misuki. Each stop
// carries data-quick-mark, so it lights with its item.

const PLATE = { width: 34, height: 16, gap: 10 } as const;
const UNLIT = "group-data-[lit=false]/mark";

function YearPlate({ at, lane, year }: { at: Point; lane: number; year: string }) {
  const beside = at.x < lane / 2 ? at.x + PLATE.gap : at.x - PLATE.gap - PLATE.width;
  const x = Math.max(0, Math.min(lane - PLATE.width, beside));
  const y = at.y - PLATE.height / 2;
  return (
    <>
      <rect x={x} y={y} width={PLATE.width} height={PLATE.height} rx="4" className={`fill-accent ${UNLIT}:fill-border`} />
      <text x={x + PLATE.width / 2} y={y + 11.5} textAnchor="middle" fontSize="10" className={`font-label fill-background ${UNLIT}:fill-muted`}>
        {year}
      </text>
    </>
  );
}

function Stop({ at, sign }: { at: Point; sign: boolean }) {
  const look = `fill-accent stroke-background ${UNLIT}:fill-background ${UNLIT}:stroke-muted`;
  if (sign) return <rect x={at.x - 4} y={at.y - 4} width="8" height="8" rx="1" transform={`rotate(45 ${at.x} ${at.y})`} strokeWidth="1.5" className={look} />;
  return <circle cx={at.x} cy={at.y} r="4.5" strokeWidth="2" className={look} />;
}

function Finish({ at }: { at: Point }) {
  return (
    <>
      <path d={`M${at.x} ${at.y}V${at.y - 24}`} strokeWidth="1.5" className="stroke-foreground" />
      <rect x={at.x} y={at.y - 24} width="14" height="9" rx="1" className={`fill-accent ${UNLIT}:fill-border`} />
      <circle cx={at.x} cy={at.y} r="4.5" strokeWidth="2" className={`fill-accent stroke-background ${UNLIT}:fill-background ${UNLIT}:stroke-muted`} />
    </>
  );
}

type Props = {
  geometry: TrackGeometry;
  items: readonly QuickItem[];
  trailRef: RefObject<SVGPathElement | null>;
  carRef: RefObject<SVGGElement | null>;
};

export function RoadArt({ geometry, items, trailRef, carRef }: Props) {
  const { lane, height, tops } = geometry;
  const points = roadPoints(tops.map((top) => top.y), lane);
  const d = roadPath(points);
  const signs = new Set(items.filter((item) => item.kind === "sign").map((item) => item.key));
  const years = new Map(yearMarks(items).map((mark) => [mark.key, mark.year]));
  const narrow = lane < 100;
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={lane} height={height} viewBox={`0 0 ${lane} ${height}`}>
      <path d={d} className="stroke-border" strokeWidth={narrow ? 10 : 14} strokeLinecap="round" fill="none" />
      <path d={d} className="stroke-background" strokeWidth="1" strokeDasharray="3 7" fill="none" />
      <path ref={trailRef} d={d} className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {tops.map((top, i) => {
        const at = points[i + 1];
        const year = years.get(top.key);
        return (
          <g key={top.key} data-quick-mark={top.key} className="group/mark">
            {top.key === "close" ? <Finish at={at} /> : <Stop at={at} sign={signs.has(top.key)} />}
            {year && <YearPlate at={at} lane={lane} year={year} />}
          </g>
        );
      })}
      <g ref={carRef}>
        <Misuki scale={narrow ? 0.9 : 1.3} />
      </g>
    </svg>
  );
}
