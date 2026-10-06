import type { ReactNode } from "react";
import type { KickerFace } from "./settings";

// A section's kicker (the short rule and its label), as on the site. The label
// face is either the site's Inter today or the label face spec's Profa Bold
// (docs/label-face-spec.md: the label step, 0.01em tracking, muted).
const FACE: Record<KickerFace, string> = {
  profa: "[font-family:var(--lab-profa)] font-bold text-[0.9275rem] leading-5 tracking-[0.01em]",
  inter: "text-sm",
};

export function Kicker({ label, face }: { label: string; face: KickerFace }) {
  return (
    <div data-sl-block="kicker" data-wave-avoid className={`flex items-center gap-3 text-muted ${FACE[face]}`}>
      <span data-sl-rule className="inline-block h-px w-8 bg-border" aria-hidden="true" />
      <span data-sl-label>{label}</span>
    </div>
  );
}

// A wrapper that holds its children in place while the rest of the section
// scrolls past (CSS position: sticky, desktop only; sections.css).
export function StickyCol({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div data-sl-col className={className}>
      <div data-sl-sticky={on ? "on" : "off"}>{children}</div>
    </div>
  );
}
