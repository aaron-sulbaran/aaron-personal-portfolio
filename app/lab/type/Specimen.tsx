import type { CSSProperties, ReactNode } from "react";
import { stepFor, type Role, type Tone } from "./settings";

// Marks a fragment element as a label role at its real size (px), so lab.css
// can restyle it. `strong` marks text the site sets in medium; `tone` says
// what kind of small text it is (its color can override the role's); the
// step is where the three-step scale puts it.
export function role(name: Role, px: number, strong = false, tone?: Tone) {
  return {
    "data-role": name,
    "data-strong": strong ? "" : undefined,
    "data-step": stepFor(px),
    "data-tone": tone,
    style: { "--base": `${px / 16}rem` } as CSSProperties,
  };
}

// The same marks without the style, for elements that merge their own.
export function marks(tag: ReturnType<typeof role>) {
  return { "data-role": tag["data-role"], "data-strong": tag["data-strong"], "data-step": tag["data-step"], "data-tone": tag["data-tone"] };
}

// One fragment on the bench, captioned in the lab's plain chrome with the
// file it copies.
export function Specimen({ index, title, source, children }: { index: number; title: string; source: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pb-20 pt-3">
      <p className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[11px] text-muted [font-family:system-ui]">
        <span>
          {index}. {title}
        </span>
        <span>{source}</span>
      </p>
      {children}
    </section>
  );
}
