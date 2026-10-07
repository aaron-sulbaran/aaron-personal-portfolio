"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";
import { buildBlock, watchLayout } from "@/lib/sections/engine";
import type { BlockKind, Split } from "@/lib/sections/grammar";

type BlockProps = {
  kind: BlockKind;
  as?: "div" | "h2" | "p" | "li" | "ul";
  index?: number;
  split?: Split;
  className?: string;
  children: ReactNode;
};

// One block of the sections grammar, the only client leaf: the server renders
// it whole and readable, and after mount this arms its one timeline when
// motion is allowed or marks it still when it is not. Both conditions are
// listed because matchMedia runs the function only while one of them matches;
// a change of preference reverts and rebuilds, live, both directions.
export function Block({ kind, as = "div", index = 0, split = "lines", className, children }: BlockProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
      const reduce = Boolean(context.conditions?.reduce);
      const release = reduce ? () => undefined : watchLayout();
      const dispose = buildBlock(el, { kind, index, split, reduce });
      return () => {
        dispose();
        release();
      };
    });
    return () => mm.revert();
  }, [kind, index, split]);

  return createElement(
    as,
    {
      ref,
      className,
      "data-sections-block": kind,
      "data-sections-split": kind === "heading" || kind === "body" ? split : undefined,
    },
    children,
  );
}
