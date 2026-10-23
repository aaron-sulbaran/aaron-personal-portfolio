import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { PathLayer } from "@/components/soundtrack/path/PathLayer";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { DealLabMount } from "@/components/home/DealLabMount";
import { HeroLabMount } from "@/components/home/HeroLabMount";
import { IntroLoader } from "@/components/home/loader/IntroLoader";
import { HomeController } from "@/components/home/HomeController";
import { FirstScreen } from "@/components/home/FirstScreen";
import { AboutSection } from "@/components/home/AboutSection";
import { CardColumns } from "@/components/cards/CardColumns";
import { NumbersStrip } from "@/components/metrics/NumbersStrip";
import { MarkCardSource } from "@/components/mark/MarkCardSource";

// The contribution figures refresh once a day (lib/metrics/github.ts); a
// literal, because Next reads segment config statically.
export const revalidate = 86400;

// The whole site is one scrolling document: the first screen (the name drawn by
// the Coil scene on its field, blocks 1 and 2 of the story, the soundtrack
// band's thin wave, the ribbon of cards and "Deal me in"), the cards section
// (#work), "More about me" (#about: blocks 3 and 4), the numbers strip,
// Connect, Footer. The loader (the name that shrinks onto its place on the first
// screen) sits at body level, outside the content layer, so its z 60 covers the
// header. The controller owns the cards section (the Coil between its two
// columns of titles, the scene, the modals); the scene's canvas is a sticky
// stage that starts at the page's first pixel and covers the first screen, so
// the ribbon and the name are drawn by the same canvas the Coil is. Nothing
// pins but that stage, so the page scrolls natively; overflow-x is clipped (clip,
// not hidden, so no scroll container is created and the stage's sticking holds).
//
// The soundtrack band sits on the first screen: its wave is the first stretch
// of the scroll-drawn line, which the cards section's shader hides and which
// comes back out of its bottom edge past "More about me" into the numbers strip,
// behind the sections in PathLayer's in-flow tiles. The band's playback pill
// self-Portals to document.body. Every overlay (SiteNav z-30, menu scrim
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
          <FirstScreen />
          <HomeController>
            <CardColumns />
          </HomeController>
          <AboutSection />
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
// (the first screen). SiteNav keeps the bar away while any of it is in view, so the
// bar slides in once the reader is past the first screen.
function HeroSentinel() {
  return (
    <div
      aria-hidden="true"
      data-hero-sentinel
      className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] supports-[height:100svh]:h-[90svh]"
    />
  );
}
