"use client";

import { useEffect } from "react";
import { Onest } from "next/font/google";
import { ErrorPanel } from "@/components/ErrorPanel";
import { ensureAnalytics, reportClientError } from "@/components/SiteAnalytics";
import { profaBlack, profaBold } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// The last resort: this replaces the root layout, so it carries its own html
// and body, the stylesheet, the same three font variables and the theme
// script, and nothing else (no chrome, no scene).
const onest = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
    ensureAnalytics();
    reportClientError("global-error", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning className={`${onest.variable} ${profaBlack.variable} ${profaBold.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <ErrorPanel reset={reset} />
      </body>
    </html>
  );
}
