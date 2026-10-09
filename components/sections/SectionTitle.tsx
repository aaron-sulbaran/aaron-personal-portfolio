import type { ReactNode } from "react";
import { Block } from "./Block";

// A section's title and the line under it, each one Block of the sections
// grammar. Who I am, Connect and the numbers strip take the title from here
// and the numbers strip takes the line too, so the sizes, faces and colours
// of the sections' titles cannot drift apart. The heading's words must be
// static text (see Block). An id names the block for a group that is labelled
// by it (aria-labelledby).

export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Block kind="heading" as="h2" id={id} className="font-display text-section">
      {children}
    </Block>
  );
}

export function SectionSubline({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Block kind="body" as="p" split="block" id={id} className="max-w-xs text-sm leading-relaxed text-muted">
      <span data-sections-inner className="block">
        {children}
      </span>
    </Block>
  );
}
