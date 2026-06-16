import { TileRing } from "@/components/TileRing";
import { HomeHero } from "@/components/HomeHero";
import { WorkSection } from "@/components/WorkSection";
import { AboutIntro } from "@/components/AboutIntro";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";

// The whole site is one scrolling document: Hero (ring) then Work, About,
// Connect, Footer. The hero keeps its own viewport-locked overflow-hidden
// section internally; #hero-pin is the handle the scroll layer pins in a later
// phase. main no longer locks height or overflow so the document can scroll;
// overflow-x is clipped to keep the entrance fan from spilling a horizontal
// scrollbar (clip, not hidden, so no scroll container is created).
export default function Home() {
  return (
    <>
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
    </>
  );
}
