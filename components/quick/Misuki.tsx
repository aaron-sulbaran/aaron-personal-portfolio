// Misuki, my 2001 Miata, side on and facing right, in the site's tokens. Drawn
// in a 48 by 18 box with her wheels on y 13; the road variant drives her along
// its path, so "right" becomes whichever way the road heads.

export const MISUKI_BOX = { width: 48, height: 18 } as const;

export function Misuki({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        className="fill-accent"
        d="M3.2 13.2C2.1 13.2 1.4 12.5 1.4 11.5L1.6 9C1.8 8 2.6 7.4 3.8 7.3L15.6 6.6C17.8 3.9 20.7 2.8 24.3 2.8L26.9 2.9L31.4 6.4L42.6 7.4C45.4 7.7 46.9 8.9 46.9 10.8V12.2C46.9 12.8 46.4 13.2 45.8 13.2Z"
      />
      <path className="fill-background opacity-80" d="M17.4 6.5C19.2 4.5 21.4 3.7 24.1 3.7H26.4L29.5 6.3Z" />
      <path className="stroke-background opacity-60" strokeWidth="0.5" fill="none" d="M22.6 6.6V11.4M15.4 7.2H33.4" />
      <ellipse className="fill-background" cx="45.2" cy="9" rx="1.2" ry="0.7" />
      <rect className="fill-foreground opacity-50" x="1.6" y="8.2" width="1.4" height="1.4" rx="0.4" />
      {[10.2, 38.4].map((cx) => (
        <g key={cx}>
          <circle className="fill-background" cx={cx} cy="13" r="4.2" />
          <circle className="fill-foreground dark:fill-muted" cx={cx} cy="13" r="3.5" />
          <circle className="fill-muted dark:fill-background" cx={cx} cy="13" r="1.4" />
        </g>
      ))}
    </g>
  );
}
