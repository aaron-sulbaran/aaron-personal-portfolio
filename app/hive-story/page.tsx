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
  alternates: { canonical: "/hive-story" },
  openGraph: { title: hiveStoryCopy.title, description: hiveStoryCopy.description, url: "/hive-story" },
};

export default function HiveStoryPage() {
  if (HOLDING_MODE) redirect("/");
  return (
    <main id="main" data-page="hive-story" className={`${doto.variable} hive-story`}>
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
