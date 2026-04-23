export const siteContent = {
  meta: {
    title: "Aaron Sulbaran",
    description:
      "Third-year ECE at UT Austin. Pursuing product management. Building things with people, not just for them.",
    url: "https://aaronsulbaran.com",
  },
  hero: {
    name: "Hi, I'm Aaron.",
    tagline:
      "ECE at UT Austin. Pursuing product management. Building things with people, not just for them.",
    scrollLabel: "Scroll",
  },
  menu: {
    ariaLabelOpen: "Open menu",
    ariaLabelClose: "Close menu",
    items: [
      { key: "home", label: "Home", href: "/", kind: "route" as const },
      { key: "work", label: "Work", href: "/work", kind: "route" as const },
      { key: "about", label: "About", href: "/#who-i-am", kind: "anchor" as const },
    ],
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
    cta: "See more →",
    seeAll: "See everything →",
    placeholderBody: "Case study in progress. Ping me on LinkedIn if you want to hear about it sooner.",
    indexHeading: "Work.",
    indexLede: "Every project, internship, and community I'm proud of. Click in for the story.",
    backLabel: "← Work",
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
    tagline: "This site grows with me. Last updated April 22, 2026",
    copyright: "© 2026 Aaron Sulbaran",
  },
  // 14 photos on desktop, 6 on mobile. Each caption is what shows in the
  // click-to-expand modal — edit freely, first person, no em dashes.
  photos: [
    {
      src: "/photos/hsf-speaking.jpeg",
      alt: "Aaron speaking on stage at HSF Scholars.",
      caption: "Speaking at the HSF Scholars summit. One of the first times I realized how much I love sharing what I'm learning with people earlier in the journey.",
    },
    {
      src: "/photos/drum-major.jpeg",
      alt: "Aaron in his drum major uniform during a performance.",
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
} as const;

export type SiteContent = typeof siteContent;
export type Photo = (typeof siteContent.photos)[number];
