"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { useShown } from "../context";
import { BackLabel, RoleLineText } from "../pairs";
import { role } from "../Specimen";

// The path a recruiter takes in seconds: the work modal's title block, then
// "See more" cuts to the case page's header in the same spot (a 180ms
// crossfade, no flight). Both role lines follow the current settings, so
// above then below can be felt against below then below. The back link
// returns to the modal.
const item = siteContent.workItems[0];

const workTintStyle = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

function Layer({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div inert={!shown} className={`col-start-1 row-start-1 transition-opacity duration-[180ms] ${shown ? "opacity-100" : "opacity-0"}`}>
      {children}
    </div>
  );
}

export function Sequence() {
  const [onCase, setOnCase] = useState(false);
  const { roleLineModal, roleLineCase } = useShown();
  const text = `${item.role}, ${item.year}`;
  const cta = role("controls", 18, true);
  return (
    <div className="grid">
      <Layer shown={!onCase}>
        <div className="relative flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border p-6 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] md:p-10">
          <div className="flex items-center gap-5 pr-12">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              <span aria-hidden="true" className="absolute inset-0" style={workTintStyle} />
              <div className="absolute inset-0 flex items-center justify-center p-2.5">
                <Image src={item.logo} alt={`${item.title} logo`} width={120} height={120} className="h-auto w-[86%] object-contain opacity-90" />
              </div>
            </div>
            <div className="flex flex-col" style={{ gap: roleLineModal.gap }}>
              {roleLineModal.placement === "above" && <RoleLineText line={roleLineModal} text={text} />}
              <p className="font-display text-3xl leading-tight text-foreground md:text-4xl">{item.title}</p>
              {roleLineModal.placement === "below" && <RoleLineText line={roleLineModal} text={text} />}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnCase(true)}
            className="group inline-flex w-fit items-center gap-2 text-lg font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
            {...cta}
            style={{ ...cta.style, gap: "var(--lab-icon-gap, 8px)" }}
          >
            {siteContent.work.cta}
            <ArrowRight aria-hidden="true" className="lab-icon lab-arrow h-4 w-4" />
          </button>
        </div>
      </Layer>
      <Layer shown={onCase}>
        <div onClickCapture={(event) => {
          if ((event.target as Element).closest("a[href='#case']")) {
            event.preventDefault();
            setOnCase(false);
          }
        }}>
          <BackLabel />
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-glass shadow-[0_10px_24px_-14px_rgba(10,10,10,0.4)] md:h-24 md:w-24">
              <Image src={item.logo} alt="" fill sizes="96px" className="object-contain p-3" />
            </div>
            <div className="flex flex-col" style={{ gap: roleLineCase.gap }}>
              {roleLineCase.placement === "above" && <RoleLineText line={roleLineCase} text={text} />}
              <p className="font-display text-display-page text-foreground">{item.title}</p>
              {roleLineCase.placement === "below" && <RoleLineText line={roleLineCase} text={text} />}
            </div>
          </div>
        </div>
      </Layer>
    </div>
  );
}
