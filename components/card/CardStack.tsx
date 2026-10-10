"use client";

import type { Gallery } from "@/lib/gallery/card";
import { BOXES } from "@/lib/gallery/constants";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// The phone's body until the pager lands: the header (its tile is the
// flight's landing), the card picture over the first words on a photo card,
// every other word unit, the mentors, the links and the close hint, in one
// column.
export function CardStack({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean }) {
  const units = gallery.words.map((_, unit) => unit);
  const rest = gallery.lead === undefined ? units : units.slice(1);
  return (
    <div className="flex flex-col gap-6">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      {gallery.lead !== undefined && (
        <div className="flex flex-col gap-4">
          <StillPhoto photo={gallery.photos[gallery.lead]} index={gallery.lead} box={BOXES.vertical} />
          {units.length > 0 && <Words gallery={gallery} unit={0} compact />}
        </div>
      )}
      {rest.map((unit) => (
        <Words key={unit} gallery={gallery} unit={unit} compact />
      ))}
      {gallery.key === "mentorship" && <MentorsList compact />}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
