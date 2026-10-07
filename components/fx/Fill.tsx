"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { FILL, arrowShift, fillVars, type ArrowDir, type FillColorway, type FillVariant, type Rect } from "@/lib/fx/fill";

// The house hover fill (globals.css, "The fill"). The root keeps its content
// in place; one aria-hidden, inert copy sits over it on the fill's colours,
// clipped by --fx-p. overClassName must give that copy the root's inner
// layout (display, gap, padding) or the two labels part mid-fill. Server
// components import FILL_PICK and CTA_CLASS from lib/fx/fill, never from here.

type FillOwn = {
  variant: FillVariant;
  colorway: FillColorway;
  shape?: "pill" | "rect";
  line?: number;
  overClassName?: string;
  children: ReactNode;
};
type ButtonRoot = { as?: "button"; ref?: Ref<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>;
type AnchorRoot = { as: "a"; ref?: Ref<HTMLAnchorElement> } & AnchorHTMLAttributes<HTMLAnchorElement>;
type LinkRoot = { as: "link"; href: string; ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
type RootProps = ButtonRoot | AnchorRoot | LinkRoot;
export type FillProps = FillOwn & RootProps;

// Outside the component so the compiler's lint does not read it as mutating a prop.
function assignRef(ref: Ref<HTMLButtonElement> | Ref<HTMLAnchorElement> | undefined, el: HTMLElement | null) {
  if (typeof ref === "function") (ref as (node: HTMLElement | null) => void)(el);
  else if (ref) (ref as { current: HTMLElement | null }).current = el;
}

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function Fill(props: FillProps) {
  const { variant, colorway, shape = "pill", line = 0, overClassName = "", children, ...rootProps } = props;
  const { as: kind = "button", ref, className = "", style, ...rest } = rootProps as RootProps;
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback(
    (el: HTMLElement | null) => {
      rootRef.current = el;
      assignRef(ref, el);
    },
    [ref],
  );
  useFillGeometry(rootRef, variant);
  useTouchPress(rootRef);

  const shared = {
    className: `fx ${className}`,
    style: { ...style, "--fx-line": `${line}px` } as CSSProperties,
    "data-fill": variant,
    "data-colorway": colorway,
    "data-shape": shape,
  };
  const content = (
    <>
      {children}
      <span aria-hidden="true" inert className={`fx-over ${overClassName}`}>
        {children}
      </span>
    </>
  );
  if (kind === "link") {
    const linkProps = rest as Omit<LinkRoot, "as" | "ref" | "className" | "style">;
    return <Link {...linkProps} {...shared} ref={setRoot}>{content}</Link>;
  }
  if (kind === "a") {
    return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} {...shared} ref={setRoot}>{content}</a>;
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} {...shared} ref={setRoot}>
      {content}
    </button>
  );
}

// The circle's start, its reach and the rise line's insets, from the base copy
// (the first match in document order), re-measured whenever the root resizes.
// Marks are mapped into the root's layout space, so a root inside a scaled
// panel (a modal mounting at 0.97) measures as it will rest; ResizeObserver
// never fires when a transform ends.
function useFillGeometry(rootRef: RefObject<HTMLElement | null>, variant: FillVariant) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const box = rectOf(root);
      if (!box || !box.width) return;
      const k = root.offsetWidth / box.width || 1;
      const local = (r: Rect | null): Rect | null =>
        r && { left: (r.left - box.left) * k, top: (r.top - box.top) * k, width: r.width * k, height: r.height * k };
      const layoutBox = { left: 0, top: 0, width: root.offsetWidth, height: root.offsetHeight };
      const computed = getComputedStyle(root);
      const marks = {
        icon: local(rectOf(root.querySelector("[data-fill-icon]"))),
        seed: local(rectOf(root.querySelector("[data-fill-seed]"))),
        pad: { left: parseFloat(computed.paddingLeft) || 0, right: parseFloat(computed.paddingRight) || 0 },
      };
      for (const [name, value] of Object.entries(fillVars(variant, layoutBox, marks))) root.style.setProperty(name, value);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef, variant]);
}

// Touch and pen: the fill plays on the press and holds one duration past the
// release, so a tap shows it at all. A cancel (a scroll that started on the
// control) drops it at once.
function useTouchPress(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer = 0;
    const press = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      window.clearTimeout(timer);
      root.dataset.pressed = "";
    };
    const release = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => delete root.dataset.pressed, FILL.durationMs);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      window.clearTimeout(timer);
      delete root.dataset.pressed;
    };
    root.addEventListener("pointerdown", press);
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", cancel);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("pointerdown", press);
      root.removeEventListener("pointerup", release);
      root.removeEventListener("pointercancel", cancel);
    };
  }, [rootRef]);
}

export function FillArrow({ dir = "right", size = 16, className = "" }: { dir?: ArrowDir; size?: number; className?: string }) {
  const Icon = dir === "right" ? ArrowRight : ArrowUpRight;
  const shift = arrowShift(dir);
  return (
    <span aria-hidden="true" className={`fx-arrow ${className}`} style={{ width: size, height: size, "--ax": shift.x, "--ay": shift.y } as CSSProperties}>
      <Icon className="fx-arrow-a" size={size} strokeWidth={2} />
      <Icon className="fx-arrow-b" size={size} strokeWidth={2} />
    </span>
  );
}

export function FillSeed({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span data-fill-seed className={`fx-seed ${className}`}>
      {children}
    </span>
  );
}
