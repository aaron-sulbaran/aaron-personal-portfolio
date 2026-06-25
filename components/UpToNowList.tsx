"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { revealIndex } from "@/lib/motion";

// The UpToNow list as a client leaf. Two scroll behaviours kept on separate
// elements so no element is ever driven by two systems:
//   - entrance reveal: CSS .reveal-item on the number + text (data-armed/shown
//     toggled here, same contract as <Reveal>), a number-then-text micro-stagger.
//   - parallax: GSAP scrubs translateY on the inner layer div (desktop only),
//     odd/even columns drifting opposite so the editorial 2-up offset breathes.
// The <li> keeps its static md:translate-y-12 offset (a third, untouched
// transform owner). Reduced motion and JS-disabled both render the static,
// fully-visible list.
export function UpToNowList({ items }: { items: readonly string[] }) {
  const olRef = useRef<HTMLOListElement | null>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  const reduce = useReducedMotion();

  // Entrance reveal (mirrors <Reveal>): native IntersectionObserver so it is
  // independent of GSAP and can never trap content invisible.
  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const el = olRef.current;
    if (!el) return;
    setArmed(true);
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  // Parallax drift (desktop only).
  useEffect(() => {
    if (reduce) return;
    const el = olRef.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress - 0.5; // -0.5 .. 0.5 around the midpoint
          layerRefs.current.forEach((layer, i) => {
            if (!layer) return;
            const dir = i % 2 === 1 ? 1 : -1;
            layer.style.transform = `translate3d(0, ${dir * p * 24}px, 0)`;
          });
        },
      });
      return () => {
        st.kill();
        layerRefs.current.forEach((layer) => {
          if (layer) layer.style.transform = "";
        });
      };
    });
    return () => mm.revert();
  }, [reduce]);

  return (
    <ol
      ref={olRef}
      data-reveal=""
      data-armed={armed ? "true" : undefined}
      data-shown={shown ? "true" : undefined}
      className="grid gap-10 md:grid-cols-2 md:gap-x-16 md:gap-y-16"
    >
      {items.map((item, i) => (
        <li key={i} className={i % 2 === 1 ? "md:translate-y-12" : ""}>
          <div
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="flex items-start gap-5"
          >
            <span
              className="reveal-item mt-2 font-serif text-xl italic text-muted"
              aria-hidden="true"
              style={revealIndex(i * 2)}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p
              className="reveal-item text-lg leading-[1.55] text-foreground md:text-xl"
              style={revealIndex(i * 2 + 1)}
            >
              {item}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
