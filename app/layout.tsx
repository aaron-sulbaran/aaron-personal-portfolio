import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { SiteLogo } from "@/components/SiteLogo";
import { TopFade } from "@/components/TopFade";
import { MenuPill } from "@/components/menu/MenuPill";
import { CustomCursor } from "@/components/CustomCursor";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { QuestMount } from "@/components/quests/QuestMount";
import { InlineLayer } from "@/components/inline/InlineLayer";
import { InputModality } from "@/components/InputModality";
import { SoundtrackPlayer } from "@/components/player/SoundtrackPlayer";
import { TransitionLayer } from "@/components/transition/TransitionLayer";
import { siteContent } from "@/lib/content";
import { profaBlack, profaBold } from "@/lib/fonts";
import { HOLDING_MODE } from "@/lib/holding";
import { bandInitScript } from "@/lib/home/bandInit";
import { dealInitScript } from "@/lib/home/dealInit";
import { introLoaderInitScript } from "@/lib/home/introLoaderInit";
import { introWordsInitScript } from "@/lib/home/introWordsInit";
import { landingInitScript } from "@/lib/home/landingInit";
import { slotInitScript } from "@/lib/home/slotInit";
import { visitedInitScript } from "@/lib/inline/visited";
import { THEME_BG_DARK, THEME_BG_LIGHT, themeInitScript } from "@/lib/theme";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteContent.meta.url),
  title: {
    default: siteContent.meta.title,
    template: `%s | ${siteContent.meta.title}`,
  },
  description: siteContent.meta.description,
  openGraph: {
    title: siteContent.meta.title,
    description: siteContent.meta.description,
    url: siteContent.meta.url,
    siteName: siteContent.meta.title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteContent.meta.title,
    description: siteContent.meta.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_BG_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_BG_DARK },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${onest.variable} ${profaBlack.variable} ${profaBold.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: visitedInitScript }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: dealInitScript() }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: introLoaderInitScript() }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: introWordsInitScript() }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: slotInitScript() }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: bandInitScript() }} />}
        {!HOLDING_MODE && <script dangerouslySetInnerHTML={{ __html: landingInitScript() }} />}
      </head>
      <body className="font-sans">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {/* Holding mode has no sections to navigate; nav and menu stay out. */}
        {!HOLDING_MODE && <TopFade />}
        {!HOLDING_MODE && <SiteLogo />}
        {!HOLDING_MODE && <MenuPill />}
        {!HOLDING_MODE && <SoundtrackPlayer />}
        <InputModality />
        <CustomCursor />
        {!HOLDING_MODE && <InlineLayer />}
        {children}
        <SiteAnalytics />
        {!HOLDING_MODE && <QuestMount />}
        {!HOLDING_MODE && <TransitionLayer />}
      </body>
    </html>
  );
}
