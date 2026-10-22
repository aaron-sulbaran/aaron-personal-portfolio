// The home's first page, "who I am" (hero rework, slice 3): the heading is the
// hero's (siteContent.hero), then four short blocks of two to three sentences,
// each sentence cut word for word from siteContent.whoIAm (nothing new is
// written; lib/content/intro.test.ts holds each to that), carrying the inline
// link markup (lib/content/links.ts) so the defs, tips and pops come with it.
// The blocks are data: dropping a tip to plain words on this page is an edit
// to these strings. Aaron rewrites them later.
// Then the teaser at the foot: the line, the button that deals, the way to the
// 30-second version.
export const intro = {
  ariaLabel: "About me",
  blocks: [
    {
      key: "who",
      sentences: [
        "I'm a [product](def:product)-focused engineer.",
        "I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for.",
        "I like products that bend for the person using them, not the other way around.",
      ],
    },
    {
      key: "work",
      sentences: [
        "I tend to gravitate towards [leadership positions](pop:leadership-award) because I love getting a group of people with very different skillsets working towards one goal.",
        "I learned it as a drum major in high school, continued doing it in my orgs on campus, and want to do the same in my full-time work.",
      ],
    },
    {
      key: "outside",
      sentences: [
        "I love people ([family](pop:family) & [friends](pop:friends)) outside of work too.",
        "I love to travel, tinker on personal projects, and getting active.",
        "I love credit card-maxxing since it allows me to fulfill my wanderlust, recently got into [3D printing](pop:3d-printing) because it lets me work on the engineering I don't get to do in class, and love [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
      ],
    },
    {
      key: "from",
      sentences: [
        "I was born in Maracaibo, [Venezuela](pop:venezuela-flag), and moved to the U.S. when I was around 4.",
        "I grew up in Texas, mostly in Katy, watching my dad figure out a business as he went.",
        "I worked in it too, which is where I learned to wear a lot of hats.",
      ],
    },
  ],
  // The phone's disclosure in the "teaser peeks" arrangement (lab only).
  more: "More about me",
  teaser: {
    line: "Want to see what I've been up to?",
    deal: "Deal me in",
    // The button once the cards are dealt: it leads back to them, no replay.
    back: "Back to my cards",
    quick: "In a rush? The 30-second version",
  },
} as const;
