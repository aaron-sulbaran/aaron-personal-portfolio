import { siteContent } from "@/lib/content";
import { Kicker, StickyCol } from "./Kicker";
import type { KickerFace } from "./settings";

// A static copy of components/WhoIAm.tsx. The paragraph is plain here (no
// ReadAlong): the lab's words grammar is the read-along. The label's column
// stretches to the paragraph's height, so a sticky label holds until the
// paragraph ends (or earlier, by the stop offset).
export function WhoCopy({ face, sticky }: { face: KickerFace; sticky: boolean }) {
  const { label, paragraph } = siteContent.whoIAm;
  return (
    <section
      id="who-i-am"
      aria-label={label}
      data-sl-section="who"
      className="relative w-full scroll-mt-24 px-6 py-24 md:px-10 md:py-40"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12 md:gap-16">
        <StickyCol on={sticky} className="sl-col md:col-span-4">
          <Kicker label={label} face={face} />
        </StickyCol>
        <div data-wave-avoid className="md:col-span-8">
          <p
            data-sl-block="body"
            className="text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]"
          >
            {paragraph}
          </p>
        </div>
      </div>
    </section>
  );
}
