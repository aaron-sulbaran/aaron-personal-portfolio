import { TileRing } from "@/components/TileRing";
import { HomeHero } from "@/components/HomeHero";
import { WorkSection } from "@/components/WorkSection";
import { AboutIntro } from "@/components/AboutIntro";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { Waveform } from "@/components/Waveform";
import { PlaybackPill } from "@/components/PlaybackPill";
import { ScrollProgress } from "@/components/ScrollProgress";

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
export default function Home() {
  return (
    <>
      <Waveform />
      <PlaybackPill />
      <ScrollProgress />
      <div className="relative z-10">
        <main id="main" className="relative overflow-x-clip">
          <div id="hero-pin" className="relative">
            <TileRing>
              <HomeHero />
            </TileRing>
          </div>
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
