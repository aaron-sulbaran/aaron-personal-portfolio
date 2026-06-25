import { siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "./Reveal";
import { ReadAlong } from "./ReadAlong";

// Stays a Server Component. The label reveals on enter; the paragraph is handed
// to <ReadAlong> (a client leaf) for the desktop scroll read-along.
export function WhoIAm() {
  const { label, paragraph } = siteContent.whoIAm;
  return (
    <section
      id="who-i-am"
      aria-label={label}
      className="relative w-full px-6 py-24 md:px-10 md:py-40 scroll-mt-24"
    >
      <Reveal className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-4">
          <div
            className="reveal-item flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted"
            style={revealIndex(0)}
          >
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
        </div>
        <div className="md:col-span-8">
          <ReadAlong
            text={paragraph}
            className="text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]"
          />
        </div>
      </Reveal>
    </section>
  );
}
