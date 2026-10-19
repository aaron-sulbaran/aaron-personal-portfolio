import { WhoIAm } from "@/components/WhoIAm";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { PathLayer } from "@/components/soundtrack/path/PathLayer";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { HomeController } from "@/components/home/HomeController";
import { HeroText } from "@/components/home/HeroText";
import { Book } from "@/components/book/Book";
import { NumbersStrip } from "@/components/metrics/NumbersStrip";
import { MarkCardSource } from "@/components/mark/MarkCardSource";
import { ExpressInvite } from "@/components/invite/ExpressInvite";

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
// The soundtrack band sits in flow directly under the book: its wave is the
// first stretch of the scroll-drawn line, which continues behind the sections
// in PathLayer's in-flow tiles. The band's playback pill self-Portals to
// document.body. Every overlay (SiteNav z-30, the Express lane invite's toast
// z-[34], menu scrim z-[35], the Menu pill and panel z-40, the playback pill
// z-[45], modals z-50, the flight z-[55], the Express lane transition z-[57],
// the inline label z-[58], the loader z-60, its root absolute at the document
// top, its pane fixed) sits at body level. The invite's pill sits in the hero.
export default function Home() {
  // Holding mode (opt-in with NEXT_PUBLIC_SITE_MODE=holding, see
  // lib/holding.ts): the "under remodeling" page replaces the scroll journey.
  if (HOLDING_MODE) return <Holding />;

  return (
    <>
      <div className="relative z-10">
        <PathLayer />
        <main id="main" className="relative overflow-x-clip">
          <HeroSentinel />
          <HomeController hero={<HeroText />}>
            <Book />
            <ExpressInvite />
          </HomeController>
          <SoundtrackBand />
          <WhoIAm />
          <NumbersStrip />
          <Connect />
        </main>
        <Footer />
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
