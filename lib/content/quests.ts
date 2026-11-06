import type { QuestCategory, QuestGroup } from "@/lib/quests/types";

// The quest line at the foot of the home (components/quests/): the button in
// the footer and the splits it opens. Draft copy for Aaron to edit.

export const questCopy = {
  button: {
    label: "Did you find everything?",
    // Joins the label once QUEST.countFrom things are found.
    count: (found: number, total: number) => `${found} of ${total}`,
    open: "See how much of my site you found",
  },
  panel: {
    title: "Your run",
    close: "Close",
    clock: "Time",
    categories: {
      any: { label: "Any%", blurb: "A real look around: a few cards, a few pop-ups, one easter egg." },
      full: { label: "100%", blurb: "Everything: every card, every pop-up on page 1, both easter eggs, and the MVP." },
    } satisfies Record<QuestCategory, { label: string; blurb: string }>,
    groups: {
      cards: { label: "Cards", hint: "Open them from page 2" },
      pops: { label: "Pop-ups", hint: "The underlined words on page 1" },
      eggs: { label: "Easter eggs", hint: "Two things here do more than they let on" },
      mvp: { label: "The MVP", hint: "The short version of this site" },
    } satisfies Record<QuestGroup, { label: string; hint: string }>,
    left: (n: number) => `${n} left`,
    done: "Done",
    privacy: "Your progress stays in your browser. Nothing is sent anywhere.",
  },
  finish: {
    any: "That's Any%. 100% is still out there.",
    full: "Thank you for looking through my entire site. I spent a lot of time on it.",
    saved: "Your run is saved on this device.",
  },
} as const;
