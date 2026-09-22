import localFont from "next/font/local";

// Profa Black, the display face settled in the September design-exploration
// rounds. Single upright cut (no italic), Aaron's own licensed file, the one
// allowlisted entry in app/fonts/. Loaded once here and shared by the holding
// page headline and the recruiting dashboard headline.
export const profaBlack = localFont({
  src: "../app/fonts/ProfaTrial-Black.ttf",
  weight: "900",
  display: "swap",
});
