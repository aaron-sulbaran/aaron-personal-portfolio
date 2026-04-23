"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { siteContent, type Photo } from "@/lib/content";

// Each photo has a hand-picked scattered starting position (in vmin units from
// viewport center) and a rotation in degrees. Scatter sits radially outside
// each photo's final ring position so the gather moves inward along each
// photo's own axis instead of sweeping across the central text zone.
type ScatterPoint = { x: number; y: number; r: number };

// 14 scatter positions. Values are computed radially around a ~54vmin scatter
// circle with small per-photo jitter so the layout feels organic, not
// mathematically perfect. Keep in sync with siteContent.photos length.
const SCATTER: ScatterPoint[] = [
  { x:   1, y: -56, r:  10 }, // 0  top
  { x:  23, y: -51, r:  18 }, // 1  upper-right (high)
  { x:  42, y: -35, r: -12 }, // 2  upper-right
  { x:  54, y: -14, r:  14 }, // 3  right-upper
  { x:  55, y:  11, r:  -8 }, // 4  right-lower
  { x:  42, y:  35, r:  16 }, // 5  lower-right
  { x:  23, y:  51, r: -20 }, // 6  lower-right (low)
  { x:   1, y:  56, r:   8 }, // 7  bottom
  { x: -23, y:  51, r:  22 }, // 8  lower-left (low)
  { x: -42, y:  35, r: -16 }, // 9  lower-left
  { x: -54, y:  11, r:  10 }, // 10 left-lower
  { x: -55, y: -14, r:  -6 }, // 11 left-upper
  { x: -42, y: -35, r:  20 }, // 12 upper-left
  { x: -23, y: -51, r: -18 }, // 13 upper-left (high)
];

// Ring radius as % of min(vw, vh). On a 1440×900 landscape desktop, vmin = vh,
// so the vertical extent is governed by this value. 40vmin keeps the top and
// bottom photos fully inside the viewport. Mobile gets a wider radius since
// vmin = vw there and the narrower aspect needs more room.
const RING_RADIUS_VMIN = 40;
const RING_RADIUS_VMIN_MOBILE = 44;

// Which 6 of the 14 photos render on mobile. Picked to stay balanced around
// the ring: top, upper-right, right, bottom-left, left, upper-left.
const MOBILE_KEEP = [0, 3, 5, 7, 10, 12] as const;

type PhotoAnimProps = {
  index: number;
  total: number;
  scatter: ScatterPoint;
  ringRadiusVmin: number;
  progress: MotionValue<number>;
  continuousRotation: MotionValue<number>;
  photo: Photo;
  visible: boolean;
  onClick: (photo: Photo) => void;
};

function PhotoFrame({ index, total, scatter, ringRadiusVmin, progress, continuousRotation, photo, visible, onClick }: PhotoAnimProps) {
  // Angle on the final ring, in radians. Start at -90deg so the first photo is
  // at top-center; distribute evenly clockwise.
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;

  const ringX = Math.cos(angle) * ringRadiusVmin;
  const ringY = Math.sin(angle) * ringRadiusVmin;

  // Ease-out cubic for the "gathered into place" feel instead of linear snap.
  const eased = useTransform(progress, (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    return 1 - Math.pow(1 - clamped, 3);
  });

  const x = useTransform(eased, (t) => `${scatter.x * (1 - t) + ringX * t}vmin`);
  const y = useTransform(eased, (t) => `${scatter.y * (1 - t) + ringY * t}vmin`);

  // Rotation: scatter rotation fades into tangent bias, then a slow continuous
  // rotation layers on once the ring is fully formed.
  const tangentDeg = (angle * 180) / Math.PI + 90;
  const rotate = useTransform([eased, continuousRotation], ([t, c]) => {
    const tNum = t as number;
    const cNum = c as number;
    const settled = scatter.r * (1 - tNum) + tangentDeg * tNum;
    const ambientGate = Math.max(0, tNum - 0.92) / 0.08;
    return settled + cNum * ambientGate;
  });

  const entryOpacity = visible ? 1 : 0;

  // Scale shrinks slightly during the gather, adding a second dimension of
  // visible motion.
  const scale = useTransform(eased, [0, 1], [1.08, 1]);

  return (
    // Static wrapper centers the motion.div at viewport center; Framer Motion's
    // inline transform would otherwise overwrite Tailwind's -translate-1/2.
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-0 w-0">
      <motion.div
        style={{ x, y, rotate, scale, opacity: entryOpacity }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entryOpacity }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.08 + index * 0.04 }}
        className="will-change-transform"
      >
        <button
          type="button"
          onClick={() => onClick(photo)}
          aria-label={`Open caption for ${photo.alt}`}
          className="pointer-events-auto relative -ml-[7.5vmin] -mt-[10vmin] block h-[20vmin] max-h-[150px] min-h-[112px] w-[15vmin] min-w-[84px] max-w-[112px] overflow-hidden rounded-[18px] bg-glass-strong shadow-[0_14px_36px_-18px_rgba(10,10,10,0.45),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_1px_0_rgba(255,255,255,0.35)_inset] ring-1 ring-black/5 backdrop-blur-md transition-transform duration-200 hover:scale-[1.04] focus-visible:scale-[1.04] dark:ring-white/10"
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 768px) 22vmin, 15vmin"
            className="object-cover"
            priority={index < 4}
          />
          <span className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" aria-hidden="true" />
        </button>
      </motion.div>
    </div>
  );
}

function StaticCluster({ photos, ringRadiusVmin, onClick }: { photos: ReadonlyArray<Photo>; ringRadiusVmin: number; onClick: (photo: Photo) => void }) {
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
            <div style={{ transform: `translate(${x}vmin, ${y}vmin) rotate(${tangent}deg)` }}>
              <button
                type="button"
                onClick={() => onClick(photo)}
                aria-label={`Open caption for ${photo.alt}`}
                className="pointer-events-auto relative -ml-[7.5vmin] -mt-[10vmin] block h-[20vmin] max-h-[150px] min-h-[112px] w-[15vmin] min-w-[84px] max-w-[112px] overflow-hidden rounded-[18px] border border-border/80 bg-glass-strong shadow-[0_12px_32px_-18px_rgba(10,10,10,0.35)] backdrop-blur-md"
              >
                <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 22vmin, 15vmin" className="object-cover" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PhotoRingProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  onPhotoClick: (photo: Photo) => void;
};

export function PhotoRing({ containerRef, onPhotoClick }: PhotoRingProps) {
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

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Spring smoothing so fast wheel/trackpad flicks don't jitter the ring.
  const smoothedProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 24,
    mass: 0.4,
    restDelta: 0.001,
  });

  // Continuous rotation driver once the ring is formed. 90s loop.
  const continuous = useMotionValue(0);
  useEffect(() => {
    if (prefersReducedMotion) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const deg = ((now - start) / 90000) * 360;
      continuous.set(deg);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [continuous, prefersReducedMotion]);

  const photos: ReadonlyArray<Photo> = useMemo(
    () => (isMobile ? MOBILE_KEEP.map((i) => siteContent.photos[i]) : siteContent.photos),
    [isMobile],
  );

  const scatters = useMemo(
    () => (isMobile ? MOBILE_KEEP.map((i) => SCATTER[i]) : SCATTER),
    [isMobile],
  );

  const ringRadius = isMobile ? RING_RADIUS_VMIN_MOBILE : RING_RADIUS_VMIN;

  if (prefersReducedMotion) {
    return <StaticCluster photos={photos} ringRadiusVmin={ringRadius} onClick={onPhotoClick} />;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {photos.map((photo, i) => (
        <PhotoFrame
          key={photo.src}
          index={i}
          total={photos.length}
          scatter={scatters[i]}
          ringRadiusVmin={ringRadius}
          progress={smoothedProgress}
          continuousRotation={continuous}
          photo={photo}
          visible={mounted}
          onClick={onPhotoClick}
        />
      ))}
    </div>
  );
}
