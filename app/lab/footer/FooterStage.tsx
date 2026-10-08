"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Theme } from "@/lib/theme";
import { ConnectRow } from "./ConnectRow";
import { FOOTER_COPY } from "./content";
import { FieldBackdrop, type BackdropKind } from "./FieldBackdrop";
import { METRICS } from "./glyphs";
import { fieldStops, layoutWord, wordBand } from "./wordLayout";
import type { FooterSettings } from "./settings";
import { Wordmark, type WordGeometry } from "./Wordmark";

// The footer as the site would have it, full width of its column: the field
// rising from paper and ending in the wordmark, the Connect row over or under
// it, the small lines. Every length comes from the stage's measured width.

export type Readout = { sizePx: number; spanPct: number; stageWidth: number };

type Props = {
  s: FooterSettings;
  theme: Theme;
  reduced: boolean;
  replay: number;
  forceStandIn: boolean;
  onBackdrop: (kind: BackdropKind) => void;
  onReadout: (r: Readout) => void;
};

function fieldMask(s: FooterSettings, geo: WordGeometry, size: number): CSSProperties {
  const stop = Math.max(0, s.field.ending === "under" ? geo.baselineY : geo.wordTop);
  const { inEnd, start } = fieldStops(s.field.fadeIn * geo.stageH, s.field.fade * size, stop);
  const tail = s.field.ending === "clip" ? `, black ${stop}px` : "";
  const image = `linear-gradient(to bottom, transparent 0px, black ${inEnd}px, black ${start}px, transparent ${stop}px${tail})`;
  return { maskImage: image, WebkitMaskImage: image };
}

export function FooterStage({ s, theme, reduced, replay, forceStandIn, onBackdrop, onReadout }: Props) {
  const stage = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, bandTop: 0 });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight, bandTop: bandRef.current?.offsetTop ?? 0 });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [s.connect]);

  const size = (s.heightVw / 100) * box.w;
  const swell = s.face === "profa" ? 0 : s.swellAmount;
  const band = wordBand(size, s.weight, swell, s.bleed, s.gap);
  const baselineY = box.bandTop + band.height - band.baselineFromBottom;
  const hasDescender = /[gjpqy]/.test(FOOTER_COPY.wordmark);
  const riseFloor = baselineY + ((s.weight + swell) / 2 + 0.02 + (hasDescender ? -METRICS.descender : 0)) * size;
  const geo: WordGeometry = {
    stageW: box.w,
    stageH: box.h,
    baselineY,
    wordTop: baselineY - (METRICS.ascender + (s.weight + swell) / 2) * size,
    clipBottom: s.connect === "below" ? Math.min(riseFloor, box.bandTop + band.height) : riseFloor,
  };

  const spanPct = box.w ? (layoutWord(FOOTER_COPY.wordmark, size, [s.weight], s.tracking).width / box.w) * 100 : 0;
  useEffect(() => onReadout({ sizePx: size, spanPct, stageWidth: box.w }), [size, spanPct, box.w, onReadout]);

  return (
    <section
      ref={stage}
      aria-label="Footer stage"
      className="relative isolate select-none overflow-hidden bg-background text-foreground"
      style={{ touchAction: "pan-y" }}
    >
      {s.field.on && box.w > 0 && (
        <div className="pointer-events-none absolute inset-0" style={fieldMask(s, geo, size)}>
          <div className="absolute inset-0" style={s.field.flip ? { transform: "scaleY(-1)" } : undefined}>
            <FieldBackdrop theme={theme} intensity={s.field.intensity} drift={s.field.drift} forceStandIn={forceStandIn} reduced={reduced} onKind={onBackdrop} />
          </div>
        </div>
      )}
      {box.w > 0 && <Wordmark text={FOOTER_COPY.wordmark} s={s} size={size} geo={geo} reduced={reduced} replay={replay} stage={stage} />}
      <h2 className="sr-only">{FOOTER_COPY.wordmark}</h2>
      <div className="relative z-10 flex flex-col px-6 md:px-10">
        {s.connect === "above" && <ConnectRow placement="above" />}
        <div ref={bandRef} style={{ height: band.height }} />
        {s.connect === "below" && <ConnectRow placement="below" />}
      </div>
    </section>
  );
}
