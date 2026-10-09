"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Theme } from "@/lib/theme";
import { ConnectRow } from "./ConnectRow";
import { FOOTER_COPY } from "./content";
import { createEggState } from "./egg";
import { FieldBackdrop, type BackdropKind } from "./FieldBackdrop";
import { fieldDepths } from "./fieldDepths";
import { pathInk, pathKindOf, pathRow } from "./pathFace";
import { croppedShare, fieldStops, typesetInk, typesetRow, wordBand } from "./wordLayout";
import type { FooterSettings } from "./settings";
import { effectiveResponse, type Typeface } from "./useTypeface";
import { Wordmark, type WordGeometry } from "./Wordmark";

// The footer as the site would have it, full width of its column: the field
// rising from paper and ending in the wordmark, the Connect row over or under
// it, the small lines. Every length comes from the stage's measured width and
// the face's ink, so no face, swell or lean is ever cut by its own band.

export type Readout = { sizePx: number; spanPct: number; stageWidth: number; croppedPct: number; fittedVw: number | null };

// The widest the word may sit at rest, as a share of the stage: a heavy,
// wide face at the asked height is scaled down to this, so no swell pushes a
// letter off the edge. Just over the procedural default's 90.3 percent at
// 12.5vw, so that default is never touched.
export const FIT_SHARE = 0.92;

type Props = {
  s: FooterSettings;
  typeface: Typeface;
  theme: Theme;
  reduced: boolean;
  replay: number;
  drop: number; // the panel's "Drop the period", counted
  forceStandIn: boolean;
  onBackdrop: (kind: BackdropKind) => void;
  onReadout: (r: Readout) => void;
};

function fieldMask(s: FooterSettings, geo: WordGeometry, size: number, share: number): CSSProperties {
  const stop = Math.max(0, s.field.ending === "under" ? geo.baselineY : geo.wordTop);
  const { inEnd, start } = fieldStops(s.field.fadeIn * geo.stageH, s.field.fade * size, stop);
  const hold = `rgba(0, 0, 0, ${share.toFixed(4)})`;
  const tail = s.field.ending === "clip" ? `, black ${stop}px` : "";
  const image = `linear-gradient(to bottom, transparent 0px, ${hold} ${inEnd}px, ${hold} ${start}px, transparent ${stop}px${tail})`;
  return { maskImage: image, WebkitMaskImage: image };
}

export function FooterStage({ s, typeface, theme, reduced, replay, drop, forceStandIn, onBackdrop, onReadout }: Props) {
  const stage = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, bandTop: 0 });
  // The period's Easter egg: shared by the wordmark's loop (which runs it)
  // and the field (which draws its ripples).
  const [egg] = useState(createEggState);
  const dropped = useRef(drop);
  useEffect(() => {
    if (drop === dropped.current) return;
    dropped.current = drop;
    egg.pending.push({ kind: "period" });
  }, [drop, egg]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight, bandTop: bandRef.current?.offsetTop ?? 0 });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [s.connect]);

  const text = FOOTER_COPY.wordmark;
  const face = typeface.kind === "typeset" ? typeface : null;
  const pathKind = face ? null : pathKindOf(s);
  const response = effectiveResponse(s.response, face);
  // The word's width at rest per px of ascender height, to fit the stage.
  const unitWidth = face ? typesetRow(face.metrics, 1 / face.metrics.ascent, s.tracking).width : pathRow(pathKindOf(s), text, 1, s).width;
  const asked = (s.heightVw / 100) * box.w;
  const size = unitWidth > 0 ? Math.min(asked, (FIT_SHARE * box.w) / unitWidth) : asked;
  const fittedVw = size < asked - 0.01 && box.w ? (size / box.w) * 100 : null;
  const ink = face
    ? typesetInk(face.metrics, { leanDeg: response === "lean" ? s.leanDeg : 0, grow: response === "grow" ? s.grow : 0 })
    : pathInk(pathKindOf(s), text, s, response === "swell");
  const restInk = face ? typesetInk(face.metrics, { leanDeg: 0, grow: 0 }) : pathInk(pathKindOf(s), text, s, false);
  const band = wordBand(size, ink, restInk, s.floor, s.gap);
  const baselineY = box.bandTop + band.height - band.baselineFromBottom;
  // Under the ink's lowest reach (the press can overshoot a little, and a
  // web font's measured ink can round), so the rise comes out of a line the
  // letters never cross at rest. Inside the floor's clearance of 0.05.
  const riseFloor = baselineY + (ink.bottom + 0.04) * size;
  const geo: WordGeometry = {
    stageW: box.w,
    stageH: box.h,
    baselineY,
    wordTop: baselineY - ink.top * size,
    clipBottom: s.connect === "below" ? Math.min(riseFloor, box.bandTop + band.height) : riseFloor,
  };
  const depths = fieldDepths(s.field);

  const spanPct = box.w ? ((unitWidth * size) / box.w) * 100 : 0;
  const croppedPct = croppedShare(ink, restInk, s.floor) * 100;
  useEffect(() => onReadout({ sizePx: size, spanPct, stageWidth: box.w, croppedPct, fittedVw }), [size, spanPct, box.w, croppedPct, fittedVw, onReadout]);

  return (
    <section
      ref={stage}
      aria-label="Footer stage"
      className="relative isolate select-none overflow-hidden bg-background text-foreground"
      style={{ touchAction: "pan-y" }}
    >
      {s.field.on && box.w > 0 && (
        <div className="pointer-events-none absolute inset-0" style={fieldMask(s, geo, size, depths.backdropShare)}>
          <div className="absolute inset-0" style={s.field.flip ? { transform: "scaleY(-1)" } : undefined}>
            <FieldBackdrop theme={theme} intensity={depths.canvas} drift={s.field.drift} forceStandIn={forceStandIn} reduced={reduced} onKind={onBackdrop} />
          </div>
        </div>
      )}
      {box.w > 0 && typeface.kind !== "loading" && (
        <Wordmark
          text={text}
          s={s}
          size={size}
          geo={geo}
          ink={ink}
          face={face}
          pathKind={pathKind}
          response={response}
          letterVeil={depths.letterVeil}
          reduced={reduced}
          replay={replay}
          stage={stage}
          egg={egg}
        />
      )}
      <h2 className="sr-only">{text}</h2>
      <div className="relative z-10 flex flex-col px-6 md:px-10">
        {s.connect === "above" && <ConnectRow placement="above" />}
        <div ref={bandRef} style={{ height: band.height }} />
        {s.connect === "below" && <ConnectRow placement="below" />}
      </div>
    </section>
  );
}
