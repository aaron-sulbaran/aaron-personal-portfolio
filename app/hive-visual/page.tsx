import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { doto } from "@/components/hive-story/font";
import { CallsSection, MoreSection, NumbersSection, ScenariosSection } from "@/components/hive-story/StoryBottom";
import { StatusSection, StepsSection, StoryHero, TeamSection, WhySection } from "@/components/hive-story/StoryTop";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { HOLDING_MODE } from "@/lib/holding";

// FH08 Hive's public story (docs/superpowers/specs/2026-11-10-hive-story-design.md): one page, mobile first, that a
// stranger gets in a minute. Link only for now: not in the Menu or the sitemap,
// and noindex until Aaron says otherwise. The gated team page is its own zone at
// /hive; nothing here reads team data.
export const metadata: Metadata = {
  title: hiveStoryCopy.title,
  description: hiveStoryCopy.description,
  robots: { index: false, follow: true },
  alternates: { canonical: "/hive-visual" },
  openGraph: { title: hiveStoryCopy.title, description: hiveStoryCopy.description, url: "/hive-visual" },
};

// Aaron asked for the AS logo white on honey (about 1.7:1). true rims it, and
// the Menu pill, in bee ink so it reads at 3:1 or better; his call.
const LOGO_EDGE = false;

export default function HiveStoryPage() {
  if (HOLDING_MODE) redirect("/");
  return (
    <main id="main" data-page="hive-visual" data-logo-edge={LOGO_EDGE || undefined} className={`${doto.variable} hive-story`}>
      <StoryHero />
      <StepsSection />
      <WhySection />
      <TeamSection />
      <StatusSection />
      <ScenariosSection />
      <CallsSection />
      <NumbersSection />
      <MoreSection />
    </main>
  );
}
