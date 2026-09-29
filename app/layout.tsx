import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { MenuPill } from "@/components/menu/MenuPill";
import { CustomCursor } from "@/components/CustomCursor";
import { siteContent } from "@/lib/content";
import { profaBlack } from "@/lib/fonts";
import { HOLDING_MODE } from "@/lib/holding";
import { THEME_BG_DARK, THEME_BG_LIGHT, themeInitScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteContent.meta.url),
  title: {
    default: siteContent.meta.title,
    template: `%s · ${siteContent.meta.title}`,
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${inter.variable} ${profaBlack.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {/* Holding mode has no sections to navigate; nav and menu stay out. */}
        {!HOLDING_MODE && <SiteNav />}
        {!HOLDING_MODE && <MenuPill />}
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
