import { TileRing } from "@/components/TileRing";
import { HomeHero } from "@/components/HomeHero";
import { ListenInvite } from "@/components/ListenInvite";
import { WorkSection } from "@/components/WorkSection";
import { AboutIntro } from "@/components/AboutIntro";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { Waveform } from "@/components/Waveform";
import { PlaybackPill } from "@/components/PlaybackPill";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Holding } from "@/components/Holding";
import { HOLDING_MODE } from "@/lib/holding";
import { COIL_HOME } from "@/lib/flags";
import { HomeController } from "@/components/home/HomeController";
import { HeroText } from "@/components/home/HeroText";
import { Book } from "@/components/book/Book";

// The whole site is one scrolling document: Hero (ring) then Work, About,
// Connect, Footer. The hero keeps its own viewport-locked overflow-hidden
// section internally; #hero-pin is the handle the scroll layer pins in a later
// phase. main no longer locks height or overflow so the document can scroll;
// overflow-x is clipped to keep the entrance fan from spilling a horizontal
// scrollbar (clip, not hidden, so no scroll container is created).
//
// Waveform, PlaybackPill, and ScrollProgress are the back-half scroll journey:
// Waveform and PlaybackPill self-Portal to document.body (so the pinned
// #hero-pin transform never captures their fixed positioning) and stay
// invisible through the hero, ramping in as #work approaches. The content
// wrapper carries relative z-10 so it sits above the z-0 waveform, which then
// shows faintly through the sections' transparent backgrounds.
//
// Post-pin the carousel cards overflow the hero section (spec:
// docs/carousel-visible-engagement-spec.md), so #hero-pin carries z-20 to
// paint them over the later sections; every fixed overlay (SiteNav z-30,
// ScrollProgress z-[31], Menu z-40/50, modals z-50, FlyingTile z-[55])
// portals to body and stays above.
export default function Home() {
  // Holding mode (the default; NEXT_PUBLIC_SITE_MODE=full opts out, see
  // lib/holding.ts): the "under remodeling" page replaces the scroll journey.
  if (HOLDING_MODE) return <Holding />;
  // The Coil home (NEXT_PUBLIC_HOME_HERO=coil, see lib/flags.ts); the ring
  // below stays the default until the flip in slice 9.
  if (COIL_HOME) return <CoilHome />;

  return (
    <>
      <Waveform />
      <PlaybackPill />
      <ScrollProgress />
      <div className="relative z-10">
        <main id="main" className="relative overflow-x-clip">
          <HeroSentinel />
          <div id="hero-pin" className="relative z-20">
            <TileRing>
              <HomeHero />
            </TileRing>
          </div>
          <ListenInvite />
          <WorkSection />
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

// The Coil home: the controller owns the hero (the server-rendered greeting,
// and the scene from slice 3) and the book directly under it at #work, then
// the surviving sections. No #hero-pin: nothing pins. The waveform, playback
// pill and progress rail keep their ring-era triggers until slices 5 and 6.
function CoilHome() {
  return (
    <>
      <Waveform />
      <PlaybackPill />
      <ScrollProgress />
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
// bar slides in once the reader is past the hero, on either home.
function HeroSentinel() {
  return (
    <div
      aria-hidden="true"
      data-hero-sentinel
      className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] supports-[height:100svh]:h-[90svh]"
    />
  );
}
