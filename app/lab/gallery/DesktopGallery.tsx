"use client";

import { drawnShape, type LabCard } from "./cards";
import { columnBox, wideBox, type Row } from "./rows";
import { CloseHint, Header, Links, MaskedPhoto, TextBlock } from "./parts";
import type { Settings } from "./settings";

// Desktop: the header (beside the card picture on a photo card when it
// leads with the title), then the rows. A vertical photo sits beside its
// paragraph, the sides alternating; a horizontal one spans the row with its
// paragraph under it; extras follow the last block. Then the links and the
// close hint.

type Props = { card: LabCard; rows: Row[]; s: Settings; theme: "light" | "dark"; shapes: number[]; innerWidth: number };

export function DesktopGallery({ card, rows, s, theme, shapes, innerWidth }: Props) {
  const aspect = (p: number) => drawnShape(card, p, shapes[p]);
  const rowWidth = (innerWidth * s.wideWidth) / 100;
  const photo = (p: number, wide: boolean) => (
    <MaskedPhoto
      key={p}
      photo={card.photos[p]}
      index={p}
      aspect={aspect(p)}
      flown={p === card.flownPhoto}
      box={wide ? wideBox(aspect(p), rowWidth, s.wideMaxHeight) : columnBox(aspect(p), s.photoWidth, card.photos[p].maxWidth)}
    />
  );

  return (
    <>
      {rows[0]?.kind !== "lead" && <Header card={card} theme={theme} compact={false} />}
      <div className="flex flex-col" style={{ rowGap: s.rowGap }}>
        {rows.map((row) => {
          switch (row.kind) {
            case "lead":
              return (
                <div key="lead" className={`flex flex-row ${s.textAlign === "center" ? "items-center" : "items-start"}`} style={{ columnGap: s.columnGap }} data-row="lead">
                  {photo(row.photo, false)}
                  <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <Header card={card} theme={theme} compact={false} />
                    {row.block !== undefined && <TextBlock card={card} block={row.block} compact={false} />}
                  </div>
                </div>
              );
            case "text":
              return <TextBlock key={`text-${row.block}`} card={card} block={row.block} compact={false} className="max-w-[62ch]" />;
            case "stack":
              return (
                <div key={`stack-${row.block}`} className="flex flex-col" style={{ rowGap: s.stackGap }} data-row="stack">
                  {photo(row.photo, true)}
                  <TextBlock card={card} block={row.block} compact={false} className="max-w-[62ch]" />
                </div>
              );
            case "wide":
              return (
                <div key={`wide-${row.photo}`} data-row="wide">
                  {photo(row.photo, true)}
                </div>
              );
            case "photos":
              return (
                <div key={`photos-${row.photos.join("-")}`} className={`flex items-start ${row.side === "right" ? "flex-row-reverse" : "flex-row"}`} style={{ columnGap: s.columnGap }} data-row="photos">
                  {row.photos.map((p) => photo(p, false))}
                </div>
              );
            case "pair":
              return (
                <div
                  key={`pair-${row.block}`}
                  className={`flex ${row.side === "right" ? "flex-row-reverse" : "flex-row"} ${s.textAlign === "center" ? "items-center" : "items-start"}`}
                  style={{ columnGap: s.columnGap }}
                  data-row="pair"
                >
                  {photo(row.photo, false)}
                  <TextBlock card={card} block={row.block} compact={false} className="min-w-0 flex-1" />
                </div>
              );
          }
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Links card={card} />
        <CloseHint />
      </div>
    </>
  );
}
