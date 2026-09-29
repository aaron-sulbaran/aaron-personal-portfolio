import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        border: "var(--color-border)",
        glass: "var(--color-glass)",
        "glass-strong": "var(--color-glass-strong)",
        "viz-lane-1": "var(--viz-lane-1)",
        "viz-lane-2": "var(--viz-lane-2)",
        "viz-lane-3": "var(--viz-lane-3)",
        "viz-warm": "var(--viz-warm)",
        "viz-cool": "var(--viz-cool)",
        "viz-node": "var(--viz-node)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        // Alias of display so /recruiting (still on font-serif) renders Profa
        // without touching its files. New code uses font-display.
        serif: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-sm": ["clamp(3rem, 8vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(2.5rem, 5vw, 4.25rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display": ["clamp(3.5rem, 10vw, 6rem)", { lineHeight: "1", letterSpacing: "-0.025em" }],
        // Case page title.
        "display-page": ["clamp(3rem, 8vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.025em" }],
        // Section openers (About).
        "display-xl": ["clamp(4rem, 10vw, 8rem)", { lineHeight: "0.95", letterSpacing: "-0.025em" }],
        // "Aaron" behind the coil: Profa Black sets the word at 2.816em, so
        // 24.86vw spans 70 percent of the pane (1008px at 1440). The scene
        // measures its own size; this is the DOM counterpart.
        "display-name": ["clamp(5.5rem, 24.86vw, 32rem)", { lineHeight: "0.8", letterSpacing: "0" }],
        "section": ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "body-lg": ["1.25rem", { lineHeight: "1.6" }],
      },
      screens: {
        xs: "400px",
      },
    },
  },
  plugins: [],
};
export default config;
