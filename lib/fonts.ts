import localFont from "next/font/local";

// Profa Black, the display face site-wide. A single upright 900 cut, Aaron's
// own licensed file, the one allowlisted entry in app/fonts/. The variable
// lands on <html> (app/layout.tsx) so Tailwind's font-display (and the serif
// alias the recruiting dashboard still uses) resolve to it everywhere.
export const profaBlack = localFont({
  src: "../app/fonts/ProfaTrial-Black.ttf",
  weight: "900",
  display: "swap",
  variable: "--font-display",
});
