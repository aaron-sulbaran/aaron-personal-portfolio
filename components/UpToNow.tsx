import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "./Reveal";
import { UpToNowList } from "./UpToNowList";

// Stays a Server Component. The header reveals on enter; the list (entrance
// stagger + desktop parallax) is the <UpToNowList> client leaf.
export function UpToNow({ after }: { after?: ReactNode } = {}) {
  const { label, heading, items } = siteContent.upToNow;
  return (
    <section
      id="up-to-now"
      aria-label={label}
      className="relative w-full border-t border-border px-6 py-24 md:px-10 md:py-40 scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div
            data-wave-avoid
            className="reveal-item flex items-center gap-3 text-sm text-muted"
            style={revealIndex(0)}
          >
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <h2
            data-wave-avoid
            className="reveal-mask font-display text-section md:max-w-[12ch]"
            style={revealIndex(1)}
          >
            <span className="block">{heading}</span>
          </h2>
        </Reveal>

        <UpToNowList items={items} />
        {after && <div className="mt-28 md:mt-36">{after}</div>}
      </div>
    </section>
  );
}
