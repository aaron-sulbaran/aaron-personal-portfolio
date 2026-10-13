import type { SVGProps } from "react";

// Misuki, my 2001 Mazda Miata NB, side on with the top down, facing right:
// single-weight line art in currentColor after the NB reference sheets. The
// long low nose with its oval headlight, the arches, the door, the raked
// windshield, the seat and the roll hoop, the short rear deck and its tail
// lamp, and five-spoke wheels. Drawn in a 100 by 36 box on a ground at y 34,
// wheels 58 apart (the NB's wheelbase to its length); the stroke never scales,
// so she keeps one weight at any size. The body is filled with the page so a
// road under her stays under her.

export const MISUKI_BOX = { width: 100, height: 36, ground: 34 } as const;

const NON_SCALING = "non-scaling-stroke";
const WHEELS = [22, 80] as const;
const SPOKES = [0, 1, 2, 3, 4].map((i) => ((-90 + i * 72) * Math.PI) / 180);
const r2 = (n: number) => Number(n.toFixed(2));

const BODY =
  "M5.6 28.3C3.4 27.9 2.1 26.6 1.4 24.4C0.7 22 0.6 19 1 17C1.3 15.6 2 14.9 3.2 14.7C5.4 14.1 7.6 13.8 9.8 13.7C17 13.6 26 14 32 14C42 14 52 14 59.6 14.3C63 14.5 66 14.8 68.4 15C72 15.3 75.6 15.3 79 15.6C84 16.1 89 17.4 93.4 18.8C96.8 19.9 99.2 21.4 99.6 23.2C99.9 24.8 99.4 26.4 98.2 27.6C97.4 28.3 96.4 28.6 95.2 28.6L88.25 28.6A8.4 8.4 0 1 0 71.75 28.6L30.25 28.6A8.4 8.4 0 1 0 13.75 28.6C10.8 28.6 8 28.5 5.6 28.3Z";

const LINES = [
  // The windshield's frame, raked back from the cowl.
  "M60 14.3L50.9 6C50.5 5.6 49.9 5.7 49.9 6.3L55 14.2",
  // The seat's back and headrest, then the roll hoop behind it, both leaning back.
  "M43.4 14L45.2 10.2C45.5 9.5 46.1 9.2 46.8 9.4L47.7 9.7C48.3 9.9 48.5 10.4 48.2 11L46.6 14",
  "M34.4 14L36.7 9.2C37 8.6 37.5 8.4 38.2 8.4H40.2C40.9 8.4 41.2 8.9 41 9.5L39.4 14",
  // The door's cut lines and its handle.
  "M58.2 14.3C59 19 58.8 24 57.8 28.6",
  "M37.4 14C37 19 37.2 24 38.2 28.6",
  "M41 17.1H44.4",
  // The bumper's lip under the nose, and the side marker on it.
  "M89.4 26.2C92.6 26.3 95.4 26.4 98.6 26.2",
  "M93.6 23.1H95.8",
];

function Wheel({ cx }: { cx: number }) {
  const cy = 27;
  return (
    <g>
      <circle cx={cx} cy={cy} r="7" vectorEffect={NON_SCALING} />
      <circle cx={cx} cy={cy} r="4.6" vectorEffect={NON_SCALING} />
      <circle cx={cx} cy={cy} r="1.1" vectorEffect={NON_SCALING} />
      <path vectorEffect={NON_SCALING} d={SPOKES.map((a) => `M${r2(cx + Math.cos(a) * 1.9)} ${r2(cy + Math.sin(a) * 1.9)}L${r2(cx + Math.cos(a) * 4.2)} ${r2(cy + Math.sin(a) * 4.2)}`).join("")} />
    </g>
  );
}

// The drawing as a group, for an SVG that places her (the road rail).
export function MisukiShape({ strokeWidth = 1.25 }: { strokeWidth?: number }) {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={BODY} className="fill-background" vectorEffect={NON_SCALING} />
      {LINES.map((d) => (
        <path key={d} d={d} vectorEffect={NON_SCALING} />
      ))}
      <ellipse cx="94.4" cy="21" rx="3.4" ry="1.15" transform="rotate(13 94.4 21)" vectorEffect={NON_SCALING} />
      <ellipse cx="2.9" cy="17.2" rx="1.6" ry="0.95" transform="rotate(-6 2.9 17.2)" vectorEffect={NON_SCALING} />
      <g className="fill-background">
        {WHEELS.map((cx) => (
          <Wheel key={cx} cx={cx} />
        ))}
      </g>
    </g>
  );
}

// Standalone, width in CSS px (the height follows the box).
export function Misuki({ width, className = "", ...rest }: { width: number; className?: string } & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">) {
  return (
    <svg aria-hidden="true" width={width} height={(width * MISUKI_BOX.height) / MISUKI_BOX.width} viewBox={`0 0 ${MISUKI_BOX.width} ${MISUKI_BOX.height}`} className={`overflow-visible ${className}`} {...rest}>
      <MisukiShape />
    </svg>
  );
}
