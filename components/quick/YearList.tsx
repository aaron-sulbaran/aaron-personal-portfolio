import type { ReactNode } from "react";
import { quickCopy } from "@/lib/content/quick";
import type { YearRow } from "@/lib/quick/years";
import { CardTile } from "./CardTile";
import { ClosingSign } from "./ClosingSign";
import type { OpenCard } from "./types";

// The rows every variant shares, beside a rail at 24px from the left (the
// variant draws the line, the trip bar or the road under it): each year's node
// on the rail, the year in Profa and its sentence, that year's tiles, then the
// closing row. The words are always in the markup and never move; only a
// node's data-lit and a tile face's clip are ever touched (useCheckpointTrack).

export const RAIL_X = 24;

export function RailDot() {
  return (
    <span
      data-quick-anchor=""
      aria-hidden="true"
      className="absolute left-6 top-3.5 h-4 w-4 md:top-5 -translate-x-1/2 rounded-full bg-accent ring-4 ring-background transition-colors duration-300 motion-reduce:transition-none group-data-[lit=false]/item:bg-border"
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

export function YearList({ rows, closing, onOpen, children }: { rows: readonly YearRow[]; closing: string; onOpen: OpenCard; children?: ReactNode }) {
  return (
    <>
      {children}
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
      <ClosingSign line={closing} className="mt-24 scroll-mt-40 pl-16 md:pl-20" node={<RailDot />} />
    </>
  );
}
