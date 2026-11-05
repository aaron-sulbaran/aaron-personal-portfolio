// The social card's literal values. The holding card draws with satori, which
// cannot read CSS custom properties, so the dark palette's tokens from
// app/globals.css are mirrored here once. constants.test.ts pins each value to
// the stylesheet so a retuned token fails a test instead of drifting.
import { THEME_BG_DARK } from "@/lib/theme";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_COLORS = {
  background: THEME_BG_DARK,
  foreground: "#F5F2EC",
} as const;
