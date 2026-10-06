import type { Metadata } from "next";
import { AboutIntro } from "@/components/AboutIntro";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { UpToNow } from "@/components/UpToNow";
import { WhoIAm } from "@/components/WhoIAm";
import { SectionsLab } from "./SectionsLab";

export const metadata: Metadata = { title: "Sections lab", robots: { index: false, follow: false } };

// The sections lab: how About, Who I am, Up to now and Connect arrive as the
// reader scrolls. "Site today" renders the real Server Components (passed
// through as children); the grammar renders the lab's static copies of the
// same markup (AboutCopy and the rest), which carry the block markers.
export default function SectionsLabPage() {
  return (
    <SectionsLab
      today={[<AboutIntro key="about" />, <WhoIAm key="who" />, <UpToNow key="up" />, <Connect key="connect" />]}
      footer={<Footer dock />}
    />
  );
}
