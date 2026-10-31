// The home's first page, "who I am" (hero rework, slice 3): the heading is the
// hero's (siteContent.hero), then two paragraphs of three sentences carrying the
// inline link markup (lib/content/links.ts) so the defs, tips and pops come with
// it. These are Aaron's own words for page 1, set down verbatim (2026-10-31); they
// are no longer cut from siteContent.whoIAm, which About keeps as it was.
// lib/content/intro.test.ts pins each sentence and the set of pops on the page.
// The paragraphs are data: dropping a tip to plain words on this page is an edit
// to these strings.
// Page 1 tells two paragraphs, whole, in this order: who I am and how I work
// beside the name, then, after the wave, the people I love and the hobbies. The
// photo pop that sat on "leadership positions" now sits on "leading", and the
// Venezuela flag is off the page until Aaron places it; its media entry stays in
// the register. "wanderlust" has no pop yet (Aaron is choosing a photo). The
// teaser at its foot is the button that deals and the way to the MVP.
export const intro = {
  ariaLabel: "About me",
  blocks: [
    {
      key: "who",
      sentences: [
        "I'm a [product](def:product)-focused engineer.",
        "I study Electrical and Computer Engineering (ECE) at UT Austin, but beyond class I'm passionate about building products people actually want to use.",
        "I love [leading](pop:leadership-award) people with very different skillsets to achieve ambitious goals.",
      ],
    },
    {
      key: "outside",
      sentences: [
        "I also love people (you'll often see me with [family](pop:family) & [friends](pop:friends)) outside of work too.",
        "My biggest hobby is credit card-maxxing since it allows me to fulfill my wanderlust.",
        "I've also gotten into [3D printing](pop:3d-printing) because it lets me work on the engineering I don't get to do in class and have always been a fan of [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
      ],
    },
  ],
  teaser: {
    line: "Want to see what I've been up to?",
    deal: "Deal me in",
    // The button once the cards are dealt: it leads back to them, no replay.
    back: "Back to my cards",
    // Page 1's line under Deal me in. Its last word is the MVP's short name, which unfurls on a fine pointer (components/quick/MvpUnfurl);
    // quickName is what assistive tech reads (its start is the line as drawn).
    quick: "In a rush? The MVP",
    quickName: "In a rush? The MVP, my Minimum Viable Portfolio",
  },
} as const;
