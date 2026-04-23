import { Hero } from "@/components/Hero";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main id="main" className="relative">
        <Hero />
        <WhoIAm />
        <UpToNow />
        <Connect />
      </main>
      <Footer />
    </>
  );
}
