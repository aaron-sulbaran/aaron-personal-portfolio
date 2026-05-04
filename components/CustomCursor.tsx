"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const HOVER_SELECTOR = "[data-cursor-hover], a, button, [role='button']";

// Desktop-only accent-colored cursor. Small filled dot by default; grows into
// a hollow ring when hovering any interactive target. Uses CSS var so it
// tracks the active theme's accent.
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  const springConfig = { stiffness: 700, damping: 40, mass: 0.35 };
  const sx = useSpring(x, springConfig);
  const sy = useSpring(y, springConfig);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("cursor-none");
      return;
    }

    document.documentElement.classList.add("cursor-none");

    const handleMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      if (!visible) setVisible(true);

      const target = event.target as Element | null;
      const hit = target?.closest(HOVER_SELECTOR) ?? null;
      setHovering(Boolean(hit));
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);
    const handleDown = () => setHovering((h) => h);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);
    window.addEventListener("mousedown", handleDown);

    return () => {
      document.documentElement.classList.remove("cursor-none");
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
      window.removeEventListener("mousedown", handleDown);
    };
  }, [enabled, visible, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{
        x: sx,
        y: sy,
        opacity: visible ? 1 : 0,
      }}
      className="pointer-events-none fixed left-0 top-0 z-[100] -translate-x-1/2 -translate-y-1/2"
    >
      <motion.span
        initial={false}
        animate={{
          // Smaller hover ring (was 38px) so it accents the hovered card
          // without covering it. 22px is large enough to read as "grew" but
          // small enough to leave the tile face visible behind.
          width: hovering ? 22 : 10,
          height: hovering ? 22 : 10,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.5 }}
        className="relative block rounded-full"
      >
        <motion.span
          initial={false}
          animate={{ opacity: hovering ? 0 : 1 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 rounded-full bg-accent"
        />
        <motion.span
          initial={false}
          animate={{ opacity: hovering ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 rounded-full border-[1.5px] border-accent"
        />
      </motion.span>
    </motion.div>
  );
}
