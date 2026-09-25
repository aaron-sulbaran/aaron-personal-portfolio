export interface SoundtrackTrack {
  title: string;
  artist: string;
  src: string;
  spotifyUrl: string | null;
  cover: string | null;
}

// One link on the holding page. `icon` picks the brand mark in
// components/BrandIcons.tsx. `href: null` keeps the entry defined but hides it
// until the handle is filled in; the page never renders a dead link.
export interface HoldingSocial {
  key: string;
  label: string;
  icon: "linkedin" | "github" | "x" | "instagram" | "mail";
  href: string | null;
}

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
    // Left text panel copy for the settled ring-arc carousel (ArcIndex).
    // panelHelper is the small "how to drive this" line under the divider;
    // the kind/status labels name the focused card's type and explored
    // state (see writeActiveCard in TileRing).
    panelHelper:
      "Click a card to open it, explored cards frost over. Scroll over the cards to browse, scroll here to keep moving down the page.",
    panelKindPhoto: "Photo",
    panelKindCaseStudy: "Case study",
    panelExplored: "Explored",
    panelUnexplored: "Unexplored",
    // Reduced-motion static affordances (plan §3): visible prev/next buttons
    // near the settled arc, since there is no wheel-driven rotation to feel
    // for in that mode. Plain control labels, not first-person copy.
    panelPrev: "Previous card",
    panelNext: "Next card",
  },
  // Soundtrack invitation beat (components/ListenInvite.tsx): the in-flow
  // typographic moment between the carousel and Work where the waveform
  // introduces itself. Draft copy in my voice, to be tightened by Aaron.
  listen: {
    ariaLabel: "Soundtrack invitation",
    kicker: "A note from me",
    line: "This place has a soundtrack.",
    body:
      "I put together a short playlist that plays quietly while you look around. Your call entirely.",
    accept: "Play it",
    decline: "maybe later",
    acceptedNote:
      "It's on. The little player at the bottom of your screen is yours whenever you want it.",
    declinedNote:
      "No problem. If you change your mind, the soundtrack toggle lives in the menu up top.",
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
    placeholderBody: "Case study in progress. Ping me on LinkedIn if you want to hear about it sooner.",
    placeholderCta: "Ping me on LinkedIn",
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
  // Holding page (components/Holding.tsx), served at / while
  // NEXT_PUBLIC_SITE_MODE=full opts out (see lib/holding.ts). Recruiters arriving
  // from the resume link land here until the full build ships.
  holding: {
    label: "Under remodeling",
    heading: "Pardon the dust.",
    body: "I'm rebuilding the site from the ground up, check back soon!",
    interim: "In the meantime, here's what I've been up to:",
    deckAriaLabel: "A small stack of photo cards from the site, shuffling",
    socials: [
      {
        key: "linkedin",
        label: "LinkedIn",
        icon: "linkedin",
        href: "https://www.linkedin.com/in/aaron-sulbaran/",
      },
      {
        key: "github",
        label: "GitHub",
        icon: "github",
        href: "https://github.com/aaron-sulbaran",
      },
      { key: "x", label: "X", icon: "x", href: "https://x.com/imaaronsulbaran" },
      {
        key: "instagram",
        label: "Instagram",
        icon: "instagram",
        href: "https://www.instagram.com/aaron.sulbaran/",
      },
      {
        key: "email",
        label: "Email",
        icon: "mail",
        href: "mailto:aarondsulbaran@gmail.com",
      },
    ] as HoldingSocial[],
  },
  footer: {
    tagline: "This site grows with me. Last updated June 2026",
    copyright: "© 2026 Aaron Sulbaran",
  },
  // Private recruiting dashboard at /recruiting (app/recruiting/page.tsx),
  // fed by the vault's recruiting ledger export. Cookie-gated, never indexed.
  recruiting: {
    label: "Private",
    heading: "Recruiting.",
    body: "Every application I've sent this cycle, where it stands, and where it stopped. The ledger in my second brain is the source; this page is the view.",
    updatedPrefix: "Ledger as of",
    stalePrefix: "Feed unreachable, showing the copy from",
    unavailable: {
      heading: "No feed yet.",
      body: "I couldn't reach the ledger export and have nothing cached to show. Try again in a few minutes.",
    },
    controls: {
      season: "Season",
      seasonBoth: "Both",
      lane: "Lane",
      laneAll: "All lanes",
      laneUnknown: "Unassigned",
      outreach: "Include ignored outreach",
    },
    refresh: {
      button: "Refresh",
      running: "Refreshing",
      hint: "Read new mail and update the ledger now, instead of at the next hourly or overnight run",
      queued: "Queued; the Mac picks it up within a minute",
      stalled: "Still waiting for the Mac. It has to be awake for this to run.",
      done: "Up to date",
    },
    sort: {
      button: "Sort",
      heading: "Sort",
      reset: "Reset",
      by: "Sort by",
      then: "Then by",
      none: "Nothing",
      direction: "direction",
      keys: {
        status: "Status",
        applied: "Applied date",
        lastEvent: "Last event",
        company: "Company",
        role: "Role",
        lane: "Lane",
        season: "Season",
        next: "Next step",
      },
      dir: {
        priority: "Live first",
        closedFirst: "Closed first",
        earliest: "Earliest first",
        latest: "Latest first",
        az: "A to Z",
        za: "Z to A",
      },
    },
    filter: {
      button: "Filter",
      heading: "Filter",
      results: (shown: number, total: number) => `${shown} of ${total} applications`,
      clearAll: "Clear all",
      clearFilters: "Clear filters",
      close: "Close",
      apply: "Apply",
      lane: "Lane",
      status: "Status",
      statuses: {
        offers: "Offers",
        inProcess: "In process",
        applied: "Applied",
        planned: "Planned",
        closed: "Closed",
      },
      outreach: "Include ignored outreach",
      outreachChip: "Ignored outreach shown",
      active: "Active filters",
      removeChip: (label: string) => `Remove ${label} filter`,
    },
    lanes: {
      "full-time": "Full-time",
      internship: "Internship",
      "co-op": "Co-op",
      "?": "Unassigned",
    },
    tiles: {
      applications: "Applications",
      responseRate: "Response rate",
      interviewRate: "Interview rate",
      offers: "Offers",
      medianResponse: "Median days to first reply",
      none: "n/a",
    },
    funnel: {
      heading: "Funnel",
      countLabel: (n: number) => `${n} ${n === 1 ? "application" : "applications"}`,
      empty: "Nothing in the funnel for this selection yet.",
      plannedNote: (n: number) => `${n} planned, not yet applied`,
      lanesLabel: "Lanes",
      outcomesLabel: "What happened",
      nodes: {
        applied: "Applied",
        oa: "OA",
        screen: "Screen",
        interview: "Interview",
        final: "Final",
        offer: "Offer",
        accepted: "Accepted",
      },
      exits: {
        open: "Still open",
        rejected: "Rejected",
        noreply: "No reply",
        withdrew: "Withdrew",
        ignored: "Ignored",
      },
      outreach: "Outreach",
      tones: {
        forward: "Moved forward",
        open: "Still open",
        rejected: "Rejected",
        noreply: "No reply",
        withdrew: "Withdrew",
      },
      ofApplied: "of applied",
      flowTo: "to",
      referredLegend: "Referred",
      referredCount: (n: number) => `${n} referred`,
      more: (n: number) => `and ${n} more`,
    },
    tableNote: (parts: { counted: number; planned: number; outreach: number; unapplied: number }) =>
      [
        `${parts.counted} in the funnel`,
        parts.planned ? `${parts.planned} planned` : "",
        parts.unapplied ? `${parts.unapplied} closed before applying` : "",
        parts.outreach ? `${parts.outreach} ignored outreach` : "",
      ]
        .filter(Boolean)
        .join(", "),
    edit: {
      add: "Add application",
      editRow: (company: string) => `Edit ${company}`,
      updateHeading: "Edit",
      updateHint: "Change anything; only what you change is sent.",
      addHeading: "Add an application",
      status: "Status",
      date: "Date",
      when: "When this happened",
      applied: "Applied",
      next: "Next step",
      nextPlaceholder: "Nothing pending",
      due: "Due",
      note: "Note",
      notePlaceholder: "Optional. What happened, in a line.",
      company: "Company",
      role: "Role",
      lane: "Lane",
      season: "Season",
      tier: "Priority",
      referral: "Applied with a referral",
      tiers: { target: "Target", opportunistic: "Opportunistic", "outreach-ignored": "Outreach" },
      submit: "Save",
      submitting: "Saving",
      cancel: "Cancel",
      remove: "Remove from dashboard",
      removeHeading: (company: string) => `Remove ${company}?`,
      removeBody:
        "It disappears from the funnel, tiles and table. The ledger keeps it as off-track, so a later email about it cannot bring it back.",
      removeReason: "Optional: why it does not belong",
      removeConfirm: "Remove",
      keep: "Keep it",
      pending: "Pending",
      pendingTitle: "Saved. The ledger applies it at the next hourly sync.",
      nextDone: (what: string) => `Mark done: ${what}`,
      nextDoneFailed: "Could not save; try again",
      failedHeading: (n: number) => `${n} ${n === 1 ? "edit" : "edits"} could not be applied in the last week`,
      loadError: "Pending edits could not be loaded:",
    },
    table: {
      heading: "Applications",
      download: "Download CSV",
      empty: "No applications match this selection.",
      active: "Active",
      referral: "Applied with a referral",
      columns: {
        company: "Company",
        role: "Role",
        lane: "Lane",
        season: "Season",
        status: "Status",
        applied: "Applied",
        lastEvent: "Last event",
        next: "Next",
      },
      statuses: {
        planned: "Planned",
        applied: "Applied",
        oa: "OA",
        screen: "Screen",
        interview: "Interview",
        final: "Final",
        offer: "Offer",
        accepted: "Accepted",
        rejected: "Rejected",
        withdrawn: "Withdrawn",
        ghosted: "Ghosted",
        stale: "Stale",
        ignored: "Ignored",
      },
    },
  },
  soundtrack: {
    invite: "Play the soundtrack",
    inviteArtist: "A curated playlist for this site",
    prompt: "Click to open player",
    promptQuestion:
      "I curated a playlist for this site. Mind if I put it on while you look around?",
    promptYes: "Please do",
    promptNo: "Maybe later",
    statusPlaying: "Now playing",
    statusPaused: "Paused",
    statusReady: "Soundtrack ready",
    openInSpotify: "Open in Spotify",
    menuToggleOn: "Soundtrack on",
    menuToggleOff: "Soundtrack off",
    menuAriaLabelOn: "Turn soundtrack on",
    menuAriaLabelOff: "Turn soundtrack off",
    ariaOpen: "Open soundtrack player",
    ariaCollapse: "Collapse player",
    ariaSeek: "Seek track position",
    ariaPrevious: "Previous track",
    ariaPlay: "Play",
    ariaPause: "Pause",
    ariaNext: "Next track",
    ariaVolume: "Volume",
    tracks: [
      {
        title: "Small Steps",
        artist: "Lee Rosevere",
        src: "/audio/track-01.mp3",
        spotifyUrl: null,
        cover: null,
      },
      {
        title: "Waves of Sleep",
        artist: "Lee Rosevere",
        src: "/audio/track-02.mp3",
        spotifyUrl: null,
        cover: null,
      },
      {
        title: "Slow Lights",
        artist: "Lee Rosevere",
        src: "/audio/track-03.mp3",
        spotifyUrl: null,
        cover: null,
      },
    ] satisfies SoundtrackTrack[],
  },
  // Work items. `bodySections: []` means the detail page renders a quiet
  // "case study in progress" block. Populate with { kind: 'paragraph', text }
  // entries (more kinds added later). Keep `slug` URL-safe and unique.
  workItems: [
    {
      slug: "capital-one-pm",
      title: "Capital One",
      role: "Product Manager Intern",
      year: "2025",
      logo: "/work/logos/capital-one.svg",
      teaser: "Learned how real PM decisions get made when you're accountable to a team, not a deck.",
      summary: "Product manager intern at Capital One, working on an internal tool used by analysts across the business.",
      bodySections: [],
      links: [],
    },
    {
      slug: "capital-one-ba",
      title: "Capital One",
      role: "Business Analyst Intern",
      year: "2024",
      logo: "/work/logos/capital-one.svg",
      teaser: "First real taste of how product and business decisions actually get made inside a big bank.",
      summary: "Business analyst intern on a customer-facing product team. Shipped analysis that fed directly into roadmap decisions.",
      bodySections: [],
      links: [],
    },
    {
      slug: "claude-ambassador",
      title: "Anthropic",
      role: "Claude Ambassador at UT Austin",
      year: "2025",
      logo: "/work/logos/anthropic.svg",
      teaser: "Building an AI community on campus. Co-hosted the first Claude hackathon in Austin.",
      summary: "Claude Ambassador at UT Austin. Running workshops, hackathons, and study groups focused on AI literacy for students.",
      bodySections: [],
      links: [],
    },
    {
      slug: "ieee-president",
      title: "IEEE UT Austin",
      role: "President",
      year: "2025",
      logo: "/work/logos/ieee.svg",
      teaser: "Ran the chapter at scale. More operations lessons than any class I took.",
      summary: "President of IEEE at UT Austin. Led event planning, sponsor relationships, and a growing exec team across ECE.",
      bodySections: [],
      links: [],
    },
    {
      slug: "aaronsulbaran-site",
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
    },
    {
      slug: "hackathon-builds",
      title: "Hackathon builds",
      role: "Personal projects",
      year: "Ongoing",
      logo: "/work/logos/hackathon.svg",
      teaser: "A running set of weekend builds. Rough, fast, and shipped.",
      summary: "Hackathon projects across AI, hardware, and 3D printing. Updated every few months.",
      bodySections: [],
      links: [],
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
  // `title` is the short label the left text panel (ArcIndex) shows for each
  // card (card number = array index + 1). Keep titles 1 to 3 words. `blurb`
  // is the one-line description shown under the title when the card is
  // focused; keep each under ~90 characters, first person, no em dashes.
  // Titles/blurbs marked PLACEHOLDER below belong to the placeholder SVG
  // tiles and should be finalized when real photos replace them.
  homeTiles: [
    { kind: "photo" as const, key: "hsf-speaking", src: "/photos/hsf-speaking.jpeg", title: "Public Speaking", blurb: "Speaking at HSF Scholars, where I realized how much I love teaching what I'm learning." },
    { kind: "work"  as const, key: "capital-one-pm", slug: "capital-one-pm", title: "Capital One", blurb: "A summer as a PM intern, accountable to a team, not a deck." },
    { kind: "photo" as const, key: "drum-major", src: "/photos/drum-major.jpeg", title: "Drum Major", blurb: "Leading the band from the podium, reading the room, staying calm under pressure." },
    { kind: "photo" as const, key: "yosemite-hiking", src: "/photos/yosemite-hiking.jpeg", title: "Yosemite", blurb: "Long hikes in Yosemite, where I do my best thinking." },
    { kind: "work"  as const, key: "claude-ambassador", slug: "claude-ambassador", title: "Anthropic", blurb: "Building an AI community on campus, co-hosting Austin's first Claude hackathon." },
    { kind: "photo" as const, key: "capital-one", src: "/photos/capital-one.jpeg", title: "Capital One", blurb: "A candid from my PM internship at Capital One, learning how real decisions get made." },
    { kind: "photo" as const, key: "uncs-grad", src: "/photos/uncs-grad.jpeg", title: "Graduation", blurb: "A family graduation moment. My roots keep me grounded." },
    { kind: "work"  as const, key: "ieee-president", slug: "ieee-president", title: "IEEE", blurb: "Running IEEE at UT Austin taught me more about operations than any class did." },
    { kind: "photo" as const, key: "claude-hackathon", src: "/photos/claude-hackathon.jpeg", title: "Claude Hackathon", blurb: "With my co-ambassadors at Austin's first Claude hackathon, watching students ship fast." },
    { kind: "photo" as const, key: "misuki", src: "/photos/misuki.jpeg", title: "Venezuelan Roots", blurb: "Born in Maracaibo, raised with arepas and a lot of loud love." },
    { kind: "work"  as const, key: "aaronsulbaran-site", slug: "aaronsulbaran-site", title: "This Site", blurb: "This site itself. A living personal statement that grows with me." },
    { kind: "photo" as const, key: "photo-08", src: "/photos/photo-08.svg", title: "IEEE President", blurb: "Placeholder photo. An IEEE leadership shot is coming soon." }, // PLACEHOLDER
    { kind: "photo" as const, key: "traveling", src: "/photos/traveling.jpeg", title: "Traveling", blurb: "Traveling teaches me fast what I actually care about." },
    { kind: "work"  as const, key: "capital-one-ba", slug: "capital-one-ba", title: "Capital One", blurb: "My first taste of how product decisions get made inside a big bank." },
    { kind: "photo" as const, key: "photo-10", src: "/photos/photo-10.svg", title: "Austin Builders", blurb: "Placeholder photo. An Austin startup community shot is coming soon." }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-11", src: "/photos/photo-11.svg", title: "Making", blurb: "Placeholder photo. A making and 3D-printing shot is coming soon." }, // PLACEHOLDER
    { kind: "work"  as const, key: "hackathon-builds", slug: "hackathon-builds", title: "Hackathon Builds", blurb: "A running set of weekend builds. Rough, fast, and shipped." },
    { kind: "photo" as const, key: "mt-fuji", src: "/photos/mt-fuji.jpeg", title: "Mt. Fuji", blurb: "Standing in front of Mt. Fuji, a reminder of how small my daily loops can feel." },
    { kind: "photo" as const, key: "photo-13", src: "/photos/photo-13.svg", title: "Community", blurb: "Placeholder photo. A friends and community shot is coming soon." }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-14", src: "/photos/photo-14.svg", title: "Quiet Moment", blurb: "Placeholder photo. A quiet, reflective portrait is coming soon." }, // PLACEHOLDER
  ],
} as const;

export type Photo = (typeof siteContent.photos)[number];
export type WorkItem = (typeof siteContent.workItems)[number];
export type MenuItem = (typeof siteContent.menu.items)[number];
export type Track = SoundtrackTrack;
export type HomeTile = (typeof siteContent.homeTiles)[number];
export type Definition =
  (typeof siteContent.definitions)[keyof typeof siteContent.definitions];

// O(1) lookups for the home-tile resolvers (GlassTile, MobileHome, FlyingTile),
// built once at module load so per-render resolution never scans the arrays.
export const photoBySrc: ReadonlyMap<string, Photo> = new Map(
  siteContent.photos.map((p) => [p.src, p]),
);
export const workItemBySlug: ReadonlyMap<WorkItem["slug"], WorkItem> = new Map(
  siteContent.workItems.map((w) => [w.slug, w]),
);

// Body section shapes for work detail pages. When a workItem populates its
// bodySections array, each element must match one of these. More kinds can be
// added over time (image, quote, gallery, etc.).
export type WorkBodySection =
  | { kind: "paragraph"; text: string };
