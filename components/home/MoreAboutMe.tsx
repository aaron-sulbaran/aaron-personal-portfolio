"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import type { DomProps } from "@/lib/home/introDom";

// "More about me": the phone's quiet disclosure in the "teaser peeks"
// arrangement (lab only: nothing shows it by default). It folds blocks 2 to 4
// away until it is opened, by one attribute on the section (data-more-open,
// which app/globals.css reads), so the first screen holds the name, block 1, the
// music line and the top of the teaser. Everywhere else it is not there.
export function MoreAboutMe({ label, controls, dom }: { label: string; controls: string; dom: DomProps }) {
  const [open, setOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    itemRef.current?.closest("[data-intro]")?.toggleAttribute("data-more-open", next);
  };

  return (
    <div ref={itemRef} data-story-item="more" data-more="" {...dom.attrs} style={dom.vars as CSSProperties} className="px-[6vw]">
      <div className="mx-auto max-w-[1240px]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={controls}
          onClick={toggle}
          data-cursor-hover
          className="inline-flex items-center gap-2 rounded-sm font-label text-label text-muted underline decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {label}
          <ChevronDown aria-hidden="true" size={16} strokeWidth={2.25} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}
