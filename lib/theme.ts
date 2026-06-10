export const THEME_STORAGE_KEY = "aaron-theme";

export type Theme = "light" | "dark";

export const THEME_BG_LIGHT = "#FAFAF7";
export const THEME_BG_DARK = "#0E1419";

export function syncThemeColorMeta(theme: Theme): void {
  if (typeof document === "undefined") return;
  const color = theme === "dark" ? THEME_BG_DARK : THEME_BG_LIGHT;
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
    (el as HTMLMetaElement).content = color;
  });
}

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
