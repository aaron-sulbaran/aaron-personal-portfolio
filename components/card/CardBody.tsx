"use client";

import type { Gallery } from "@/lib/gallery/card";
import { CardRows } from "./CardRows";
import { CardStack } from "./CardStack";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout: the desktop rows from 1024px up, the phone's
// column below.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia }: Props) {
  return layout === "rows" ? <CardRows gallery={gallery} renderMedia={renderMedia} /> : <CardStack gallery={gallery} renderMedia={renderMedia} />;
}
