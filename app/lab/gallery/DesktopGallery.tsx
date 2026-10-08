"use client";

import type { LabCard } from "./cards";
import type { Row } from "./layout";
import { CloseHint, Header, Links, MaskedPhoto, TextBlock } from "./parts";
import type { Settings } from "./settings";

// Desktop: the header, then rows that alternate photo and paragraph, the
// extras after the last block, the links and the close hint.

type Props = { card: LabCard; rows: Row[]; s: Settings; theme: "light" | "dark"; firstPhoto: number | undefined };

export function DesktopGallery({ card, rows, s, theme, firstPhoto }: Props) {
  const flown = (photo: number) => card.flown === "first-photo" && photo === firstPhoto;
  return (
    <>
      <Header card={card} theme={theme} compact={false} />
      <div className="flex flex-col" style={{ rowGap: s.rowGap }}>
        {rows.map((row) => {
          if (row.kind === "text") {
            return <TextBlock key={`text-${row.block}`} card={card} block={row.block} compact={false} className="max-w-[62ch]" />;
          }
          if (row.kind === "photos") {
            return (
              <div key={`photos-${row.photos.join("-")}`} className={`flex ${row.side === "right" ? "flex-row-reverse" : "flex-row"}`} style={{ columnGap: s.columnGap }} data-row="photos">
                {row.photos.map((p) => (
                  <MaskedPhoto key={p} photo={card.photos[p]} index={p} width={s.photoWidth} flown={flown(p)} sizesWidth={s.photoWidth} />
                ))}
              </div>
            );
          }
          return (
            <div
              key={`pair-${row.block}`}
              className={`flex ${row.side === "right" ? "flex-row-reverse" : "flex-row"} ${s.textAlign === "center" ? "items-center" : "items-start"}`}
              style={{ columnGap: s.columnGap }}
              data-row="pair"
            >
              <MaskedPhoto photo={card.photos[row.photo]} index={row.photo} width={s.photoWidth} flown={flown(row.photo)} sizesWidth={s.photoWidth} />
              <TextBlock card={card} block={row.block} compact={false} className="min-w-0 flex-1" />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Links card={card} />
        <CloseHint />
      </div>
    </>
  );
}
