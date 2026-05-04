import { TileRing } from "@/components/TileRing";
import { HomeHero } from "@/components/HomeHero";

export default function Home() {
  return (
    <main id="main" className="relative min-h-screen overflow-hidden">
      <TileRing>
        <HomeHero />
      </TileRing>
    </main>
  );
}
