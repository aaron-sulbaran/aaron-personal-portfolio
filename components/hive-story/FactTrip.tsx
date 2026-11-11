import { hiveStoryCopy } from "@/lib/content/hive-story";
import { TRIP, TRIP_BOX, type TripPart } from "@/lib/hive-story/trip";

const { trip } = hiveStoryCopy.steps;
const r2 = (n: number) => Math.round(n * 100) / 100;

function Part({ part }: { part: TripPart }) {
  switch (part.kind) {
    case "dots":
      return <g fillOpacity={part.opacity}>{part.points.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={part.r} />)}</g>;
    case "rings":
      return <g fill="none" stroke="var(--hive-bee)" strokeWidth={1.6}>{part.points.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={part.r} />)}</g>;
    case "glow":
      return <rect x={part.x} y={part.y} width={part.w} height={part.h} rx={6} fill="var(--hive-glow)" />;
    case "label":
      return <text x={part.x} y={part.y} textAnchor={part.anchor} fontSize={part.size} fontWeight={650}>{trip.labels[part.text]}</text>;
  }
}

/** One fact's trip in bees: every step drawn at rest; FactTripPlayer plays them in order. */
export function FactTrip() {
  return (
    <figure className="m-0 rounded-[22px] bg-[var(--hive-panel)] p-3 lg:rounded-[28px] lg:p-5">
      <svg viewBox={`0 0 ${TRIP_BOX.width} ${TRIP_BOX.height}`} className="block h-auto w-full" aria-hidden="true" focusable="false" fill="var(--hive-bee)" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
        {TRIP.map((part, i) => (
          <g key={i} data-at={part.at || undefined} className="hive-trip-part">
            <Part part={part} />
          </g>
        ))}
        {([5, 6] as const).map((step) => (
          <circle key={step} data-bee={step} className="hive-trip-bee" r={3} cx={0} cy={0} />
        ))}
      </svg>
      <figcaption className="sr-only">{trip.description}</figcaption>
    </figure>
  );
}
