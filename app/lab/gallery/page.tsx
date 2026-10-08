import type { Metadata } from "next";
import { labFontVariables } from "../type/fonts";
import { GalleryLab } from "./GalleryLab";

// /lab/gallery: a dev-only bench for the photos inside a card's modal
// (docs/content/modal-gallery.md). app/lab/layout.tsx 404s the route outside
// `pnpm dev`. The lab's font variables carry Profa Bold for the meta line,
// which main sets in its label face.
export const metadata: Metadata = { title: "Gallery lab", robots: { index: false, follow: false } };

export default function GalleryLabPage() {
  return (
    <div className={labFontVariables}>
      <GalleryLab />
    </div>
  );
}
