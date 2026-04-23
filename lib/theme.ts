export const THEME_STORAGE_KEY = "aaron-theme";

export type Theme = "light" | "dark";

// Mirrored from globals.css :root background tokens. The PWA theme-color meta
// cannot read CSS variables, so these constants are the single source of truth
// for that meta tag and must stay in sync with globals.css.
export const THEME_BG_LIGHT = "#FAFAF7";
export const THEME_BG_DARK = "#0E1419";

export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark' ? stored : (systemDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;
