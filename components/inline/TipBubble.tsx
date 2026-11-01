"use client";
import Image from "next/image";
import { useState, type CSSProperties, type Ref } from "react";
import type { TipState } from "@/lib/inline/tipState";
import { shownLink, tipView } from "@/lib/inline/view";
import { POP_SIZE_VARS } from "@/lib/photoSizes";
import { PopCycle } from "./PopCycle";
// The one label every tip and photo pop shares, portalled to body and placed
// by useTipController. Hidden from assistive tech: each link already carries
// these words through aria-describedby. A pop's link shows only when a tap
// pinned it, the touch path to an href the tap did not follow. A tip that holds
// a link (register tip.link) is the exception: the label takes the pointer, its
// words stay hidden but its link is a real, tabbable anchor while the tip is
// open (the trap in lib/modal counts the label as inside its dialog, through
// data-trap-extension), and while it fades the label is inert. Once the state
// goes idle the label keeps its last words while it fades out. Every photo pop
// is one height, its width following the photo (the sizes are lib/photoSizes's,
// written on the label as custom properties; app/globals.css, "photo pops"), and
// a pop that cycles its photos (PopCycle) fills a square of that height.
export function TipBubble({ state, ref }: { state: TipState; ref: Ref<HTMLDivElement> }) {
  const [last, setLast] = useState(state);
  if (state.target && state !== last) setLast(state);
  const shown = state.target ? state : last;
  const view = shown.target ? tipView(shown.target.kind, shown.target.key) : null;
  const link = shown.target ? shownLink(shown.target.kind, shown.target.key, shown.via) : null;
  const live = !!state.target;
  // A cycling pop starts over from its first photo on every open: each open is a new instance.
  const [opens, setOpens] = useState(0);
  const [wasLive, setWasLive] = useState(false);
  if (live !== wasLive) {
    setWasLive(live);
    if (live) setOpens(opens + 1);
  }
  const tipLink = shown.target?.kind === "tip" ? link : null;
  const pinnedLink = tipLink ? null : link;
  return (
    <div ref={ref} aria-hidden={tipLink ? undefined : "true"} inert={tipLink && !live ? true : undefined} data-inline-tip="" data-trap-extension="" data-shown={live && view ? "true" : "false"} data-mode={shown.via ?? undefined}
      data-target={shown.target ? `${shown.target.kind}:${shown.target.key}` : undefined} style={{ ...POP_SIZE_VARS, pointerEvents: live && (tipLink || (state.via === "tap" && pinnedLink)) ? "auto" : "none" } as CSSProperties} className="inline-tip">
      {view?.text && !tipLink && (
        <span className="block max-w-[20rem] rounded-2xl bg-accent px-3 py-[7px] font-sans text-[13px] font-medium leading-snug text-background">{view.text}</span>
      )}
      {view?.text && tipLink && (
        <span className="flex max-w-[20rem] flex-col gap-1.5 rounded-2xl border border-border bg-background px-3 py-2 text-foreground shadow-[var(--pill-shadow)]">
          <span aria-hidden="true" className="font-sans text-[13px] font-medium leading-snug">{view.text}</span>
          <span className="font-label text-label-sm">
            <a href={tipLink.href} target="_blank" rel="noopener noreferrer" data-inline="external" tabIndex={live ? 0 : -1} onMouseDown={(event) => event.preventDefault()} className="inline-link">{tipLink.label}</a>
          </span>
        </span>
      )}
      {view && !view.text && (
        <span data-fit={view.cycle ? "square" : view.photo?.fit} style={view.cycle ? ({ "--pop-aspect": 1 } as CSSProperties) : view.photo ? ({ "--pop-aspect": view.photo.width / view.photo.height } as CSSProperties) : undefined}
          className="pop-card gap-2 rounded-xl border border-border bg-background p-2 text-foreground shadow-[var(--pill-shadow)]">
          {view.cycle && <PopCycle key={opens} frames={view.cycle} live={live} />}
          {view.photo && (
            <span className="pop-frame rounded-lg">
              <Image src={view.photo.src} alt={view.photo.alt} fill sizes={view.photo.sizes} loading="eager" className="object-cover" />
            </span>
          )}
          {view.caption && <span className="px-1 font-label text-label-sm leading-snug text-muted">{view.caption}</span>}
          {pinnedLink && (
            <a href={pinnedLink.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} className="px-1 pb-1 font-label text-label-sm text-accent underline underline-offset-2">{pinnedLink.label}</a>
          )}
        </span>
      )}
    </div>
  );
}
