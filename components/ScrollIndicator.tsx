"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useState } from "react";

export function ScrollIndicator({ label }: { label: string }) {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 120], [1, 0]);
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (y > 160 && !hidden) setHidden(true);
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity: hidden ? 0 : opacity }}
      className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 md:bottom-10"
    >
      <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
        {label}
      </span>
      <span className="relative block h-10 w-px overflow-hidden bg-border">
        <motion.span
          className="absolute inset-x-0 top-0 block h-4 w-px bg-accent"
          animate={{ y: [-16, 40] }}
          transition={{
            duration: 1.8,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
        />
      </span>
    </motion.div>
  );
}
