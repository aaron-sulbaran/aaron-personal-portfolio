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
  id?: string;
  className?: string;
  children: ReactNode;
};

// One block of the sections grammar, the only client leaf: the server renders
// it whole and readable, and after mount this arms its one timeline when
// motion is allowed or marks it still when it is not. Both conditions are
// listed because matchMedia runs the function only while one of them matches;
// a change of preference reverts and rebuilds, live, both directions. An id
// names the block for a group that is labelled by it (aria-labelledby). A
// lines-split Block's children must be static text: SplitText's revert
// restores innerHTML, so any marker or React child inside is recreated.
export function Block({ kind, as = "div", index = 0, split = "lines", id, className, children }: BlockProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    let rebuild = false;
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
      const reduce = Boolean(context.conditions?.reduce);
      const release = reduce ? () => undefined : watchLayout();
      const dispose = buildBlock(el, { kind, index, split, reduce, measure: !rebuild });
      return () => {
        dispose();
        release();
      };
    });
    rebuild = true;
    return () => mm.revert();
  }, [kind, index, split]);

  return createElement(
    as,
    {
      ref,
      id,
      className,
      "data-sections-block": kind,
      "data-sections-split": kind === "heading" || kind === "body" ? split : undefined,
    },
    children,
  );
}
