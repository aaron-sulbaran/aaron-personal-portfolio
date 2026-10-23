import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { PathLayer } from "@/components/soundtrack/path/PathLayer";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { DealLabMount } from "@/components/home/DealLabMount";
import { HeroLabMount } from "@/components/home/HeroLabMount";
import { IntroLoader } from "@/components/home/loader/IntroLoader";
import { HomeController } from "@/components/home/HomeController";
import { Intro } from "@/components/home/Intro";
import { CardColumns } from "@/components/cards/CardColumns";
import { NumbersStrip } from "@/components/metrics/NumbersStrip";
import { MarkCardSource } from "@/components/mark/MarkCardSource";

// The contribution figures refresh once a day (lib/metrics/github.ts); a
// literal, because Next reads segment config statically.
export const revalidate = 86400;

// The whole site is one scrolling document of four pages: page 1 (#about, who I
// am: the name drawn in its own small canvas with the field inside its letters,
// the four blocks of the story staggered across the page, the soundtrack band's
// thin wave between them, the ribbon of cards and "Deal me in" at its foot),
// page 2 (#work, the cards: the Coil between two columns of titles), page 3
// (#numbers, proof of work), page 4 (#connect), then the Footer. The loader (the
// name that shrinks onto its place on page 1) sits at body level, outside the
// content layer, so its z 60 covers the header. The controller owns the cards
// section (the Coil between its two columns of titles, the scene, the modals);
// the scene's canvas is a sticky stage whose rail starts at page 1's foot, so
// the ribbon is drawn by the same canvas the Coil is; on the deal the stage
// sticks while the page scrolls on to page 2, and lets go there. Nothing pins
// but that stage, so the page scrolls natively; overflow-x is clipped (clip,
// not hidden, so no scroll container is created and the stage's sticking holds).
//
// The soundtrack band sits on page 1: its wave is the first stretch of the
// scroll-drawn line, which the cards section's shader hides and which comes
// back out of its bottom edge into the numbers strip, behind the sections in
// PathLayer's in-flow tiles. The band's playback pill self-Portals to
// document.body. Every overlay (SiteNav z-30, menu scrim
// z-[35], the Menu pill and panel z-40, the playback pill z-[45], modals
// z-50, the flight z-[55], the Express lane transition z-[57], the inline
// label z-[58]) sits at body level.
export default function Home() {
  // Holding mode (opt-in with NEXT_PUBLIC_SITE_MODE=holding, see
  // lib/holding.ts): the "under remodeling" page replaces the scroll journey.
  if (HOLDING_MODE) return <Holding />;

  return (
    <>
      <IntroLoader />
      <div className="relative z-10">
        <PathLayer />
        <main id="main" className="relative overflow-x-clip">
          <HeroSentinel />
          <Intro />
          <HomeController>
            <CardColumns />
          </HomeController>
          <NumbersStrip />
          <Connect />
        </main>
        <Footer />
      </div>
      <MarkCardSource />
      {process.env.NODE_ENV !== "production" && <DealLabMount />}
      {process.env.NODE_ENV !== "production" && <HeroLabMount />}
    </>
  );
}

// The header's hero sentinel: an invisible box over the first 90svh of #main
// (the top of page 1). SiteNav keeps the bar away while any of it is in view, so
// the bar slides in once the reader is past the first screen.
function HeroSentinel() {
  return (
    <div
      aria-hidden="true"
      data-hero-sentinel
      className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] supports-[height:100svh]:h-[90svh]"
    />
  );
}
