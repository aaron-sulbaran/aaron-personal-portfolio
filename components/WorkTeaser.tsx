"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { WorkCard } from "./WorkCard";
import { WorkModal } from "./WorkModal";
import { siteContent, type WorkItem } from "@/lib/content";

// Cards enter from the right edge as the user scrolls into the section.
// Each card's x transform is tied to scroll progress with a per-card stagger
// offset so they arrive one after the other, reinforcing the "cards come
// back" continuity from the hero ring.
export function WorkTeaser() {
  const ref = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { label, heading, lede, seeAll } = siteContent.work;
  const featured = siteContent.workItems.filter((i) => i.featuredOnHome).slice(0, 4);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const smoothed = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 26,
    mass: 0.4,
    restDelta: 0.001,
  });

  return (
    <>
      <section
        ref={ref}
        aria-label={label}
        className="relative w-full border-t border-border/70 px-6 py-24 md:px-10 md:py-40"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
              <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <h2 className="font-serif text-section italic md:max-w-[18ch] md:text-right">
              {heading}
            </h2>
          </div>

          <p className="mb-16 max-w-xl text-lg leading-[1.55] text-muted">{lede}</p>

          <ul className="grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-8">
            {featured.map((item, i) => (
              <WorkCardEntry
                key={item.slug}
                item={item}
                index={i}
                progress={smoothed}
                prefersReducedMotion={prefersReducedMotion}
                onClick={setSelected}
              />
            ))}
          </ul>

          <div className="mt-14 flex justify-end md:mt-20">
            <Link
              href="/work"
              className="group inline-flex items-center gap-2 text-base font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
            >
              {seeAll}
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <WorkModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

type EntryProps = {
  item: WorkItem;
  index: number;
  progress: ReturnType<typeof useSpring>;
  prefersReducedMotion: boolean | null;
  onClick: (item: WorkItem) => void;
};

// Per-card motion: as the user scrolls through roughly the first 40% of the
// section's scroll range, cards animate in from the right with stagger.
function WorkCardEntry({ item, index, progress, prefersReducedMotion, onClick }: EntryProps) {
  // Each card gets a slice of the 0..0.4 range, offset by index.
  const slice = 0.08;
  const start = 0.08 + index * slice;
  const end = start + 0.22;

  const x = useTransform(progress, [start, end], [220, 0]);
  const opacity = useTransform(progress, [start, end], [0, 1]);

  if (prefersReducedMotion) {
    return (
      <li>
        <WorkCard item={item} onClick={onClick} />
      </li>
    );
  }

  return (
    <motion.li style={{ x, opacity }} className="will-change-transform">
      <WorkCard item={item} onClick={onClick} />
    </motion.li>
  );
}
