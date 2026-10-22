// The home's first screen: the heading and a short version of the About copy,
// each sentence cut word for word from siteContent.whoIAm (nothing new is
// written). Sentences carry the inline link markup (lib/content/links.ts).
// The fork at the foot: the button that scrolls to the cards, the quiet line
// beside it, and the link to the 30-second version.
export const intro = {
  ariaLabel: "About me",
  sentences: [
    "I'm a [product](def:product)-focused engineer.",
    "I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for.",
    "I tend to gravitate towards [leadership positions](pop:leadership-award) because I love getting a group of people with very different skillsets working towards one goal.",
    "I love people ([family](pop:family) & [friends](pop:friends)) outside of work too.",
  ],
  fork: {
    deckLabel: "My cards, face down",
    deal: "Deal me in",
    // The button once the cards are dealt: it leads back to them, no replay.
    back: "Back to my cards",
    scroll: "or just scroll",
    quick: "In a rush? The 30-second version",
  },
} as const;
