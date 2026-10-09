"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCloseHint } from "@/components/PhotoModal";
import { gallerySizes, type Box } from "./rows";
import { partId } from "./timing";
import { LAB_COPY, runsOf, type LabCard, type LabPhoto, type Run } from "./cards";

// The pieces both layouts share: the header (the logo slot, the title, the
// meta line in the label face), a text block, a photo with its caption, the
// links and the close hint. Each maskable piece carries data-mask for
// useMaskIn. The md: and lg: classes of the real modals are picked from the
// frame here (see GalleryModal).

// WorkModal's glass wash behind a logo that lands without a flight.
const workTint: CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

// main's label face (font-label text-label: Profa Bold, 0.9275rem, 700, 1.25rem
// line). The lab branch predates it, so the lab's own Profa variable stands in.
const labelFace: CSSProperties = { fontFamily: "var(--lab-profa), var(--font-sans), system-ui, sans-serif", fontSize: "0.9275rem", lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: 700 };

// A tip is drawn as its words with a dotted underline; the popover itself is
// another build (tooltips.md).
function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) =>
    run.bold ? (
      <strong key={i} className="font-semibold">
        {run.text}
      </strong>
    ) : run.italic ? (
      <em key={i}>{run.text}</em>
    ) : run.tip ? (
      <span key={i} className="underline decoration-dotted underline-offset-4">
        {run.text}
      </span>
    ) : (
      <span key={i}>{run.text}</span>
    ),
  );
}

// The pager's header is tighter: a smaller logo tile and title, clear of
// the close button, so the pages keep the height.
export function Header({ card, theme, compact, tight = false }: { card: LabCard; theme: "light" | "dark"; compact: boolean; tight?: boolean }) {
  return (
    <div className={`flex items-center ${tight ? "gap-4 pr-12" : "gap-5"} ${compact || tight ? "" : "pr-12"}`}>
      {card.flownPhoto === undefined && card.logo && (
        <div data-tile-slot="work" data-mask-flown="" className={`relative shrink-0 overflow-hidden rounded-xl ${tight ? "h-14 w-14" : "h-20 w-20"}`}>
          <span aria-hidden="true" className="absolute inset-0" style={workTint} />
          <div className={`absolute inset-0 flex items-center justify-center ${tight ? "p-2" : "p-2.5"}`}>
            <Image src={theme === "dark" ? card.logo.dark : card.logo.light} alt={`${card.title} logo`} width={120} height={120} className="h-auto w-[86%] object-contain opacity-90" />
          </div>
        </div>
      )}
      <div className={`flex min-w-0 flex-col ${tight ? "gap-1" : "gap-1.5"}`}>
        <div data-mask={partId.title} data-mask-kind="text">
          <h2 data-mask-inner="" data-mask-split="" className={`font-display leading-tight text-foreground ${tight ? "text-[1.75rem]" : compact ? "text-3xl" : "text-4xl"}`}>
            {card.title}
          </h2>
        </div>
        <div data-mask={partId.meta} data-mask-kind="text">
          <p data-mask-inner="" data-mask-split="" className="text-accent" style={labelFace}>
            <Runs runs={runsOf(card.modalMeta ?? card.meta)} />
          </p>
        </div>
      </div>
    </div>
  );
}

// A block shown twice (a round five group's pages on a phone) takes its own
// mask id the second time, so no two parts share one.
export function TextBlock({ card, block, compact, className = "", maskId }: { card: LabCard; block: number; compact: boolean; className?: string; maskId?: string }) {
  return (
    <div data-mask={maskId ?? partId.block(block)} data-mask-kind="text" className={className}>
      <p data-mask-inner="" data-mask-split="" className={`text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"}`}>
        <Runs runs={runsOf(card.blocks[block])} />
      </p>
    </div>
  );
}

// Where a photo has no sentence yet: a marked slot Aaron fills, naming the
// photo it waits for. Clearly not copy.
export function Note({ photo, index, compact }: { photo: LabPhoto; index: number; compact: boolean }) {
  return (
    <div data-mask={partId.note(index)} data-mask-kind="text" data-mask-clip="" data-note="">
      <div data-mask-inner="" className={`flex flex-col gap-1 rounded-xl border border-dashed border-muted ${compact ? "px-3.5 py-3" : "px-5 py-4"}`}>
        <p className={`font-medium text-accent ${compact ? "text-sm" : "text-base"}`}>{LAB_COPY.placeholder}</p>
        <p className="text-sm leading-snug text-muted">{LAB_COPY.placeholderShows(photo.intended)}</p>
      </div>
    </div>
  );
}

// `small`: round six's strip, whose frames are a third of the inner width.
export function Caption({ id, text, className = "", small = false }: { id: string; text: string; className?: string; small?: boolean }) {
  return (
    <div data-mask={id} data-mask-kind="text" className={className}>
      <p data-mask-inner="" data-mask-split="" className={`${small ? "text-[0.8125rem]" : "text-sm"} leading-snug text-muted`}>
        {text}
      </p>
    </div>
  );
}

// A photo drawn at its own shape and a set width, its caption under it. The
// outer box keeps the size; the mask clips the inner layer, so a mask never
// moves the layout. The stand-in is cropped to the real photo's shape.
export function MaskedPhoto({ photo, index, box, aspect, flown }: { photo: LabPhoto; index: number; box: Box; aspect: number; flown: boolean }) {
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-2.5" style={{ width: box.width }} data-photo-frame={index}>
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        <div data-mask={partId.photo(index)} data-mask-kind="photo" {...(flown ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
          <div data-mask-media="" className="absolute inset-0">
            <Image src={photo.src} alt={photo.alt} fill quality={90} sizes={gallerySizes(photo.width / photo.height, aspect, box.width)} className="object-cover" />
          </div>
        </div>
      </div>
      {photo.caption && (
        <figcaption>
          <Caption id={partId.caption(index)} text={photo.caption} />
        </figcaption>
      )}
    </figure>
  );
}

export function Links({ card }: { card: LabCard }) {
  if (!card.links.length) return null;
  return (
    <div data-mask="links" data-mask-kind="text">
      <ul data-mask-inner="" className="flex flex-wrap gap-x-6 gap-y-2">
        {card.links.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-lg font-medium text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-hover hover:underline">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CloseHint() {
  const hint = useCloseHint();
  return <p className="text-sm text-muted">{hint}</p>;
}
