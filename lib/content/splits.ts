// The share alias at /splits (app/splits/page.tsx). X cached /speedrun's link
// preview before that page had its new card, and it keys the cache on the final
// URL, so X's crawler reads this page instead and everyone else is redirected to
// /speedrun (next.config.mjs). These strings mirror the speedrun zone's
// speedrunCopy.meta (zone-speedrun); change them together.
export const splitsCopy = {
  path: "/splits",
  title: "Splits: a concept for the speedrun talent team · Aaron Sulbaran",
  description:
    "What joining the speedrun talent network could give you on day one: a concept and working demo by Aaron Sulbaran.",
  image: {
    url: "https://aaronsulbaran.com/speedrun/splits-card.png",
    width: 2400,
    height: 1260,
    alt: "job hunting sux. I would know. My fall search as a flow chart, 84 applications, beside Splits showing a candidate's matches and the talent team's intro queue.",
  },
  body: {
    before: "Splits lives at ",
    link: "aaronsulbaran.com/speedrun",
    href: "/speedrun",
    after: ".",
  },
} as const;
