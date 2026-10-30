import type { ReactNode } from "react";
import { Block } from "./Block";
import { TitleFill } from "./TitleFill";

// A section's title and the line under it, each one Block of the sections
// grammar. Who I am, Connect and the numbers strip take the title from here
// and the numbers strip takes the line too, so the sizes, faces and colours
// of the sections' titles cannot drift apart. The heading's words must be
// static text (see Block). An id names the block for a group that is labelled
// by it (aria-labelledby). `words` marks the block as words the wave path
// keeps clear of (data-wave-words); a block held sticky never takes it.
// `wide` lets the line run its full length from md up (the numbers strip's
// one line); it keeps the narrow measure on phones. `fill` names a numbered
// page's title, which wears page 1's name's fill (TitleFill.tsx).

export function SectionHeading({ id, words, fill, children }: { id?: string; words?: true; fill?: string; children: ReactNode }) {
  const heading = (
    <Block kind="heading" as="h2" id={id} className="font-display text-section" data-wave-words={words}>
      {children}
    </Block>
  );
  return fill ? <TitleFill fillKey={fill}>{heading}</TitleFill> : heading;
}

export function SectionSubline({ id, words, wide, children }: { id?: string; words?: true; wide?: true; children: ReactNode }) {
  return (
    <Block kind="body" as="p" split="block" id={id} className={`max-w-xs ${wide ? "md:max-w-none " : ""}text-sm leading-relaxed text-muted`} data-wave-words={words}>
      <span data-sections-inner className="block">
        {children}
      </span>
    </Block>
  );
}
