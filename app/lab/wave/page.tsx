import type { Metadata } from "next";
import { AboutIntro } from "@/components/AboutIntro";
import { WhoIAm } from "@/components/WhoIAm";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { BandStandIn } from "./BandStandIn";
import { WaveLab } from "./WaveLab";

export const metadata: Metadata = { title: "Wave lab", robots: { index: false, follow: false } };

// The wave lab: the real page from the soundtrack band down (a static band,
// then the real About, Who I am, Up to now, Connect and footer, rendered here
// as Server Components) over a lab wave layer. WaveLab is the client shell
// that owns the settings, the canvases and the panel; the sections pass
// through it as rendered children.
export default function WaveLabPage() {
  return (
    <WaveLab
      band={<BandStandIn />}
      sections={[<AboutIntro key="about" />, <WhoIAm key="who" />, <UpToNow key="up" />, <Connect key="connect" />]}
      footer={<Footer dock />}
    />
  );
}
