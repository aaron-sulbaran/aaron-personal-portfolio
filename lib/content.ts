export const siteContent = {
  meta: {
    title: "Aaron Sulbaran",
    description:
      "Building products (and community) with people, not just for them.",
    url: "https://aaronsulbaran.com",
  },
  home: {
    name: "Hi, I'm Aaron.",
    tagline:
      "Building products (and community) with people, not just for them.",
    scrollHint: "Scroll to explore",
    deckTitle: "Explore my experiences",
    deckSubtitle: "Hover a card to preview it, then click to open.",
  },
  // Hero words that open a "My definition of <term>" modal. Keys must match the
  // exact word as it appears in home.tagline so HomeHero can wire that word to
  // its definition. Keep each body to one or two sentences; these are drafts in
  // Aaron's voice to be tightened later.
  definitions: {
    products: {
      term: "products",
      titlePrefix: "My definition of",
      body:
        "To me, product is turning a real human need into something people actually reach for. Less about features, more about judgment: deciding what matters, what to cut, and why.",
    },
    community: {
      term: "community",
      titlePrefix: "My definition of",
      body:
        "Community, to me, is what happens when you build with people instead of just for them. It is the rooms where people show up, contribute, and leave more capable than they came.",
    },
  },
  about: {
    label: "About",
    heading: "About.",
    lede: "The longer version of who I am, what I'm working on, and how to reach me.",
    metaDescription: "Who I am, what I'm working on, and how to reach me.",
  },
  menu: {
    ariaLabelOpen: "Open menu",
    ariaLabelClose: "Close menu",
    themeToggleToDark: "Dark mode",
    themeToggleToLight: "Light mode",
    themeAriaLabelToDark: "Switch to dark mode",
    themeAriaLabelToLight: "Switch to light mode",
    items: [
      { key: "home", label: "Home", href: "#main", kind: "anchor" as const },
      { key: "work", label: "Work", href: "#work", kind: "anchor" as const },
      { key: "about", label: "About", href: "#about", kind: "anchor" as const },
    ],
  },
  modals: {
    closeAriaLabel: "Close",
  },
  notFound: {
    title: "Nothing here.",
    body: "I moved things around while building this out. The page you're looking for doesn't exist.",
    cta: "Back to home",
  },
  errorPage: {
    title: "Something went wrong.",
    body: "An unexpected error occurred. It's on my end, not yours.",
    retry: "Try again",
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
  work: {
    label: "Work",
    heading: "Things I've built and shipped.",
    lede: "Internships, projects, and communities I've poured real time into. More case studies rolling in over the next few weeks.",
    cta: "See more",
    seeAll: "See everything →",
    placeholderBody: "Case study in progress. Ping me on LinkedIn if you want to hear about it sooner.",
    placeholderCta: "Ping me on LinkedIn",
    indexHeading: "Work.",
    indexLede: "Every project, internship, and community I'm proud of. Click in for the story.",
    backLabel: "← Work",
    metaDescription: "Projects, internships, and communities I've poured real time into.",
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
    tagline: "This site grows with me. Last updated June 2026",
    copyright: "© 2026 Aaron Sulbaran",
  },
  // Work items. `bodySections: []` means the detail page renders a quiet
  // "case study in progress" block. Populate with { kind: 'paragraph', text }
  // entries (more kinds added later). Keep `slug` URL-safe and unique.
  workItems: [
    {
      slug: "capital-one-pm",
      type: "experience" as const,
      title: "Capital One",
      role: "Product Manager Intern",
      year: "2025",
      logo: "/work/logos/capital-one.svg",
      teaser: "Learned how real PM decisions get made when you're accountable to a team, not a deck.",
      summary: "Product manager intern at Capital One, working on an internal tool used by analysts across the business.",
      bodySections: [],
      links: [],
      featuredOnHome: true,
    },
    {
      slug: "capital-one-ba",
      type: "experience" as const,
      title: "Capital One",
      role: "Business Analyst Intern",
      year: "2024",
      logo: "/work/logos/capital-one.svg",
      teaser: "First real taste of how product and business decisions actually get made inside a big bank.",
      summary: "Business analyst intern on a customer-facing product team. Shipped analysis that fed directly into roadmap decisions.",
      bodySections: [],
      links: [],
      featuredOnHome: true,
    },
    {
      slug: "claude-ambassador",
      type: "experience" as const,
      title: "Anthropic",
      role: "Claude Ambassador at UT Austin",
      year: "2025",
      logo: "/work/logos/anthropic.svg",
      teaser: "Building an AI community on campus. Co-hosted the first Claude hackathon in Austin.",
      summary: "Claude Ambassador at UT Austin. Running workshops, hackathons, and study groups focused on AI literacy for students.",
      bodySections: [],
      links: [],
      featuredOnHome: true,
    },
    {
      slug: "ieee-president",
      type: "experience" as const,
      title: "IEEE UT Austin",
      role: "President",
      year: "2025",
      logo: "/work/logos/ieee.svg",
      teaser: "Ran the chapter at scale. More operations lessons than any class I took.",
      summary: "President of IEEE at UT Austin. Led event planning, sponsor relationships, and a growing exec team across ECE.",
      bodySections: [],
      links: [],
      featuredOnHome: true,
    },
    {
      slug: "aaronsulbaran-site",
      type: "project" as const,
      title: "aaronsulbaran.com",
      role: "Built in public",
      year: "2026",
      logo: "/work/logos/site.svg",
      teaser: "This site. A Phase 1 personal statement that grows with me.",
      summary: "Next.js 14, Tailwind, Framer Motion. Cursor-driven tile ring with shared-element flight modals, a work surface, and a living-document voice.",
      bodySections: [],
      links: [
        { label: "GitHub", href: "https://github.com/aaron-sulbaran" },
      ],
      featuredOnHome: false,
    },
    {
      slug: "hackathon-builds",
      type: "project" as const,
      title: "Hackathon builds",
      role: "Personal projects",
      year: "Ongoing",
      logo: "/work/logos/hackathon.svg",
      teaser: "A running set of weekend builds. Rough, fast, and shipped.",
      summary: "Hackathon projects across AI, hardware, and 3D printing. Updated every few months.",
      bodySections: [],
      links: [],
      featuredOnHome: false,
    },
  ],
  // 14 photos on desktop, 6 on mobile. Each caption is what shows in the
  // click-to-expand modal; edit freely, first person, no em dashes.
  photos: [
    {
      src: "/photos/hsf-speaking.jpeg",
      alt: "Aaron speaking on stage at HSF Scholars.",
      caption: "Speaking at the HSF Scholars summit. One of the first times I realized how much I love sharing what I'm learning with people earlier in the journey.",
    },
    {
      src: "/photos/drum-major.jpeg",
      alt: "Me in my drum major uniform during a performance.",
      caption: "Drum major days. Leading a band is mostly about reading the room, staying calm when things break, and making sure everyone around you feels seen.",
    },
    {
      src: "/photos/capital-one.jpeg",
      alt: "Aaron at Capital One during his internship.",
      caption: "Capital One, product manager intern. Learned how real PM decisions get made when you're accountable to a team, not just a deck.",
    },
    {
      src: "/photos/yosemite-hiking.jpeg",
      alt: "Aaron hiking in Yosemite.",
      caption: "Yosemite. Long hikes with good people are where I do my best thinking.",
    },
    {
      src: "/photos/uncs-grad.jpeg",
      alt: "Aaron at a UNC-related graduation photo.",
      caption: "Family graduation moment. My roots keep me grounded.",
    },
    {
      src: "/photos/claude-hackathon.jpeg",
      alt: "Aaron and co-ambassadors at the Claude hackathon.",
      caption: "Me and my co-ambassadors Rohan and Jessica at the first-ever Claude hackathon in Austin. Watching students ship real AI tools in one weekend was the kind of thing that made me want to stay close to this community.",
    },
    {
      src: "/photos/misuki.jpeg",
      alt: "Aaron with family from Maracaibo.",
      caption: "Venezuelan roots. Born in Maracaibo, raised with arepas and a lot of loud love. Carrying that into everything I build.",
    },
    // TODO: Replace placeholder with an IEEE UT Austin meeting / president photo
    {
      src: "/photos/photo-08.svg",
      alt: "Placeholder for an IEEE UT Austin leadership moment.",
      caption: "TODO caption: IEEE UT Austin as president. Running a student org at scale taught me more about operations than any class.",
    },
    {
      src: "/photos/traveling.jpeg",
      alt: "Aaron traveling.",
      caption: "Traveling. Being away from home is one of the fastest ways I learn what I actually care about.",
    },
    // TODO: Replace placeholder with an Austin startup community / meetup photo
    {
      src: "/photos/photo-10.svg",
      alt: "Placeholder for an Austin startup community moment.",
      caption: "TODO caption: Austin startup community. Builders, late coffees, conversations that go for hours.",
    },
    // TODO: Replace placeholder with a 3D-printing / making photo
    {
      src: "/photos/photo-11.svg",
      alt: "Placeholder for a 3D-printed project.",
      caption: "TODO caption: 3D-printed fixes. If I can print the solution, I will.",
    },
    {
      src: "/photos/mt-fuji.jpeg",
      alt: "Aaron with Mt. Fuji in the background.",
      caption: "Mt. Fuji. Standing in front of it reminded me how small our day-to-day loops can feel once you've looked at something that big.",
    },
    // TODO: Replace placeholder with a friends / community photo
    {
      src: "/photos/photo-13.svg",
      alt: "Placeholder for a friends and community photo.",
      caption: "TODO caption: The people who make building feel less lonely.",
    },
    // TODO: Replace placeholder with a reflective / portrait photo
    {
      src: "/photos/photo-14.svg",
      alt: "Placeholder for a reflective portrait.",
      caption: "TODO caption: Quiet moment. Keeping it close to the chest.",
    },
  ],
  // Home-page tile ring. Order here is rendering order (index 0 sits at the
  // top of the ring and tiles are distributed clockwise). Mix of photo tiles
  // and work tiles interleaved so neither type clusters on one side. Photo
  // tiles reference the `photos` array by src; work tiles reference the
  // `workItems` array by slug, so the click handler can open the right modal.
  // `title` is the short label the deck index shows for each card (card number =
  // array index + 1). Keep titles 1 to 3 words. Titles marked PLACEHOLDER below
  // belong to the placeholder SVG tiles and should be finalized when real photos
  // replace them.
  homeTiles: [
    { kind: "photo" as const, key: "hsf-speaking", src: "/photos/hsf-speaking.jpeg", title: "Public Speaking" },
    { kind: "work"  as const, key: "capital-one-pm", slug: "capital-one-pm", title: "Capital One" },
    { kind: "photo" as const, key: "drum-major", src: "/photos/drum-major.jpeg", title: "Drum Major" },
    { kind: "photo" as const, key: "yosemite-hiking", src: "/photos/yosemite-hiking.jpeg", title: "Yosemite" },
    { kind: "work"  as const, key: "claude-ambassador", slug: "claude-ambassador", title: "Anthropic" },
    { kind: "photo" as const, key: "capital-one", src: "/photos/capital-one.jpeg", title: "Capital One" },
    { kind: "photo" as const, key: "uncs-grad", src: "/photos/uncs-grad.jpeg", title: "Graduation" },
    { kind: "work"  as const, key: "ieee-president", slug: "ieee-president", title: "IEEE" },
    { kind: "photo" as const, key: "claude-hackathon", src: "/photos/claude-hackathon.jpeg", title: "Claude Hackathon" },
    { kind: "photo" as const, key: "misuki", src: "/photos/misuki.jpeg", title: "Venezuelan Roots" },
    { kind: "work"  as const, key: "aaronsulbaran-site", slug: "aaronsulbaran-site", title: "This Site" },
    { kind: "photo" as const, key: "photo-08", src: "/photos/photo-08.svg", title: "IEEE President" }, // PLACEHOLDER
    { kind: "photo" as const, key: "traveling", src: "/photos/traveling.jpeg", title: "Traveling" },
    { kind: "work"  as const, key: "capital-one-ba", slug: "capital-one-ba", title: "Capital One" },
    { kind: "photo" as const, key: "photo-10", src: "/photos/photo-10.svg", title: "Austin Builders" }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-11", src: "/photos/photo-11.svg", title: "Making" }, // PLACEHOLDER
    { kind: "work"  as const, key: "hackathon-builds", slug: "hackathon-builds", title: "Hackathon Builds" },
    { kind: "photo" as const, key: "mt-fuji", src: "/photos/mt-fuji.jpeg", title: "Mt. Fuji" },
    { kind: "photo" as const, key: "photo-13", src: "/photos/photo-13.svg", title: "Community" }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-14", src: "/photos/photo-14.svg", title: "Quiet Moment" }, // PLACEHOLDER
  ],
} as const;

export type Photo = (typeof siteContent.photos)[number];
export type WorkItem = (typeof siteContent.workItems)[number];
export type MenuItem = (typeof siteContent.menu.items)[number];
export type HomeTile = (typeof siteContent.homeTiles)[number];
export type Definition =
  (typeof siteContent.definitions)[keyof typeof siteContent.definitions];

// Body section shapes for work detail pages. When a workItem populates its
// bodySections array, each element must match one of these. More kinds can be
// added over time (image, quote, gallery, etc.).
export type WorkBodySection =
  | { kind: "paragraph"; text: string };
