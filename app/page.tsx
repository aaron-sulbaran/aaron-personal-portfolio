import { ListenInvite } from "@/components/ListenInvite";
import { AboutIntro } from "@/components/AboutIntro";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { Waveform } from "@/components/Waveform";
import { PlaybackPill } from "@/components/PlaybackPill";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { HomeController } from "@/components/home/HomeController";
import { HeroText } from "@/components/home/HeroText";
import { Book } from "@/components/book/Book";

// The whole site is one scrolling document: the Coil hero, the book (#work),
// the Listen invite (#listen), About, Connect, Footer. The controller owns the
// hero (the server-rendered greeting, the scene, the loader) and the book
// directly under it. Nothing pins, so the page scrolls natively; overflow-x is
// clipped (clip, not hidden, so no scroll container is created).
//
// Waveform and PlaybackPill self-Portal to document.body and stay invisible
// through the hero and the book, ramping in once #listen has passed. The
// content wrapper carries relative z-10 so it sits above the z-0 waveform,
// which then shows faintly through the sections' transparent backgrounds.
// Every fixed overlay (SiteNav z-30, menu scrim z-[35], the Menu pill and
// panel z-40, PlaybackPill z-[45], modals z-50, the flight z-[55], the loader
// z-60) sits at body level above it.
export default function Home() {
  // Holding mode (the default; NEXT_PUBLIC_SITE_MODE=full opts out, see
  // lib/holding.ts): the "under remodeling" page replaces the scroll journey.
  if (HOLDING_MODE) return <Holding />;

  return (
    <>
      <Waveform />
      <PlaybackPill />
      <div className="relative z-10">
        <main id="main" className="relative overflow-x-clip">
          <HeroSentinel />
          <HomeController hero={<HeroText />}>
            <Book />
          </HomeController>
          <ListenInvite />
          <AboutIntro />
          <WhoIAm />
          <UpToNow />
          <Connect />
        </main>
        <Footer />
      </div>
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
