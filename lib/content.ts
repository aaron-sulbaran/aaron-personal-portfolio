export const siteContent = {
  meta: {
    title: "Aaron Sulbaran",
    description:
      "Third-year ECE at UT Austin. Pursuing product management. Building things with people, not just for them.",
    url: "https://aaronsulbaran.com",
  },
  hero: {
    name: "I'm Aaron.",
    tagline:
      "Third-year ECE at UT Austin. Pursuing product management. Building things with people, not just for them.",
    scrollLabel: "Scroll",
  },
  whoIAm: {
    label: "Who I am",
    paragraph:
      "I'm a third-year Electrical and Computer Engineering major at UT Austin with a business minor, graduating May 2027. I love the engineering side of building, but I'm happiest when I'm working with people to solve problems together, which is why PM pulled me in. I've interned at Capital One as both a business analyst and a product manager, led IEEE at UT Austin as president, and built an AI community on campus as an Anthropic Claude Ambassador. I was born in Maracaibo, Venezuela, moved to the U.S. young, and I've stayed close to my Hispanic roots the whole way through. I care about AI literacy, financial literacy especially for immigrants, and community building in Austin's startup scene. Outside of that I'm usually building something, whether it's a side project, a hackathon entry, or a 3D-printed fix for a problem I'd rather not buy a solution to.",
  },
  upToNow: {
    label: "What I'm up to",
    heading: "What I'm up to right now.",
    items: [
      "Competing in hackathons and shipping personal projects. This site is one of them, built in public.",
      "Investing in Austin's startup community because I think it's one of the most underrated builder hubs in the country.",
      "Building out a public voice on AI literacy, product thinking, and whatever else I'm chewing on.",
      "Always open to chatting if you're working on something interesting or just want to trade notes.",
    ],
  },
  connect: {
    label: "Connect",
    heading: "Let's talk.",
    lede: "I read everything. The fastest way in is LinkedIn or a quick email.",
    links: [
      {
        key: "linkedin",
        label: "LinkedIn",
        value: "in/aaron-sulbaran",
        href: "https://www.linkedin.com/in/aaron-sulbaran/",
        external: true,
      },
      {
        key: "github",
        label: "GitHub",
        value: "aaron-sulbaran",
        href: "https://github.com/aaron-sulbaran",
        external: true,
      },
      {
        key: "email-primary",
        label: "Email",
        value: "aarondsulbaran@gmail.com",
        href: "mailto:aarondsulbaran@gmail.com",
        external: false,
      },
      {
        key: "email-school",
        label: "Email (UT Austin)",
        value: "aaronsulbaran@utexas.edu",
        href: "mailto:aaronsulbaran@utexas.edu",
        external: false,
      },
    ],
  },
  footer: {
    tagline: "This site grows with me.",
    copyright: "© 2026 Aaron Sulbaran",
  },
  photos: [
    // TODO: Replace placeholder with drum major / marching band photo
    { src: "/photos/photo-01.svg", alt: "Aaron as drum major, conducting the UT Austin marching band." },
    // TODO: Replace placeholder with UT Austin campus photo
    { src: "/photos/photo-02.svg", alt: "UT Austin campus at golden hour, the tower in the background." },
    // TODO: Replace placeholder with Capital One internship photo
    { src: "/photos/photo-03.svg", alt: "Capital One internship, whiteboard sketching during a product review." },
    // TODO: Replace placeholder with hackathon photo
    { src: "/photos/photo-04.svg", alt: "Mid-hackathon, laptops and sticky notes, the team heads-down on a build." },
    // TODO: Replace placeholder with IEEE UT Austin group photo
    { src: "/photos/photo-05.svg", alt: "IEEE UT Austin group photo after a general meeting." },
    // TODO: Replace placeholder with Claude Ambassadors / AI community photo
    { src: "/photos/photo-06.svg", alt: "Anthropic Claude Ambassadors meetup, community in a campus classroom." },
    // TODO: Replace placeholder with Maracaibo / family / roots photo
    { src: "/photos/photo-07.svg", alt: "A photo from Maracaibo, Venezuela, early roots." },
  ],
} as const;

export type SiteContent = typeof siteContent;
