"use client";
import { useEffect, useRef } from "react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { descriptionId, type TipKind } from "@/lib/inline/attrs";
import { tipView } from "@/lib/inline/view";
import { TipBubble } from "./TipBubble";
import { useTipController } from "./useTipController";
const { register } = siteContent;
const DESCRIBED: Array<readonly [TipKind, string]> = [
  ...Object.keys(register.tip).map((key) => ["tip", key] as const),
  ...Object.keys(register.pop).map((key) => ["pop", key] as const),
];
// The copy's inline links come alive here, once per page (app/layout.tsx):
// tips and pops share one label, and every tip and pop link is described by
// a hidden element listed below.
export function InlineLayer() {
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const tip = useTipController(bubbleRef);
  useEffect(() => {
    document.documentElement.dataset.inlineLinks = "ready";
    return () => void delete document.documentElement.dataset.inlineLinks;
  }, []);
  return (
    <>
      <div hidden>
        {DESCRIBED.map(([kind, key]) => (
          <span key={`${kind}-${key}`} id={descriptionId(kind, key)}>{tipView(kind, key)?.description}</span>
        ))}
      </div>
      <Portal>
        <TipBubble ref={bubbleRef} state={tip.state} />
      </Portal>
    </>
  );
}
