import { blendOver, contrastRatio, hexToRgb, type Rgb } from "@/lib/waveform/contrast";
import type { ThemeAlphas, ThemeName } from "./settings";

// The live readability readout: muted body text over the most inked dot pixel
// (a dot's centre, its fill at full alpha over the background), for both
// themes at once. The token hexes come from the page's own stylesheet rules
// (:root and [data-theme="dark"] in app/globals.css), read once, so the
// readout follows the palette rather than a copy of it.

export interface ThemeTokens {
  background: Rgb;
  foreground: Rgb;
  muted: Rgb;
  accent: Rgb;
}

const NAMES = ["--color-background", "--color-foreground", "--color-muted", "--color-accent"] as const;

function walk(rules: CSSRuleList, found: Partial<Record<ThemeName, Record<string, string>>>) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) {
      const theme = rule.selectorText === ":root" ? "light" : rule.selectorText === '[data-theme="dark"]' ? "dark" : null;
      if (!theme) continue;
      for (const name of NAMES) {
        const value = rule.style.getPropertyValue(name).trim();
        if (value.startsWith("#")) (found[theme] ??= {})[name] = value;
      }
    } else if ("cssRules" in rule) {
      walk((rule as CSSGroupingRule).cssRules, found);
    }
  }
}

export function readTokens(): Record<ThemeName, ThemeTokens> | null {
  const found: Partial<Record<ThemeName, Record<string, string>>> = {};
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules, found);
    } catch {
      // A cross-origin sheet (a web font) cannot be read; the tokens are not in it.
    }
  }
  const pick = (theme: ThemeName): ThemeTokens | null => {
    const t = found[theme];
    if (!t || NAMES.some((n) => !t[n])) return null;
    return {
      background: hexToRgb(t["--color-background"]),
      foreground: hexToRgb(t["--color-foreground"]),
      muted: hexToRgb(t["--color-muted"]),
      accent: hexToRgb(t["--color-accent"]),
    };
  };
  const light = pick("light");
  const dark = pick("dark");
  return light && dark ? { light, dark } : null;
}

export interface Contrast {
  bare: number; // the text over the plain background, the ceiling
  overMuted: number;
  overAccent: number;
  worst: number;
}

// `text` picks the token: "muted" is the gate the spec used (About's lede,
// labels, Connect's lede); "foreground" is the Who I am paragraph once read.
export function textContrast(tokens: ThemeTokens, alphas: ThemeAlphas, text: "muted" | "foreground"): Contrast {
  const ink = tokens[text];
  const bare = contrastRatio(ink, tokens.background);
  const overMuted = contrastRatio(ink, blendOver(tokens.background, tokens.muted, alphas.muted));
  const overAccent = contrastRatio(ink, blendOver(tokens.background, tokens.accent, alphas.accent));
  return { bare, overMuted, overAccent, worst: Math.min(overMuted, overAccent) };
}
