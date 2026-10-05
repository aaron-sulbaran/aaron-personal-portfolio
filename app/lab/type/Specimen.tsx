import type { CSSProperties, ReactNode } from "react";
import type { Role } from "./settings";

// Marks a fragment element as a label role at its real size (px), so lab.css
// can restyle it. `strong` marks text the site sets in medium.
export function role(name: Role, px: number, strong = false) {
  return {
    "data-role": name,
    "data-strong": strong ? "" : undefined,
    style: { "--base": `${px / 16}rem` } as CSSProperties,
  };
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
