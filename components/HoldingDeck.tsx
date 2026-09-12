"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { siteContent } from "@/lib/content";
import { EASE } from "@/lib/motion";

// A miniature of the home hero's inkwell deck: five of the site's real photo
// cards in the same frosted pane (translucent fill, sheen, rim highlight, float
// shadow; see GlassTile) sitting in a loose stack. Every RIFFLE_MS the top card
// lifts over the pile and tucks in at the back, the way the ring deals cards
// during its entrance. Purely decorative: aria-hidden, empty alts, and a static
// stack under prefers-reduced-motion.

const RIFFLE_MS = 2600;
const RIFFLE_S = 0.95;
const CARD_COUNT = 5;

// Slot 0 is the top of the pile. Each card behind steps up and to the right
// with a growing tilt so the stack reads as a fanned, slightly careless pile.
const SLOTS = Array.from({ length: CARD_COUNT }, (_, i) => ({
  x: i * 12,
  y: i * -9,
  rotate: i * 3.2,
  scale: 1 - i * 0.035,
  zIndex: CARD_COUNT - i,
  opacity: 1 - i * 0.12,
}));

const BACK = SLOTS[CARD_COUNT - 1];

const photos = siteContent.photos
  .filter((p) => p.src.endsWith(".jpeg"))
  .slice(0, CARD_COUNT);

export function HoldingDeck() {
  const reduce = useReducedMotion();
  // order[slot] = photo index. Rotating the array sends the top card to the back.
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const [lifting, setLifting] = useState<number | null>(null);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setOrder((prev) => {
        const [top, ...rest] = prev;
        setLifting(top);
        return [...rest, top];
      });
    }, RIFFLE_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[184px] w-[196px] md:h-[212px] md:w-[228px]"
    >
      {photos.map((photo, photoIndex) => {
        const slot = order.indexOf(photoIndex);
        const target = SLOTS[slot];
        const isLifting = lifting === photoIndex && slot === CARD_COUNT - 1;
        return (
          <motion.div
            key={photo.src}
            className="absolute left-[14px] top-4 h-[150px] w-[120px] overflow-hidden rounded-[8px] bg-glass-strong shadow-[0_10px_30px_-14px_rgba(10,10,10,0.35)] ring-1 ring-white/25 dark:ring-white/15 md:top-6 md:h-[170px] md:w-[136px]"
            style={{ transformOrigin: "50% 60%" }}
            initial={false}
            animate={
              isLifting
                ? {
                    // Lift up and over the pile, then settle into the back slot.
                    // zIndex stays on top until the card is nearly down, then
                    // drops behind the pile in one step.
                    x: [0, BACK.x * 0.6, BACK.x],
                    y: [0, -64, BACK.y],
                    rotate: [0, -4, BACK.rotate],
                    scale: [1, 1.05, BACK.scale],
                    opacity: [1, 1, BACK.opacity],
                    zIndex: [CARD_COUNT + 1, CARD_COUNT + 1, BACK.zIndex],
                  }
                : target
            }
            transition={
              isLifting
                ? {
                    duration: RIFFLE_S,
                    ease: EASE,
                    times: [0, 0.5, 1],
                    zIndex: { duration: RIFFLE_S, times: [0, 0.82, 0.83], ease: "linear" },
                  }
                : { duration: RIFFLE_S * 0.8, ease: EASE }
            }
          >
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="136px"
              className="object-cover opacity-[0.88]"
            />
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, transparent 42%, rgba(255,255,255,0.05) 100%)",
              }}
            />
            <span className="pointer-events-none absolute inset-0 rounded-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.14)]" />
          </motion.div>
        );
      })}
    </div>
  );
}
