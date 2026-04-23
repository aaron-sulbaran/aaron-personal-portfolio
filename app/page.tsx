import { Hero } from "@/components/Hero";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { WorkTeaser } from "@/components/WorkTeaser";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { BackgroundDrift } from "@/components/BackgroundDrift";

export default function Home() {
  return (
    <>
      <main id="main" className="relative">
        <Hero />
        {/* Ambient drift bridges the hero ring exit into the Work section. */}
        <div className="relative">
          <BackgroundDrift />
          <WhoIAm />
          <UpToNow />
        </div>
        <WorkTeaser />
        <Connect />
      </main>
      <Footer />
    </>
  );
}
