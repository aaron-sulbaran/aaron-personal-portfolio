"use client";

import Image from "next/image";
import { CARDS } from "./cards";

// A stand-in for the home behind the modal, so the blur has something real
// to frost: the name, a few cards' photos and the book's rows, which also
// reopen the modal. Not the Coil; nothing here animates.

export function PageBehind({ compact, onOpen }: { compact: boolean; onOpen: (id: string) => void }) {
  const photos = ["/photos/drum-major.jpeg", "/photos/capital-one.jpeg", "/photos/claude-hackathon.jpeg", "/photos/yosemite-hiking.jpeg", "/photos/mt-fuji.jpeg"];
  return (
    <div className={`flex h-full flex-col justify-between overflow-hidden ${compact ? "p-5" : "p-12"}`}>
      <div className="relative">
        <p aria-hidden="true" className={`font-display leading-[0.8] text-foreground ${compact ? "text-[8.5rem]" : "text-[19rem]"}`}>
          Aaron
        </p>
        <div className={`absolute flex ${compact ? "left-4 top-20 gap-2" : "left-[38%] top-10 gap-4"}`}>
          {photos.slice(0, compact ? 3 : 5).map((src, i) => (
            <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl" style={{ width: compact ? 88 : 150, transform: `translateY(${(i % 2) * 36}px) rotate(${(i - 2) * 4}deg)` }}>
              <Image src={src} alt="" fill sizes="150px" className="object-cover" />
            </div>
          ))}
        </div>
      </div>
      <ol className="flex flex-col border-t border-border">
        {CARDS.map((card) => (
          <li key={card.id} className="border-b border-border">
            <button type="button" onClick={() => onOpen(card.id)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-accent">
              <span className="font-display text-2xl">{card.title}</span>
              <span className="text-sm text-muted">{card.meta}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
