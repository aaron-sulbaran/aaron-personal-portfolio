import localFont from "next/font/local";
import {
  Bricolage_Grotesque,
  DM_Mono,
  Familjen_Grotesk,
  Martian_Mono,
  Mona_Sans,
  Schibsted_Grotesk,
} from "next/font/google";

// Every candidate label face, lab only. Each lands on the lab root as a CSS
// variable that faces.ts names; nothing here reaches the shipped site.
//
// The Profa trial cuts stamp * ; and @, so the same unicode-range as
// lib/fonts.ts hands those three to the fallback face. Regular and Bold are
// gitignored: the lab needs them on disk.
const profa = localFont({
  src: [
    { path: "../../fonts/ProfaTrial-Regular.ttf", weight: "400" },
    { path: "../../fonts/ProfaTrial-Bold.ttf", weight: "700" },
    { path: "../../fonts/ProfaTrial-Black.ttf", weight: "900" },
  ],
  display: "swap",
  variable: "--lab-profa",
  declarations: [{ prop: "unicode-range", value: "U+0000-0029, U+002B-003A, U+003C-003F, U+0041-10FFFF" }],
});

const scaver = localFont({
  src: [
    { path: "../../fonts/Scaver-Regular.ttf", weight: "400" },
    { path: "../../fonts/Scaver-Bold.ttf", weight: "700" },
  ],
  display: "swap",
  variable: "--lab-scaver",
});

const groste = localFont({
  src: "../../fonts/GROSTE.otf",
  weight: "400",
  display: "swap",
  variable: "--lab-groste",
});

const dmMono = DM_Mono({ subsets: ["latin"], weight: ["300", "400", "500"], display: "swap", variable: "--lab-dm-mono" });
const martianMono = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--lab-martian-mono" });
const monaSans = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--lab-mona-sans" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], display: "swap", variable: "--lab-bricolage" });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], display: "swap", variable: "--lab-schibsted" });
const familjen = Familjen_Grotesk({ subsets: ["latin"], display: "swap", variable: "--lab-familjen" });

export const labFontVariables = [profa, scaver, groste, dmMono, martianMono, monaSans, bricolage, schibsted, familjen]
  .map((font) => font.variable)
  .join(" ");
