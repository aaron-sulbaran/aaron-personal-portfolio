// The band's button looks, shared by the invite and its Not now note. Each is
// the props Fill takes beside its variant and colourway.

export const FOCUS = "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// "Play it": the 1.5px rise line stands in for its underline, inset by its own padding.
export const PRIMARY = {
  line: 1.5,
  className: `-mx-2 inline-flex items-baseline px-2 pb-1 pt-0.5 font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent ${FOCUS}`,
  overClassName: "flex items-baseline px-2 pb-1 pt-0.5",
};

// "Not now" keeps its muted underline; no rise line.
export const QUIET = {
  line: 0,
  className: `-mx-1.5 inline-flex items-baseline px-1.5 pb-[3px] pt-px font-label text-label text-muted underline decoration-1 underline-offset-[4px] decoration-[color:color-mix(in_srgb,var(--color-muted)_40%,transparent)] dark:decoration-[color:color-mix(in_srgb,var(--color-muted)_55%,transparent)] ${FOCUS}`,
  overClassName: "flex items-baseline px-1.5 pb-[3px] pt-px",
};

// Pause, Resume and the phone's Play it: a 1px rise line.
export const SMALL = {
  line: 1,
  className: `-mx-1.5 inline-flex items-baseline px-1.5 pb-[2px] pt-px font-label text-label text-accent ${FOCUS}`,
  overClassName: "flex items-baseline px-1.5 pb-[2px] pt-px",
};
