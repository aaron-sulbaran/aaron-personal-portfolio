"use client";

import { useEffect } from "react";
import { provideCardChunk } from "@/lib/mark/cardChunk";

// The home page's import() of the mark card (lib/mark/cardChunk): built
// against this page's chunk group, which already holds GSAP and the modal
// kit, so the card's chunk carries only the card.
export function MarkCardSource() {
  useEffect(() => provideCardChunk(() => import("@/components/mark/MarkCard")), []);
  return null;
}
