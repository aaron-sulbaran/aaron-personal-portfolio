"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { siteContent } from "@/lib/content";

// Each photo has a hand-picked scattered starting position (in % of the hero
// viewport from the center) and a ring index. Values are tuned to avoid the
// center text zone (~42% wide x 28% tall) and to feel organic, not grid-aligned.
type ScatterPoint = { x: number; y: number; r: number };
// Scatter positions sit radially outside each photo's ring position, so each
// photo moves inward along its own axis during the gather instead of sweeping
// across the viewport and crossing the central text zone. Small per-photo
// asymmetry keeps the scatter from looking like a perfect circle.
// x/y in vmin units, r in degrees.
const SCATTER: ScatterPoint[] = [
  { x:  -8, y: -78, r:  10 }, // 0  — top, drifts up and slightly left
  { x:  64, y: -58, r:  22 }, // 1  — upper-right, drifts outward
  { x:  82, y:   2, r:  -8 }, // 2  — right, drifts outward
  { x:  42, y:  72, r: -24 }, // 3  — lower-right, drifts outward
  { x: -40, y:  76, r:  28 }, // 4  — lower-left, drifts outward
  { x: -82, y:   8, r:  -6 }, // 5  — left, drifts outward
  { x: -62, y: -60, r: -26 }, // 6  — upper-left, drifts outward
];

// Ring radius as % of min(vw, vh). Sized generously so every photo sits
// outside the central text zone throughout the gather, including the mid-
// transition frames where photos are still drifting.
const RING_RADIUS_VMIN = 56;
const RING_RADIUS_VMIN_MOBILE = 56;

// Indices of SCATTER/photos kept when rendering the smaller mobile ring.
const MOBILE_KEEP = [0, 1, 3, 4, 6] as const;

type PhotoAnimProps = {
  index: number;
  total: number;
  scatter: ScatterPoint;
  ringRadiusVmin: number;
  progress: MotionValue<number>;
  continuousRotation: MotionValue<number>;
  src: string;
  alt: string;
  visible: boolean;
};

function PhotoFrame({ index, total, scatter, ringRadiusVmin, progress, continuousRotation, src, alt, visible }: PhotoAnimProps) {
  // Angle on the final ring, in radians. Start at -90deg so the first photo is
  // at top-center; distribute evenly from there going clockwise.
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;

  // Ring target position in vmin units, converted to CSS later.
  const ringX = Math.cos(angle) * ringRadiusVmin;
  const ringY = Math.sin(angle) * ringRadiusVmin;

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

  // Scale shrinks slightly as photos gather in, adding a second dimension of
  // visible change during the sticky scroll arena.
  const scale = useTransform(eased, [0, 1], [1.08, 1]);

  return (
    // Static wrapper centers the motion.div at the viewport center; Framer
    // Motion's transform (x/y/rotate) would otherwise overwrite Tailwind's
    // -translate-1/2 utilities and the photo would drift from center.
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-0 w-0">
      <motion.div
        style={{ x, y, rotate, scale, opacity: entryOpacity }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entryOpacity }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 + index * 0.05 }}
        className="will-change-transform"
      >
        <div className="pointer-events-auto relative -ml-[9.5vmin] -mt-[12.5vmin] h-[25vmin] max-h-[190px] min-h-[130px] w-[19vmin] min-w-[96px] max-w-[144px] overflow-hidden rounded-[20px] bg-glass-strong shadow-[0_16px_40px_-20px_rgba(10,10,10,0.45),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_1px_0_rgba(255,255,255,0.35)_inset] ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-md transition-transform duration-200 hover:scale-[1.03]">
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

type Photo = (typeof siteContent.photos)[number];

function StaticCluster({ photos, ringRadiusVmin }: { photos: ReadonlyArray<Photo>; ringRadiusVmin: number }) {
  // Reduced-motion / no-JS fallback: photos composed in a static ring.
  return (
    <div className="pointer-events-none absolute inset-0">
      {photos.map((photo, i) => {
        const total = photos.length;
        const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
        const x = Math.cos(angle) * ringRadiusVmin;
        const y = Math.sin(angle) * ringRadiusVmin;
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

  // On mobile we show 5 photos instead of 7 for perf + readability, and pull
  // the ring in so it clears the narrower viewport width.
  const photos: ReadonlyArray<Photo> = useMemo(
    () => (isMobile ? MOBILE_KEEP.map((i) => siteContent.photos[i]) : siteContent.photos),
    [isMobile],
  );

  const scatters = useMemo(
    () => (isMobile ? MOBILE_KEEP.map((i) => SCATTER[i]) : SCATTER),
    [isMobile],
  );

  const ringRadius = isMobile ? RING_RADIUS_VMIN_MOBILE : RING_RADIUS_VMIN;

  if (prefersReducedMotion) return <StaticCluster photos={photos} ringRadiusVmin={ringRadius} />;

  return (
    <div className="pointer-events-none absolute inset-0">
      {photos.map((photo, i) => (
        <PhotoFrame
          key={photo.src}
          index={i}
          total={photos.length}
          scatter={scatters[i]}
          ringRadiusVmin={ringRadius}
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

