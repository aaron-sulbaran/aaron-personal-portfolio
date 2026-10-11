"use client";
import Image from "next/image";
import { useState, type Ref } from "react";
import type { TipState } from "@/lib/inline/tipState";
import { shownLink, tipView } from "@/lib/inline/view";
import { POP_PHOTO_SIZES } from "@/lib/photoSizes";
// The one label every tip and photo pop shares, portalled to body and placed
// by useTipController. Hidden from assistive tech: each link already carries
// these words through aria-describedby. A pop's link shows only when a tap
// pinned it, the touch path to an href the tap did not follow. A tip that holds
// a link (register tip.link) is the exception: the label takes the pointer, its
// words stay hidden but its link is a real, tabbable anchor while the tip is
// open (the trap in lib/modal counts the label as inside its dialog, through
// data-trap-extension), and while it fades the label is inert. Once the state
// goes idle the label keeps its last words while it fades out.
export function TipBubble({ state, ref }: { state: TipState; ref: Ref<HTMLDivElement> }) {
  const [last, setLast] = useState(state);
  if (state.target && state !== last) setLast(state);
  const shown = state.target ? state : last;
  const view = shown.target ? tipView(shown.target.kind, shown.target.key) : null;
  const link = shown.target ? shownLink(shown.target.kind, shown.target.key, shown.via) : null;
  const live = !!state.target;
  const tipLink = shown.target?.kind === "tip" ? link : null;
  const pinnedLink = tipLink ? null : link;
  return (
    <div ref={ref} aria-hidden={tipLink ? undefined : "true"} inert={tipLink && !live ? true : undefined} data-inline-tip="" data-trap-extension="" data-shown={live && view ? "true" : "false"} data-mode={shown.via ?? undefined}
      data-target={shown.target ? `${shown.target.kind}:${shown.target.key}` : undefined} style={{ pointerEvents: live && (tipLink || (state.via === "tap" && pinnedLink)) ? "auto" : "none" }} className="inline-tip">
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
        <span className="flex w-[296px] max-w-[calc(100vw-24px)] flex-col gap-2 rounded-xl border border-border bg-background p-2 text-foreground shadow-[var(--pill-shadow)]">
          {view.photo && (
            <Image src={view.photo.src} alt={view.photo.alt} width={view.photo.displayWidth} height={view.photo.displayHeight} sizes={POP_PHOTO_SIZES} loading="eager" className="h-auto w-full rounded-lg" />
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
