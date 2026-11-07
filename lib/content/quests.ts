import type { QuestCategory, QuestGroup } from "@/lib/quests/types";

// The quest line at the foot of the home (components/quests/): the button in
// the footer and the splits it opens. Draft copy for Aaron to edit.

export const questCopy = {
  button: {
    label: "Did you find everything?",
    // Joins the label once QUEST.countFrom things are found.
    count: (found: number, total: number) => `${found} of ${total}`,
    // A phone shows the count under the pill instead of inside it.
    countBelow: (found: number, total: number) => `${found} of ${total} found`,
    open: "See how much of my site you found",
  },
  panel: {
    title: "Your run",
    close: "Close",
    clock: "Time",
    categories: {
      any: { label: "Any%", blurb: "A real look around: a few cards, a few pop-ups, one easter egg." },
      full: { label: "100%", blurb: "Everything: every card, every pop-up on page 1 and in the cards, both easter eggs, and the MVP." },
    } satisfies Record<QuestCategory, { label: string; blurb: string }>,
    // An open row's line is a way there: a tap closes the run and takes the
    // visitor to the place (touch is the line a touch screen reads).
    groups: {
      cards: { label: "Cards", go: "Open them from page 2" },
      pops: { label: "Pop-ups", cardsNote: "Some of the cards have them too", go: "Hover over the underlined words on page 1", touch: "Tap the underlined words on page 1" },
      eggs: { label: "Easter eggs" },
      mvp: { label: "The MVP", go: "See the short version of my site" },
    } satisfies Record<QuestGroup, { label: string; go?: string; touch?: string; cardsNote?: string }>,
    // The easter eggs stay a secret until asked twice: the row opens on a
    // teaser, then a button gives the eggs away.
    eggs: {
      teaser: (total: number) => `There are ${total} things to look out for here`,
      reveal: "Reveal the easter eggs",
      clues: {
        "egg:logo": { text: "Hold the logo in the top left until it fills" },
        "egg:period": { text: "Click the period at the end of build.stuff", touch: "Tap the period at the end of build.stuff" },
      } satisfies Record<string, { text: string; touch?: string }>,
      found: "Found",
    },
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
