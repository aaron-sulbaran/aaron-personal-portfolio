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
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-sm": ["clamp(3rem, 8vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display": ["clamp(3.5rem, 10vw, 6rem)", { lineHeight: "1", letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(4rem, 12vw, 7.5rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "section": ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "body-lg": ["1.25rem", { lineHeight: "1.6" }],
      },
      letterSpacing: {
        caps: "0.14em",
      },
      screens: {
        xs: "400px",
      },
    },
  },
  plugins: [],
};
export default config;
