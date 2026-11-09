import type { ReactNode } from "react";
import { PAGE_NUMBERS, siteContent, type ColumnView } from "@/lib/content";
import { SectionNumber } from "@/components/sections/SectionNumber";
import { TitleFill } from "@/components/sections/TitleFill";
import { CardProgress } from "./CardProgress";
import { CardTitle } from "./CardTitle";

// The two columns of titles beside the Coil, over the shader field. Below md
// they sit side by side under the Coil, all fourteen on one screen; from md up
// each takes a gutter at its side of the section and the middle is the pane
// the Coil is laid out in ([data-coil-pane], read by the scene's layout). The
// wrapper takes no pointer, so the canvas keeps every gesture in the middle.
// The page's number and title ("Here's what I've been up to.", which answers
// page 1's question, in page 1's name's fill once the deal is done:
// TitleFill) lead the Work column on a desktop, and span the top of
// the columns on a phone; the progress line ("N of 14 opened") closes the Work
// column, and on a phone the two columns. The labels and titles carry
// data-deal-label and data-deal-title: the deal holds them back
// (app/globals.css) and brings them in last (lib/home/dealOpen.ts). The title,
// the columns and the progress line carry data-logo-clear: the logo steps aside
// while they are under it (components/SiteLogo.tsx). A Server Component: only
// the titles and the progress line are client leaves.
export function CardColumns() {
  const [work, builds] = siteContent.columns.order;
  return (
    <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-x-4 px-5 pb-6 pt-1 md:absolute md:inset-0 md:grid-cols-[var(--coil-gutter)_minmax(0,1fr)_var(--coil-gutter)] md:content-center md:gap-x-0 md:px-0 md:py-0 [--coil-gutter:clamp(12.5rem,16.5vw,17.5rem)]">
      <PageTitle className="col-span-2 mb-4 md:hidden" />
      <div className="pointer-events-auto md:col-start-1 md:pl-8 md:pr-2">
        <PageTitle className="mb-6 hidden md:block" />
        <Column column={work} />
        <CardProgress className="mt-4 hidden md:block" />
      </div>
      <div aria-hidden="true" data-coil-pane="" className="hidden md:col-start-2 md:block" />
      <Column column={builds} className="pointer-events-auto md:col-start-3 md:pl-8 md:pr-2" />
      <CardProgress className="col-span-2 mt-5 md:hidden" />
    </div>
  );
}

function PageTitle({ className }: { className: string }) {
  return (
    <div data-deal-label="" data-logo-clear="" className={className}>
      <SectionNumber value={PAGE_NUMBERS.work} className="mb-1.5" />
      <TitleFill fillKey="work" gate="deal" backdrop="coil">
        <h2 data-page-title="" className="font-display text-[1.3125rem] leading-[1.12] text-foreground md:text-[clamp(1.25rem,1.7vw,1.75rem)]">
          {siteContent.columns.title}
        </h2>
      </TitleFill>
    </div>
  );
}

function Column({ column, className = "" }: { column: ColumnView; className?: string }) {
  return (
    <div data-logo-clear="" className={className}>
      <h3 data-deal-label="" className={HEADING_CLASS}>{column.heading}</h3>
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
      {heading && <h4 data-deal-label="" className={`${HEADING_CLASS} mt-4`}>{heading}</h4>}
      <ol aria-label={heading ?? undefined}>{children}</ol>
    </>
  );
}

// The column headings: the accent (the token), the label face one step up from
// the label it was (about 17 percent on a desktop), and a size and colour of
// their own so they never read as one more title (the titles are the display
// face in the foreground, larger).
const HEADING_CLASS = "mb-1.5 font-label text-label-sm text-accent md:text-label";
