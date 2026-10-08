"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCloseHint } from "@/components/PhotoModal";
import { gallerySizes } from "./layout";
import { partId } from "./timing";
import { runsOf, type LabCard, type LabPhoto } from "./cards";

// The pieces both layouts share: the header (the logo slot, the title, the
// meta line in the label face), a text block, a masked photo, the links and
// the close hint. Each maskable piece carries data-mask for useMaskIn.

// WorkModal's glass wash behind a logo that lands without a flight.
const workTint: CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

// main's label face (font-label text-label: Profa Bold, 0.9275rem, 700, 1.25rem
// line). The lab branch predates it, so the lab's own Profa variable stands in.
const labelFace: CSSProperties = { fontFamily: "var(--lab-profa), var(--font-sans), system-ui, sans-serif", fontSize: "0.9275rem", lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: 700 };

export function Header({ card, theme, compact }: { card: LabCard; theme: "light" | "dark"; compact: boolean }) {
  return (
    <div className={`flex items-center gap-5 ${compact ? "" : "pr-12"}`}>
      {card.flown === "logo" && card.logo && (
        <div data-tile-slot="work" data-mask-flown="" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <span aria-hidden="true" className="absolute inset-0" style={workTint} />
          <div className="absolute inset-0 flex items-center justify-center p-2.5">
            <Image src={theme === "dark" ? card.logo.dark : card.logo.light} alt={`${card.title} logo`} width={120} height={120} className="h-auto w-[86%] object-contain opacity-90" />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <div data-mask={partId.title} data-mask-kind="text">
          <h2 data-mask-inner="" data-mask-split="" className={`font-display leading-tight text-foreground ${compact ? "text-3xl" : "text-4xl"}`}>
            {card.title}
          </h2>
        </div>
        <div data-mask={partId.meta} data-mask-kind="text">
          <p data-mask-inner="" data-mask-split="" className="text-accent" style={labelFace}>
            {card.meta}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TextBlock({ card, block, compact, className = "" }: { card: LabCard; block: number; compact: boolean; className?: string }) {
  return (
    <div data-mask={partId.block(block)} data-mask-kind="text" className={className}>
      <p data-mask-inner="" data-mask-split="" className={`text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"}`}>
        {runsOf(card.blocks[block]).map((run, i) =>
          run.bold ? (
            <strong key={i} className="font-semibold">
              {run.text}
            </strong>
          ) : run.italic ? (
            <em key={i}>{run.text}</em>
          ) : (
            <span key={i}>{run.text}</span>
          ),
        )}
      </p>
    </div>
  );
}

// A 3:4 photo at a set width. The outer box keeps the size; the mask clips
// the inner layer, so a mask never moves the layout. The md: and lg: classes
// of the real modals are picked from the frame here (see GalleryModal).
export function MaskedPhoto({ photo, index, width, flown, sizesWidth }: { photo: LabPhoto; index: number; width: number | string; flown: boolean; sizesWidth: number }) {
  return (
    <figure className="relative m-0 aspect-[3/4] shrink-0" style={{ width }} data-photo-frame={index}>
      <div data-mask={partId.photo(index)} data-mask-kind="photo" {...(flown ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
        <div data-mask-media="" className="absolute inset-0">
          <Image src={photo.src} alt={photo.alt} fill quality={90} sizes={gallerySizes(photo.width / photo.height, sizesWidth)} className="object-cover" />
        </div>
      </div>
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
