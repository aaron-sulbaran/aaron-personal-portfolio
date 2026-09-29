import localFont from "next/font/local";

// Profa Black, the display face site-wide. A single upright 900 cut, Aaron's
// own licensed file, the one allowlisted entry in app/fonts/. The variable
// lands on <html> (app/layout.tsx) so Tailwind's font-display (and the serif
// alias the recruiting dashboard still uses) resolve to it everywhere.
//
// The trial cut draws a "personal use only" stamp for * ; and @, so the
// unicode-range leaves those three to the fallback face (an email address in
// Connect would otherwise carry the stamp). Drop it with the full license.
export const profaBlack = localFont({
  src: "../app/fonts/ProfaTrial-Black.ttf",
  weight: "900",
  display: "swap",
  variable: "--font-display",
  declarations: [
    { prop: "unicode-range", value: "U+0000-0029, U+002B-003A, U+003C-003F, U+0041-10FFFF" },
  ],
});
