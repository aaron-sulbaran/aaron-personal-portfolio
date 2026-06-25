"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";

type RevealProps = {
  children: ReactNode;
  // Element to render. Defaults to a div; pass "ul"/"section"/etc. to keep the
  // semantics and styling of the wrapped block.
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

// Wraps a block in the back-half reveal system. Renders children visible by
// default (so SSR, a JS-disabled load, and reduced-motion users all see the
// final readable state); only after mount does it set data-armed, which lets
// the globals.css rules apply the hidden initial state, then an
// IntersectionObserver flips data-shown as the block enters. The back half is
// always below the fold at load, so arming-then-hiding is never visible on
// screen.
//
// Entrance uses a native IntersectionObserver, not GSAP, so a GSAP failure can
// never trap reveal content invisible (the genuinely scroll-linked effects, the
// ASCII field, read-along, and parallax, stay on ScrollTrigger). Descendants opt
// in via className: ".reveal-item" for a staggered fade + rise, ".reveal-mask"
// for a heading rising from behind a clip. Set "--reveal-i" (revealIndex) on a
// descendant to stagger it.
export function Reveal({ children, as = "div", className, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    setArmed(true);
    // Already in view on mount (e.g. a deep reload restored via scroll recovery).
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

  return createElement(
    as,
    {
      ref,
      "data-reveal": "",
      "data-armed": armed ? "true" : undefined,
      "data-shown": shown ? "true" : undefined,
      className,
      style,
      ...rest,
    },
    children,
  );
}
