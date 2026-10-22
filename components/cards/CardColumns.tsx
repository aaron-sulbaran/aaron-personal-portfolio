import type { ReactNode } from "react";
import { siteContent, type ColumnView } from "@/lib/content";
import { CardTitle } from "./CardTitle";

// The two columns of titles beside the Coil, over the shader field. Below md
// they sit side by side under the Coil, all fourteen on one screen; from md up
// each takes a gutter at its side of the section and the middle is the pane
// the Coil is laid out in ([data-coil-pane], read by the scene's layout). The
// wrapper takes no pointer, so the canvas keeps every gesture in the middle.
// The labels and titles carry data-deal-label and data-deal-title: the deal
// holds them back (app/globals.css) and brings them in last (lib/home/dealOpen.ts).
// A Server Component: only the titles are client leaves.
export function CardColumns() {
  const [work, builds] = siteContent.columns.order;
  return (
    <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-x-4 px-5 pb-6 pt-1 md:absolute md:inset-0 md:grid-cols-[var(--coil-gutter)_minmax(0,1fr)_var(--coil-gutter)] md:content-center md:gap-x-0 md:px-0 md:py-0 [--coil-gutter:clamp(11.5rem,15vw,16rem)]">
      <Column column={work} className="md:col-start-1 md:pl-8 md:pr-2" />
      <div aria-hidden="true" data-coil-pane="" className="hidden md:col-start-2 md:block" />
      <Column column={builds} className="md:col-start-3 md:pl-8 md:pr-2" />
    </div>
  );
}

function Column({ column, className }: { column: ColumnView; className: string }) {
  return (
    <div className={`pointer-events-auto ${className}`}>
      <h2 data-deal-label="" className={HEADING_CLASS}>{column.heading}</h2>
      {column.groups.map((group) => (
        <Group key={group.heading ?? column.key} heading={group.heading}>
          {group.titles.map((title) => (
            <li key={title.key} data-deal-title="">
              <CardTitle title={title} />
            </li>
          ))}
        </Group>
      ))}
    </div>
  );
}

function Group({ heading, children }: { heading: string | null; children: ReactNode }) {
  return (
    <>
      {heading && <h3 data-deal-label="" className={`${HEADING_CLASS} mt-4`}>{heading}</h3>}
      <ol aria-label={heading ?? undefined}>{children}</ol>
    </>
  );
}

const HEADING_CLASS = "mb-1 font-label text-label-sm text-foreground opacity-80";
