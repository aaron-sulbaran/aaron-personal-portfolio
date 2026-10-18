import type { ReactNode } from "react";
import { quickCopy } from "@/lib/content/quick";
import { NEXT_KEY, type YearRow } from "@/lib/quick/years";
import { CardTile } from "./CardTile";
import { ClosingSign } from "./ClosingSign";
import type { OpenCard } from "./types";

// The rows every variant shares, beside a rail at 24px from the left (the
// variant draws the line, the trip bar or the road under it): each year's node
// on the rail, the year in Profa and its sentence, that year's tiles, then the
// short closing row. The words are always in the markup and never move; only a
// node's data-lit and a tile face's clip are ever touched (useCheckpointTrack).

export const RAIL_X = 24;

// hollow: the "Next" checkpoint, a dot that is not filled yet; row: the closing
// row's dot, centred on its buttons instead of a heading.
export function RailDot({ hollow = false, row = false }: { hollow?: boolean; row?: boolean }) {
  return (
    <span
      data-quick-anchor=""
      aria-hidden="true"
      className={`absolute left-6 h-4 w-4 -translate-x-1/2 rounded-full ring-4 ring-background transition-colors duration-300 motion-reduce:transition-none ${row ? "top-[10px]" : "top-3.5 md:top-5"} ${hollow ? "border-[3px] border-accent bg-background group-data-[lit=false]/item:border-border" : "bg-accent group-data-[lit=false]/item:bg-border"}`}
    />
  );
}

function YearHead({ row }: { row: YearRow }) {
  return (
    <div data-quick-key={row.key} className="group/item relative pl-16 md:pl-20">
      <RailDot />
      <h2 className="font-display text-[2.75rem] leading-none text-foreground md:text-[3.5rem]" data-lane-line="">
        {row.year}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground md:text-body-lg" data-lane-line="">
        {row.line}
      </p>
    </div>
  );
}

// The top of the rail: "Next", a hollow checkpoint with the full line of what I
// am looking for beside it, in the year rows' type. tabIndex -1 so the line under
// "Currently looking for:" can land focus here after it scrolls.
function NextHead({ line }: { line: string }) {
  return (
    <section id={NEXT_KEY} data-quick-key={NEXT_KEY} aria-labelledby="quick-next" tabIndex={-1} className="group/item relative mb-20 scroll-mt-40 pl-16 outline-none md:mb-24 md:pl-20">
      <RailDot hollow />
      <h2 id="quick-next" className="font-display text-[2.75rem] leading-none text-foreground md:text-[3.5rem]" data-lane-line="">
        {quickCopy.next.label}
      </h2>
      <p data-quick-next-line="" className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground md:text-body-lg" data-lane-line="">
        {line}
      </p>
    </section>
  );
}

export function YearList({ rows, next, onOpen, children }: { rows: readonly YearRow[]; next: string | null; onOpen: OpenCard; children?: ReactNode }) {
  return (
    <>
      {children}
      {next && <NextHead line={next} />}
      <ol aria-label={quickCopy.listLabel} className="relative flex flex-col gap-20 md:gap-24">
        {rows.map((row) => (
          <li key={row.key} id={row.key} className="scroll-mt-40">
            <YearHead row={row} />
            <ul className="mt-8 grid items-stretch gap-3 pl-16 md:pl-20 lg:grid-cols-2">
              {row.entries.map((entry) => (
                <CardTile key={entry.slot} entry={entry} onOpen={onOpen} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <ClosingSign className="mt-24 scroll-mt-40 pl-16 md:pl-20" node={<RailDot row />} />
    </>
  );
}
