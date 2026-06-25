"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// The WhoIAm signature: the long bio "reads along" as you scroll. On desktop it
// adds the .read-along clip-gradient (globals.css) and scrubs --read-pos from a
// low value to 100%, so the bright foreground band sweeps down the muted
// paragraph in step with the scroll, the way the ring's deliberateness is
// applied to reading. Mobile keeps the paragraph plain foreground (the scrub
// would compete with reading on a small screen); so do reduced-motion and a
// JS-disabled load, since the class is only added imperatively after mount.
export function ReadAlong({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      el.classList.add("read-along");
      el.style.setProperty("--read-pos", "6%");
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 80%",
        end: "bottom 45%",
        scrub: 0.3,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          el.style.setProperty("--read-pos", `${6 + self.progress * 94}%`);
        },
      });
      return () => {
        st.kill();
        el.classList.remove("read-along");
        el.style.removeProperty("--read-pos");
      };
    });

    return () => mm.revert();
  }, [reduce]);

  return (
    <p ref={ref} className={className}>
      {text}
    </p>
  );
}
