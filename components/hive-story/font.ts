import { Doto } from "next/font/google";

// Doto draws letters in round dots, the same bees the Hive is drawn in. Used on
// /hive-visual only, for the title, the clock and the numbers; ROND 100 turns
// its square pixels round (set where it's used, via font-variation-settings).
export const doto = Doto({
  subsets: ["latin"],
  weight: "variable",
  axes: ["ROND"],
  display: "swap",
  variable: "--font-dot",
});
