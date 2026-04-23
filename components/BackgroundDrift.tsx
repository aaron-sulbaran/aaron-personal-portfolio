"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

// Ambient "ghost cards" that slowly drift as the user scrolls through the
// section this sits inside. Carries the visual language of photo cards
// between the hero ring (where cards exit) and the Work section (where
// cards come back in from the right) so the transition feels intentional
// rather than like two independent components.
//
// Never takes pointer events, sits behind content at low opacity.

type Card = {
  topPct: number;
  leftPct: number;
  wRem: number;
  hRem: number;
  drift: number; // px of horizontal drift across the section
  rotate: number;
  peakOpacity: number;
};

const CARDS: Card[] = [
  { topPct:  6, leftPct:  4, wRem: 5.5, hRem: 7,   drift:  70, rotate: -8,  peakOpacity: 0.12 },
  { topPct: 16, leftPct: 88, wRem: 4.5, hRem: 6,   drift: -80, rotate:  12, peakOpacity: 0.10 },
  { topPct: 38, leftPct:  2, wRem: 6,   hRem: 8,   drift:  90, rotate: -14, peakOpacity: 0.10 },
  { topPct: 52, leftPct: 90, wRem: 5,   hRem: 6.5, drift: -60, rotate:  6,  peakOpacity: 0.12 },
  { topPct: 70, leftPct:  8, wRem: 4.5, hRem: 6,   drift: 100, rotate:  10, peakOpacity: 0.10 },
  { topPct: 84, leftPct: 82, wRem: 5.5, hRem: 7,   drift: -70, rotate: -10, peakOpacity: 0.10 },
];

export function BackgroundDrift() {
  const ref = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const smoothed = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 28,
    mass: 0.4,
    restDelta: 0.001,
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {CARDS.map((card, i) => (
        <DriftCard
          key={i}
          card={card}
          progress={smoothed}
          reducedMotion={!!prefersReducedMotion}
        />
      ))}
    </div>
  );
}

type DriftProps = {
  card: Card;
  progress: ReturnType<typeof useSpring>;
  reducedMotion: boolean;
};

function DriftCard({ card, progress, reducedMotion }: DriftProps) {
  const x = useTransform(progress, [0, 1], [-card.drift / 2, card.drift / 2]);
  const opacity = useTransform(
    progress,
    [0, 0.18, 0.82, 1],
    [0, card.peakOpacity, card.peakOpacity, 0],
  );

  const common = {
    position: "absolute" as const,
    top: `${card.topPct}%`,
    left: `${card.leftPct}%`,
    width: `${card.wRem}rem`,
    height: `${card.hRem}rem`,
    borderRadius: 18,
    filter: "grayscale(100%)",
    boxShadow: "0 12px 32px -18px rgba(10,10,10,0.3)",
  };

  if (reducedMotion) {
    return (
      <div
        className="bg-muted/25"
        style={{
          ...common,
          opacity: card.peakOpacity * 0.5,
          transform: `rotate(${card.rotate}deg)`,
        }}
      />
    );
  }

  return (
    <motion.div
      className="bg-muted/25 will-change-transform"
      style={{
        ...common,
        x,
        opacity,
        rotate: card.rotate,
      }}
    />
  );
}
