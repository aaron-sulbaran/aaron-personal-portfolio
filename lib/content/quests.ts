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
    // These two lines are for readers who don't know speedrunning: they
    // explain the terms rather than repeat the rows.
    intro: "This is a speedrun of my site. The timer is how long you've been here, and the list shows what you still need to find. Get to it!",
    categories: {
      any: { label: "Any%", meaning: "Any% gets you a decent understanding of who I am." },
      full: { label: "100%", meaning: "So you're a completionist? 100% is finding every last thing I built." },
    } satisfies Record<QuestCategory, { label: string; meaning: string }>,
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
