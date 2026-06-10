import type { Metadata } from "next";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { siteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: siteContent.about.metaDescription,
};

export default function AboutPage() {
  const { label, heading, lede } = siteContent.about;

  return (
    <>
      <main id="main" className="relative min-h-screen">
        <section className="relative w-full px-6 pb-16 pt-32 md:px-10 md:pb-24 md:pt-40">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-10">
            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
              <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <h1 className="font-serif text-[clamp(4rem,10vw,8rem)] italic leading-[0.95] tracking-tight text-foreground">
              {heading}
            </h1>
            <p className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">
              {lede}
            </p>
          </div>
        </section>

        <WhoIAm />
        <UpToNow />
        <Connect />
      </main>
      <Footer />
    </>
  );
}
