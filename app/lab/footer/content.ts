import type { HoldingSocial } from "@/lib/content";

// Every string the footer stage shows, in one place (lab only; the approved
// copy is docs/content/connect-footer-band.md, "Connect" and "Footer", with
// Aaron's round 2 edits to the heading and the call to action).
export const FOOTER_COPY = {
  wordmark: "build.stuff",
  dropPeriod: "Drop the period",
  tagline: (month: string) => `Last updated ${month}`,
  copyright: "© 2026 Aaron Sulbaran",
  bookLabel: "Book some time",
  bookHref: "https://cal.com/aaron-sulbaran",
  heading: "wanna chat?",
  links: [
    { key: "linkedin", label: "LinkedIn", handle: "in/aaron-sulbaran", href: "https://www.linkedin.com/in/aaron-sulbaran/", icon: "linkedin" },
    { key: "github", label: "GitHub", handle: "aaron-sulbaran", href: "https://github.com/aaron-sulbaran", icon: "github" },
    { key: "email", label: "Email", handle: "aarondsulbaran@gmail.com", href: "mailto:aarondsulbaran@gmail.com", icon: "mail" },
    { key: "instagram", label: "Instagram", handle: "aaron.sulbaran", href: "https://www.instagram.com/aaron.sulbaran/", icon: "instagram" },
    { key: "x", label: "X", handle: "@imaaronsulbaran", href: "https://x.com/imaaronsulbaran", icon: "x" },
  ] as const satisfies readonly { key: string; label: string; handle: string; href: string; icon: HoldingSocial["icon"] }[],
} as const;
