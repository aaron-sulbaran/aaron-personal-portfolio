"use client";

import Image from "next/image";
import type { WorkItem } from "@/lib/content";

type WorkCardProps = {
  item: WorkItem;
  onClick: (item: WorkItem) => void;
};

// Visual language intentionally echoes the hero photo frames: portrait
// aspect, glass background, subtle inner shadow and dark-mode-aware ring.
// The logo tile is centered so every card has the same silhouette regardless
// of logo size or aspect.
export function WorkCard({ item, onClick }: WorkCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      aria-haspopup="dialog"
      aria-label={`Open preview for ${item.title}, ${item.role}`}
      className="group flex w-full flex-col items-start gap-3 text-left focus:outline-none"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-glass-strong shadow-[0_14px_36px_-18px_rgba(10,10,10,0.45),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_1px_0_rgba(255,255,255,0.35)_inset] ring-1 ring-black/5 backdrop-blur-md transition-transform duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] dark:ring-white/10">
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <Image
            src={item.logo}
            alt={`${item.title} logo`}
            width={180}
            height={180}
            className="h-auto w-[70%] object-contain"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
          {item.role}
        </span>
        <span className="font-serif text-xl italic leading-tight text-foreground transition-colors duration-200 group-hover:text-accent md:text-2xl">
          {item.title}
        </span>
      </div>
    </button>
  );
}
