"use client";
import { useState, type CSSProperties, type Ref } from "react";
import { useHomeController } from "@/components/home/HomeController";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import type { CoilShape } from "@/lib/coil/shape";
import type { CoilEntrance } from "./CoilScene";
// The Coil and Band toggle (lab log, "Controls lab"; Aaron's pick: trailing
// delay 99ms, no glyphs): a two-half capsule whose selection is a fill over a
// second, aria-hidden and inert copy of both labels (as Fill's; globals.css,
// "The Coil and Band toggle"). Native buttons with aria-pressed, as the Flat
// and Skyline toggle. Never the class fx (controls.spec finds the hero
// control as section[data-scene] button.fx). It shows, and is reachable,
// only while a scene draws and its entrance has rested; while the unwound
// list holds its seat it stays hit-testable but dead (aria-disabled, no
// pick), so a press never falls through to a card under it. HeroOverlay
// cross-fades it through `ref`.
const SHAPES: readonly CoilShape[] = ["coil", "band"];
const LAG = { "--tg-lag": `${COIL.toggle.trailingDelayMs}ms` } as CSSProperties;
const HALF = "flex h-10 items-center justify-center px-4 font-label text-label leading-none";
type Props = {
  ref?: Ref<HTMLDivElement>; shape: CoilShape; onShapeChange: (shape: CoilShape) => void; entrance: CoilEntrance | null;
  sceneOn: boolean; held: boolean;
};
export function ShapeToggle({ ref, shape, onShapeChange, entrance, sceneOn, held }: Props) {
  const controller = useHomeController();
  const live = sceneOn && controller?.phase === "ready" && entrance !== null;
  const [dir, setDir] = useState<"left" | "right" | "none">("none");
  const labels = siteContent.hero.shapeToggle;
  const pick = (next: CoilShape) => {
    if (held || next === shape) return;
    setDir(next === "band" ? "right" : "left");
    onShapeChange(next);
  };
  return (
    <div
      ref={ref}
      role="group"
      aria-label={labels.ariaLabel}
      data-shape-toggle
      data-state={shape}
      data-dir={dir}
      inert={!live}
      style={LAG}
      className={`shape-toggle pointer-events-auto absolute bottom-[24px] left-[28px] ${live ? "" : "invisible"}`}
    >
      <span className="shape-toggle__base grid grid-cols-2">
        {SHAPES.map((key) => (
          <button
            key={key}
            type="button"
            data-seg={key}
            aria-pressed={shape === key}
            aria-disabled={held || undefined}
            onClick={() => pick(key)}
            className={`shape-toggle__seg ${HALF}`}
          >
            {labels[key]}
          </button>
        ))}
      </span>
      <span aria-hidden="true" inert className="shape-toggle__over grid grid-cols-2">
        {SHAPES.map((key) => <span key={key} className={HALF}>{labels[key]}</span>)}
      </span>
    </div>
  );
}
