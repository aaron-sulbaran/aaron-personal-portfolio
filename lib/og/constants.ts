// The social card's literal values. An image route draws with satori, which
// cannot read CSS custom properties, so the dark palette's tokens from
// app/globals.css are mirrored here once. constants.test.ts pins each value to
// the stylesheet so a retuned token fails a test instead of drifting.
import { THEME_BG_DARK } from "@/lib/theme";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_COLORS = {
  background: THEME_BG_DARK,
  foreground: "#F5F2EC",
  accent: "#7FA8C9",
  // The background at zero alpha, the scrim's far end (a gradient to "transparent" would grey).
  backgroundClear: "rgba(14, 20, 25, 0)",
} as const;

export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}
