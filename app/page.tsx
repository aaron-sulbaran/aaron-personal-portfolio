import { WhoIAm } from "@/components/WhoIAm";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { HomeController } from "@/components/home/HomeController";
import { HeroText } from "@/components/home/HeroText";
import { Book } from "@/components/book/Book";
import { Metrics, METRICS_LABEL_ID, METRICS_TITLE_ID } from "@/components/metrics/Metrics";
import { SectionHeading, SectionSubline } from "@/components/sections/SectionTitle";
import { siteContent } from "@/lib/content";
import { MarkCardSource } from "@/components/mark/MarkCardSource";

// The contribution figures refresh once a day (lib/metrics/github.ts); a
// literal, because Next reads segment config statically.
export const revalidate = 86400;

// The whole site is one scrolling document: the Coil hero, the book (#work),
// the soundtrack band (#listen), Who I am (#about), the numbers strip, Connect,
// Footer. The controller owns the hero (the server-rendered greeting, the
// scene, the loader) and the book directly under it. Nothing pins, so the page
// scrolls natively; overflow-x is clipped (clip, not hidden, so no scroll
// container is created).
//
// The soundtrack band sits in flow directly under the book: the waveform runs
// through it and nowhere else, so nothing ever moves behind body text. Its
// playback pill self-Portals to document.body. Every overlay (SiteNav z-30,
// menu scrim z-[35], the Menu pill and panel z-40, the playback pill z-[45],
// modals z-50, the flight z-[55], the inline label z-[58], the loader z-60, its root absolute at the
// document top, its pane fixed) sits at body level.
export default function Home() {
  // Holding mode (the default; NEXT_PUBLIC_SITE_MODE=full opts out, see
  // lib/holding.ts): the "under remodeling" page replaces the scroll journey.
  if (HOLDING_MODE) return <Holding />;

  return (
    <>
      <div className="relative z-10">
        <main id="main" className="relative overflow-x-clip">
          <HeroSentinel />
          <HomeController hero={<HeroText />}>
            <Book />
          </HomeController>
          <SoundtrackBand />
          <WhoIAm />
          <NumbersStrip />
          <Connect />
        </main>
        <Footer dock />
      </div>
      <MarkCardSource />
    </>
  );
}

// The header's hero sentinel: an invisible box over the first 90svh of #main
// (the hero). SiteNav keeps the bar away while any of it is in view, so the
// bar slides in once the reader is past the hero.
function HeroSentinel() {
  return (
    <div
      aria-hidden="true"
      data-hero-sentinel
      className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] supports-[height:100svh]:h-[90svh]"
    />
  );
}

// The numbers strip under Who I am: the GitHub chart with its figures and my
// LinkedIn line (docs/content/right-now-and-metrics.md). It has its own big
// heading, set exactly as Who I am's is, and under it the line that names the
// GitHub group, set exactly as the line under Who I am's heading is.
function NumbersStrip() {
  const { title, groupLabel } = siteContent.metrics;
  return (
    <section id="numbers" className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-6">
          <SectionHeading id={METRICS_TITLE_ID}>{title}</SectionHeading>
          <SectionSubline id={METRICS_LABEL_ID}>{groupLabel}</SectionSubline>
        </div>
        <Metrics />
      </div>
    </section>
  );
}
