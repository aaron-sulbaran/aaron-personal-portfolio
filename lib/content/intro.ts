// The home's first page, "who I am" (hero rework, slice 3): the heading is the
// hero's (siteContent.hero), then two paragraphs of three sentences carrying the
// inline link markup (lib/content/links.ts) so the defs, tips and pops come with
// it. These are Aaron's own words for page 1, set down verbatim (2026-10-31); they
// are no longer cut from siteContent.whoIAm, which About keeps as it was.
// lib/content/intro.test.ts pins each sentence and the set of pops on the page.
// The paragraphs are data: dropping a tip to plain words on this page is an edit
// to these strings.
// Page 1 tells two paragraphs, whole, in this order: who I am and how I work
// beside the name, then, after the wave, where I come from, the people I love
// and the hobbies (Aaron's own text for paragraph 2, set down 2026-10-31). The
// photo pop that sat on "leadership positions" now sits on "leading"; the
// Venezuela flag is back on the page, on "Venezuela"; "wanderlust" has the Mt.
// Fuji photo (media.ts travel-1-fuji, reused by the register); "thrill seeker"
// pops the four sports photos one after another (sandboarding, skydiving,
// downhill skating, rock climbing: register pop.thrill-seeker), and the
// paragraph's last sentence is Aaron's own new one (2026-10-31), which no longer
// names the sports as links of their own. The teaser at its foot is the button
// that deals and the way to the MVP.
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
        "Born in [Venezuela](pop:venezuela-flag) and raised in Texas, I love spending time with [family](pop:family) & [friends](pop:friends) while always happy to meet new people.",
        "Outside of class, I use credit card-maxxing to fulfill my [wanderlust](pop:wanderlust) and [3D printing](pop:3d-printing) to satisfy my engineering itch.",
        "I'm also a huge [thrill seeker](pop:thrill-seeker) and will say yes to just about any adventure.",
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
