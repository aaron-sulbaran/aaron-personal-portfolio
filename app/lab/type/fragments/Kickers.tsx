import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/AboutIntro.tsx and WhoIAm.tsx: the rule plus "About" over the
// section opener, and Who I am's label beside its paragraph (body, Inter).
// Reveal and the read-along are left out; this is their settled state. The
// site's md:gap-16 becomes xl:gap-16 here: eleven 64px gaps overflow the
// bench beside the panel below xl.
export function Kickers() {
  const { label, heading, lede } = siteContent.about;
  const who = siteContent.whoIAm;
  return (
    <div className="flex flex-col gap-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-10">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
          <span {...role("kickers", 14)}>{label}</span>
        </div>
        <h2 className="font-display text-display-xl text-foreground">
          <span className="block">{heading}</span>
        </h2>
        <p className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">{lede}</p>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-12 md:gap-8 xl:gap-16">
        <div className="md:col-span-4">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span {...role("kickers", 14)}>{who.label}</span>
          </div>
        </div>
        <div className="md:col-span-8">
          <p className="text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]">{who.paragraph}</p>
        </div>
      </div>
    </div>
  );
}
