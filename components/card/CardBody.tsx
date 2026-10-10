"use client";

import type { Gallery } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { StillPhoto } from "./StillPhoto";
import type { GalleryLayout } from "./useGalleryLayout";
import { Words } from "./Words";

// The modal's body: the header; on a photo card the card picture beside the
// first words (beside the rows it is the flight's landing; on a phone the
// header's tile is, so the picture draws itself); every other word unit in
// order; the mentors on Mentorship; the links and the close hint. Task 12
// gives the rows their gallery and Task 15 gives the phone its pager.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia }: Props) {
  const compact = layout === "pager";
  const units = gallery.words.map((_, unit) => unit);
  const rest = gallery.lead === undefined ? units : units.slice(1);
  return (
    <div className={`flex flex-col ${compact ? "gap-6" : "gap-8"}`}>
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact={compact} />
      {gallery.lead !== undefined && (
        <div className={compact ? "flex flex-col gap-4" : "flex flex-row items-center"} style={compact ? undefined : { columnGap: GALLERY.columnGap }}>
          <div className="flex shrink-0 justify-start" style={compact ? undefined : { width: gallery.slot }}>
            <StillPhoto photo={gallery.photos[gallery.lead]} index={gallery.lead} box={BOXES.vertical} slot={!compact} renderMedia={compact || renderMedia} />
          </div>
          {units.length > 0 && (
            <div className="min-w-0 flex-1" style={compact ? undefined : { maxWidth: GALLERY.textWidth }}>
              <Words gallery={gallery} unit={0} compact={compact} />
            </div>
          )}
        </div>
      )}
      {rest.map((unit) => (
        <Words key={unit} gallery={gallery} unit={unit} compact={compact} />
      ))}
      {gallery.key === "mentorship" && <MentorsList compact={compact} />}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
