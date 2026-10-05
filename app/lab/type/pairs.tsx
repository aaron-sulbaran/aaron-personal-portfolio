"use client";

import { ArrowLeft } from "lucide-react";
import { siteContent } from "@/lib/content";
import { useShown } from "./context";
import { role } from "./Specimen";
import type { RoleLine } from "./settings";

// Markup the round 2 controls change: the back link's arrow (the site's
// glyph, or a drawn icon that takes the label's weight) and the role line,
// an eyebrow above its title or a subtitle below it.

const BACK_GLYPH = /^←\s*/;

export function BackLabel() {
  const { arrow } = useShown();
  const label = siteContent.work.backLabel;
  const tag = role("controls", 14);
  return (
    <a
      href="#case"
      className="mb-12 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-200 hover:text-accent md:mb-16"
      data-role={tag["data-role"]}
      style={arrow === "icon" ? { ...tag.style, gap: "var(--lab-icon-gap, 4px)" } : tag.style}
    >
      {arrow === "icon" ? (
        <>
          <ArrowLeft aria-hidden="true" className="lab-icon lab-arrow lab-arrow-sized shrink-0" />
          {label.replace(BACK_GLYPH, "")}
        </>
      ) : (
        label
      )}
    </a>
  );
}

export function RoleLineText({ line, text }: { line: RoleLine; text: string }) {
  const tag = role("meta", line.size);
  return (
    <span className="text-sm text-muted" data-role={tag["data-role"]} data-sized="" data-subtitle={line.placement === "below" ? "" : undefined} style={tag.style}>
      {text}
    </span>
  );
}
