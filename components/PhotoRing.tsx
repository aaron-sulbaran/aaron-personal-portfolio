"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { siteContent } from "@/lib/content";

// Each photo has a hand-picked scattered starting position (in % of the hero
// viewport from the center) and a ring index. Values are tuned to avoid the
// center text zone (~42% wide x 28% tall) and to feel organic, not grid-aligned.
type ScatterPoint = { x: number; y: number; r: number };
const SCATTER: ScatterPoint[] = [
  { x: -52, y: -40, r: -22 }, // far top-left
  { x:  48, y: -44, r:  18 }, // far top-right
  { x: -58, y:  14, r:  -6 }, // far mid-left
  { x:  56, y:  22, r:  12 }, // far mid-right
  { x: -34, y:  46, r:  26 }, // lower-left
  { x:  36, y:  42, r: -24 }, // lower-right
  { x:  -4, y: -52, r:   8 }, // above center, slight left
];

// Ring radius as % of min(vw, vh). Sized so even the photos on the
// horizontal axis (angles 0° / 180°) clear the tagline text on desktop.
const RING_RADIUS_VMIN = 50;

type PhotoAnimProps = {
  index: number;
  total: number;
  scatter: ScatterPoint;
  progress: MotionValue<number>;
  continuousRotation: MotionValue<number>;
  src: string;
  alt: string;
  visible: boolean;
};

function PhotoFrame({ index, total, scatter, progress, continuousRotation, src, alt, visible }: PhotoAnimProps) {
  // Angle on the final ring, in radians. Start at -90deg so the first photo is
  // at top-center; distribute evenly from there going clockwise.
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;

  // Ring target position in vmin units, converted to CSS later.
  const ringX = Math.cos(angle) * RING_RADIUS_VMIN;
  const ringY = Math.sin(angle) * RING_RADIUS_VMIN;

  // Ease-out cubic for the "gathered into place" feel, not a linear snap.
  // Input is already mapped to the sticky arena by useScroll offsets, so a
  // simple clamp is enough — no further range compression needed.
  const eased = useTransform(progress, (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    return 1 - Math.pow(1 - clamped, 3);
  });

  // Interpolate x and y (as vmin % strings) between scatter and ring.
  const x = useTransform(eased, (t) => `${scatter.x * (1 - t) + ringX * t}vmin`);
  const y = useTransform(eased, (t) => `${scatter.y * (1 - t) + ringY * t}vmin`);

  // Rotation: start at scatter rotation, ease toward the photo's angle + small
  // tangent bias so photos tilt along the ring. Add continuous rotation on top
  // once the ring is fully formed.
  const tangentDeg = (angle * 180) / Math.PI + 90;
  const rotate = useTransform([eased, continuousRotation], ([t, c]) => {
    const tNum = t as number;
    const cNum = c as number;
    const settled = scatter.r * (1 - tNum) + tangentDeg * tNum;
    // Only add continuous rotation once the gather is essentially complete.
    const ambientGate = Math.max(0, tNum - 0.92) / 0.08;
    return settled + cNum * ambientGate;
  });

  // Gentle fade-in on initial mount so photos don't pop.
  const entryOpacity = visible ? 1 : 0;

  return (
    // Static wrapper centers the motion.div at the viewport center; Framer
    // Motion's transform (x/y/rotate) would otherwise overwrite Tailwind's
    // -translate-1/2 utilities and the photo would drift from center.
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-0 w-0">
      <motion.div
        style={{ x, y, rotate, opacity: entryOpacity }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entryOpacity }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 + index * 0.05 }}
        className="will-change-transform"
      >
        <div className="pointer-events-auto relative -ml-[9.5vmin] -mt-[12.5vmin] h-[25vmin] max-h-[190px] min-h-[130px] w-[19vmin] min-w-[96px] max-w-[144px] overflow-hidden rounded-[20px] border border-border/80 bg-glass-strong shadow-[0_12px_32px_-18px_rgba(10,10,10,0.35),0_0_0_1px_rgba(255,255,255,0.25)_inset] backdrop-blur-md transition-transform duration-200 hover:scale-[1.03]">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 25vmin, 19vmin"
            className="object-cover"
            priority={index < 3}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" />
        </div>
      </motion.div>
    </div>
  );
}

function StaticCluster() {
  // Reduced-motion / no-JS fallback: photos composed in a static ring.
  return (
    <div className="pointer-events-none absolute inset-0">
      {siteContent.photos.map((photo, i) => {
        const total = siteContent.photos.length;
        const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
        const x = Math.cos(angle) * RING_RADIUS_VMIN;
        const y = Math.sin(angle) * RING_RADIUS_VMIN;
        const tangent = (angle * 180) / Math.PI + 90;
        return (
          <div key={photo.src} className="absolute left-1/2 top-1/2 h-0 w-0">
            <div
              style={{ transform: `translate(${x}vmin, ${y}vmin) rotate(${tangent}deg)` }}
            >
              <div className="relative -ml-[9.5vmin] -mt-[12.5vmin] h-[25vmin] max-h-[190px] min-h-[130px] w-[19vmin] min-w-[96px] max-w-[144px] overflow-hidden rounded-[20px] border border-border/80 bg-glass-strong shadow-[0_12px_32px_-18px_rgba(10,10,10,0.35)] backdrop-blur-md">
                <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 25vmin, 19vmin" className="object-cover" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PhotoRing({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Map scroll progress across the hero's sticky "arena" only. The outer
  // container is ~180-200vh; this offset reaches progress=1 right as the
  // sticky inner panel detaches, so the ring finishes forming while still
  // pinned in view.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Continuous rotation driver once ring is formed. Time-based, paused when
  // reduced motion is on.
  const continuous = useMotionValue(0);
  useEffect(() => {
    if (prefersReducedMotion) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      // 80s per full rotation.
      const deg = ((now - start) / 80000) * 360;
      continuous.set(deg);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [continuous, prefersReducedMotion]);

  // On mobile we show 5 photos instead of 7 for perf + readability.
  const photos = useMemo(() => {
    if (!isMobile) return siteContent.photos;
    // Pick a balanced subset of indices.
    const keep = [0, 1, 3, 4, 6];
    return keep.map((i) => siteContent.photos[i]);
  }, [isMobile]);

  const scatters = useMemo(() => {
    if (!isMobile) return SCATTER;
    const keep = [0, 1, 3, 4, 6];
    return keep.map((i) => SCATTER[i]);
  }, [isMobile]);

  if (prefersReducedMotion) return <StaticCluster />;

  return (
    <div className="pointer-events-none absolute inset-0">
      {photos.map((photo, i) => (
        <PhotoFrame
          key={photo.src}
          index={i}
          total={photos.length}
          scatter={scatters[i]}
          progress={scrollYProgress}
          continuousRotation={continuous}
          src={photo.src}
          alt={photo.alt}
          visible={mounted}
        />
      ))}
    </div>
  );
}

