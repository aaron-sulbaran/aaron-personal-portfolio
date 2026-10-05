"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Colorway, Origin, Variant } from "./settings";

// The fill hover after Hyperiux's arrow fill button: https://21st.dev/@hyperiux/components/arrow-fill-button
//
// One clock: --fx-p (a registered number, controls.css) runs 0 to 1 on
// hover, keyboard focus or a touch press, and every moving part reads it.
// The control renders its content twice in one grid cell: the base copy in
// the rest colors, and an aria-hidden copy on the fill's surface in the fill's
// text color, clipped by a clip-path built from --fx-p. The fill and the
// label's color change are the same clip, so they can never drift apart, and
// nothing in the layout moves. The variant only picks the clip's shape:
//   circle   the reference: an inset clip from a seed ([data-fx-seed]) to 0
//   icon     a circle from the icon's centre ([data-fx-icon]) to the far corner
//   wipe     an inset clip from one edge (origin)
//   rise     the underline (or a row's hairline) is the clip at rest and rises
//   pointer  a circle from where the pointer came in (focus: the centre)
// Reduced motion drops the transition, so the colors swap instantly.

type Tag = "button" | "a" | "span";

type Props = {
  as?: Tag;
  variant: Variant;
  colorway: Colorway;
  origin?: Origin;
  shape?: "pill" | "rect";
  // For "rise": the line's thickness, and the side padding the line stays inside of at rest.
  line?: number;
  lineInset?: number;
  className?: string;
  inner: string;
  style?: CSSProperties;
  href?: string;
  pressed?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  children: ReactNode;
};

export function Fx({
  as = "button",
  variant,
  colorway,
  origin = "start",
  shape = "pill",
  line = 1,
  lineInset = 0,
  className = "",
  inner,
  style,
  href,
  pressed,
  ariaLabel,
  onClick,
  children,
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const baseRef = useRef<HTMLSpanElement | null>(null);
  const releaseTimer = useRef(0);

  // Measures the seed and the icon in the base copy, so the clip knows where
  // the circle sits and how far the far corner is.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const base = baseRef.current;
    if (!root || !base) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      if (!box.width) return;
      const seed = base.querySelector<HTMLElement>("[data-fx-seed]")?.getBoundingClientRect();
      if (seed) {
        root.style.setProperty("--fx-st", `${seed.top - box.top}px`);
        root.style.setProperty("--fx-sr", `${box.right - seed.right}px`);
        root.style.setProperty("--fx-sb", `${box.bottom - seed.bottom}px`);
        root.style.setProperty("--fx-sl", `${seed.left - box.left}px`);
        root.style.setProperty("--fx-s0", `${Math.min(seed.width, seed.height) / 2}px`);
      }
      const icon = base.querySelector<HTMLElement>("[data-fx-icon]")?.getBoundingClientRect();
      const ox = icon ? icon.left + icon.width / 2 - box.left : box.width / 2;
      const oy = icon ? icon.top + icon.height / 2 - box.top : box.height / 2;
      setOrigin(root, ox, oy, box.width, box.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [variant]);

  useLayoutEffect(() => () => window.clearTimeout(releaseTimer.current), []);

  const follow = (event: PointerEvent<HTMLElement>) => {
    if (variant !== "pointer") return;
    const root = event.currentTarget;
    const box = root.getBoundingClientRect();
    setOrigin(root, event.clientX - box.left, event.clientY - box.top, box.width, box.height);
  };

  // Touch and pen: the fill plays on the press and holds one duration past
  // the release, so a tap shows it at all.
  const press = (event: PointerEvent<HTMLElement>) => {
    follow(event);
    if (event.pointerType === "mouse") return;
    window.clearTimeout(releaseTimer.current);
    event.currentTarget.dataset.pressed = "";
  };
  const release = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    const root = event.currentTarget;
    const ms = parseFloat(getComputedStyle(root).getPropertyValue("--fx-ms")) || 450;
    releaseTimer.current = window.setTimeout(() => delete root.dataset.pressed, ms);
  };

  const shared = {
    className: `fx ${className}`,
    "data-variant": variant,
    "data-colorway": colorway,
    "data-origin": origin,
    "data-shape": shape,
    style: { ...style, "--fx-line": `${line}px`, "--fx-line-inset": `${lineInset}px` } as CSSProperties,
    onPointerEnter: follow,
    onPointerLeave: follow,
    onPointerDown: press,
    onPointerUp: release,
    onPointerCancel: release,
    onClick,
    "aria-label": ariaLabel,
    "data-cursor-hover": true,
  };
  const content = (
    <>
      <span ref={baseRef} className={`fx-base ${inner}`}>
        {children}
      </span>
      <span aria-hidden="true" className={`fx-over ${inner}`}>
        {children}
      </span>
    </>
  );

  if (as === "a") {
    return (
      <a ref={(el) => {
          rootRef.current = el;
        }} href={href ?? "#"} {...shared} onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}>
        {content}
      </a>
    );
  }
  if (as === "span") {
    return (
      <span ref={(el) => {
          rootRef.current = el;
        }} {...shared}>
        {content}
      </span>
    );
  }
  return (
    <button ref={(el) => {
          rootRef.current = el;
        }} type="button" aria-pressed={pressed} {...shared}>
      {content}
    </button>
  );
}

function setOrigin(root: HTMLElement, x: number, y: number, w: number, h: number) {
  const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  root.style.setProperty("--fx-ox", `${x}px`);
  root.style.setProperty("--fx-oy", `${y}px`);
  root.style.setProperty("--fx-r1", `${Math.ceil(far) + 1}px`);
}

// The arrow pair: the resting arrow leaves along its own direction and
// shrinks; the second arrives from the opposite side and grows. Both read
// --fx-p, so they keep the fill's clock.
export function FxArrow({ dir = "right", size = 16, className = "" }: { dir?: "right" | "up-right"; size?: number; className?: string }) {
  const Icon = dir === "right" ? ArrowRight : ArrowUpRight;
  return (
    <span className={`fx-arrow ${className}`} data-dir={dir} style={{ width: size, height: size }}>
      <Icon aria-hidden="true" className="fx-arrow-a" size={size} strokeWidth={2} />
      <Icon aria-hidden="true" className="fx-arrow-b" size={size} strokeWidth={2} />
    </span>
  );
}
