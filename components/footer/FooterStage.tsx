"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { createEggState } from "@/lib/footer/egg";
import { bandShare, footerGeometry, wordRest } from "@/lib/footer/geometry";
import { FooterField } from "./FooterField";
import { useDocumentTheme } from "./useDocumentTheme";
import { Wordmark } from "./Wordmark";

// The footer's client part, around the server's small lines (children): the
// field and the wordmark over the whole footer, laid out from its measured
// width. The word's band is reserved on the server in cqw (the footer is an
// inline-size container), at the height the client lays out, so nothing
// below Connect shifts when the word mounts. The egg's state is shared by the
// wordmark's loop (which runs it) and the field (which draws its rings). The
// small lines come first, so a reader hears them and the word before the
// period's button; the band stays last, the flow element the stage measures.

type Props = { text: string; eggLabel: string; children: ReactNode };
type Box = { w: number; h: number; bandTop: number };

export function FooterStage({ text, eggLabel, children }: Props) {
  const stage = useRef<HTMLElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [egg] = useState(createEggState);
  const reduced = useReducedMotionLive();
  const theme = useDocumentTheme();

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // Committed now, inside the observer's callback (after layout, before paint),
    // so the wordmark's layout effect lands the new geometry in this frame.
    const ro = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight, bandTop: band.current?.offsetTop ?? 0 };
      flushSync(() => setBox((prev) => (prev && prev.w === next.w && prev.h === next.h && prev.bandTop === next.bandTop ? prev : next)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => (box && box.w > 0 ? footerGeometry(text, box.w, box.h, box.bandTop) : null), [text, box]);
  const rest = useMemo(() => (geo ? wordRest(text, geo) : null), [text, geo]);

  return (
    <footer ref={stage} data-footer data-wave-anchor="footer" className="relative isolate w-full overflow-hidden bg-background [container-type:inline-size]">
      {children}
      {geo && <FooterField text={text} geo={geo} egg={egg} reduced={reduced} theme={theme} />}
      {geo && rest && <Wordmark text={text} eggLabel={eggLabel} geo={geo} rest={rest} reduced={reduced} stage={stage} egg={egg} />}
      <div ref={band} aria-hidden="true" data-footer-band style={{ height: `${(bandShare(text) * 100).toFixed(4)}cqw` }} />
    </footer>
  );
}
