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

export interface MetricsSlot {
  value: string;
  label: string;
  sub?: string;
}

export const siteContent = {
  meta: {
    title: "Aaron Sulbaran",
    description:
      "Building products (and community) with people, not just for them.",
    url: "https://aaronsulbaran.com",
  },
  // The soundtrack band under the book (components/soundtrack): the one place
  // the music is offered and controlled, with the waveform running through
  // it. Each note describes what is on screen when it shows. Draft copy in my
  // voice, to be tightened by Aaron.
  listen: {
    ariaLabel: "Soundtrack",
    line: "Want some music while you scroll?",
    body: "I put together a short playlist for this site. The wave follows you down the page.",
    accept: "Play it",
    decline: "Not now",
    acceptedNote: "Keep going, the music will follow.",
    declinedNote: "No problem. It'll be here if you change your mind.",
    pausedNote: "Paused. Resume whenever you like.",
    pause: "Pause",
    resume: "Resume",
    freeze: "Freeze the wave",
    unfreeze: "Let the wave move",
  },
  // Words that open a "My definition of <term>" modal (DefinitionModal). The
  // ring's hero tagline was their only trigger; the Coil hero has no tagline,
  // so nothing opens them today. Kept, with the component, for a future home.
  // Keep each body to one or two sentences; drafts in Aaron's voice.
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
    // The pill (components/menu): its label rolls to "Close" while the panel
    // is open, and the Listen dot sits beside it as its own button.
    pillLabel: "Menu",
    closeLabel: "Close",
    dialogLabel: "Site menu",
    listenAriaLabelPlay: "Play my soundtrack",
    listenAriaLabelPause: "Pause my soundtrack",
    // The header bar past the hero (components/SiteNav.tsx).
    navAriaLabel: "Sections",
    markAriaLabel: "Back to top",
    // The panel's bottom row: email first, then the socials as text links.
    email: { label: "aarondsulbaran@gmail.com", href: "mailto:aarondsulbaran@gmail.com" },
    socials: [
      { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/aaron-sulbaran/" },
      { key: "github", label: "GitHub", href: "https://github.com/aaron-sulbaran" },
      { key: "x", label: "X", href: "https://x.com/imaaronsulbaran" },
      { key: "instagram", label: "Instagram", href: "https://www.instagram.com/aaron.sulbaran/" },
    ],
    items: [
      { key: "home", label: "Home", href: "#main", kind: "anchor" as const },
      { key: "work", label: "Work", href: "#work", kind: "anchor" as const },
      { key: "about", label: "About", href: "#about", kind: "anchor" as const },
      { key: "connect", label: "Connect", href: "#connect", kind: "anchor" as const },
    ],
  },
  modals: {
    closeAriaLabel: "Close",
    // The close hint reads by pointer type: a mouse and keyboard get Esc, a
    // touch screen gets the backdrop.
    closeHintKeyboard: "Press Esc to close",
    closeHintTouch: "Tap outside to close",
    // The work modal's accessible name: "<title> preview".
    workPreviewSuffix: "preview",
  },
  // The Coil hero. The heading is the server-rendered h1; greeting and name
  // are the two parts the scene draws, together, in the canvas.
  hero: {
    heading: "Hi, I'm Aaron.",
    greeting: "Hi, I'm",
    name: "Aaron",
    coilControl: "Coil",
    // First visit only, decorative (aria-hidden): the cursor's pill over a
    // card until the first card opens, the one line after that first card
    // flies home, and the touch screen's one line after the entrance.
    hints: {
      openMe: "Open me",
      keepExploring: "Keep exploring",
      tapCard: "Tap a card",
    },
    // QA only, shown with ?coildebug=name: the wake grid over the name and
    // each letter's contrast against the field.
    nameReadout: {
      label: "Name readout",
      wake: "Wake",
      letters: "Letters",
      spread: "Spread",
      range: "Range",
      greeting: "Greeting",
    },
  },
  // The Coil's loader: the name it fills while the page loads (the same word
  // the scene draws, so the exit hands one to the other) and the progress
  // bar's accessible name. The number itself carries no status word.
  loader: {
    name: "Aaron",
    progressLabel: "Loading the site",
  },
  // The book under the Coil hero (#work): Work then Photos, text first. Keys
  // match homeTiles keys where a card exists, so "seen" is shared with the
  // cards. Work targets: "case" opens /work/[slug], "external" opens a live
  // site in a new tab, "soon" renders the row without a link. Placeholder
  // photos never get a row.
  book: {
    ariaLabel: "Work and photos",
    workHeading: "Work",
    photosHeading: "Photos",
    seenLabel: "opened",
    externalLabel: "opens in a new tab",
    workRows: [
      // TODO(Aaron): Talos copy, and whether it gets a case page or stays a coming-soon row.
      { key: "talos", title: "Talos", meta: "Open source, coming soon", target: { kind: "soon" as const } },
      // TODO(Aaron): min/Max's live URL; the row becomes { kind: "external", href } once it lands.
      { key: "min-max", title: "min/Max", meta: "Live, link soon", target: { kind: "soon" as const } },
      { key: "capital-one-pm", title: "Capital One", meta: "Product manager intern, 2025", target: { kind: "case" as const, slug: "capital-one-pm" } },
      { key: "ieee-president", title: "IEEE UT Austin", meta: "President, 2025", target: { kind: "case" as const, slug: "ieee-president" } },
      { key: "claude-ambassador", title: "Anthropic ambassador", meta: "Claude ambassador, 2025", target: { kind: "case" as const, slug: "claude-ambassador" } },
      { key: "hackathon-builds", title: "Hackathon builds", meta: "Weekend builds, ongoing", target: { kind: "case" as const, slug: "hackathon-builds" } },
      { key: "aaronsulbaran-site", title: "This site", meta: "Built in public, 2026", target: { kind: "case" as const, slug: "aaronsulbaran-site" } },
    ],
    photoRows: [
      { key: "hsf-speaking", title: "Public speaking", meta: "HSF Scholars", src: "/photos/hsf-speaking.jpeg" },
      { key: "drum-major", title: "Drum major", meta: "Leading the band", src: "/photos/drum-major.jpeg" },
      { key: "yosemite-hiking", title: "Yosemite", meta: "Hiking", src: "/photos/yosemite-hiking.jpeg" },
      { key: "capital-one", title: "Capital One summer", meta: "Internship", src: "/photos/capital-one.jpeg" },
      { key: "uncs-grad", title: "Graduation", meta: "Family", src: "/photos/uncs-grad.jpeg" },
      { key: "claude-hackathon", title: "Claude hackathon", meta: "Austin", src: "/photos/claude-hackathon.jpeg" },
      { key: "misuki", title: "Venezuelan roots", meta: "Maracaibo", src: "/photos/misuki.jpeg" },
      { key: "traveling", title: "Traveling", meta: "On the road", src: "/photos/traveling.jpeg" },
      { key: "mt-fuji", title: "Mt. Fuji", meta: "Japan", src: "/photos/mt-fuji.jpeg" },
    ],
  },
  // The Coil's strand: real cards only (design review item 9), interleaved by
  // the pattern (P a photo, W a work card, in the orders below). Placeholders
  // never enter the coil; they return here as real photos arrive. Keys are
  // homeTiles keys; see strandTiles below.
  strand: {
    pattern: "PWPPWPPWPWPPWP",
    photos: ["hsf-speaking", "drum-major", "yosemite-hiking", "capital-one", "uncs-grad", "claude-hackathon", "misuki", "traveling", "mt-fuji"],
    work: ["capital-one-pm", "claude-ambassador", "ieee-president", "aaronsulbaran-site", "hackathon-builds"],
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
  // The contribution skyline inside Up to now (components/metrics). The two
  // slots stay null until I supply a LinkedIn figure and a fun one; a null
  // slot renders nothing.
  metrics: {
    groupLabel: "My GitHub contributions",
    statsLabel: "Contribution figures",
    streakLabel: "Current streak of contributions",
    day: "day",
    days: "days",
    since: "since",
    totalLabel: "contributions in the last 6 months",
    activeLabel: "days I shipped something",
    asOf: "As of",
    slots: { linkedin: null as MetricsSlot | null, fun: null as MetricsSlot | null },
    chart: {
      viewGroup: "Chart view",
      flat: "Flat",
      skyline: "Skyline",
      unit: "contribution",
      units: "contributions",
      none: "No contributions",
      on: "on",
      roleDescription: "interactive chart",
      less: "Less",
      more: "More",
      levels: ["No contributions", "Light", "Moderate", "Heavy", "Heaviest"],
      highlight: (level: string) => `Highlight ${level.toLowerCase()} days`,
      hintFlat: "Hover a day for details, arrow keys to explore",
      hintSkyline: "Drag to orbit, double-click to reset",
      label: (total: string, from: string, to: string, skyline: boolean) =>
        `${total} contributions from ${from} to ${to}, shown as a ${skyline ? "3D skyline" : "heat map"}. Use the arrow keys to read individual days.`,
    },
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
    backLabel: "Work",
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
    // The month comes from the build (lib/buildDate.ts).
    tagline: (month: string) => `This site grows with me. Last updated ${month}`,
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
    prompt: "Click to open player",
    // The pill's label as it lands on the wave (one per state, once per page
    // load), then the collapsed capsule's text (components/soundtrack/PillLabel).
    dockAccepted: "Music and volume live here.",
    dockDeclined: "Here if you change your mind.",
    dockReturning: "Welcome back. Your music is here.",
    dockFailed: "I couldn't start the music. Press here to try again.",
    capsulePaused: "Paused",
    capsuleUnanswered: "Music?",
    capsuleOff: "Music",
    statusPlaying: "Now playing",
    statusPaused: "Paused",
    statusReady: "Soundtrack ready",
    openInSpotify: "Open in Spotify",
    menuToggleOn: "Soundtrack on",
    menuTogglePaused: "Soundtrack paused",
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
    // Visible CC BY 4.0 attribution for the three tracks, on the band's lower
    // right (facts from public/audio/LICENSES.md).
    creditLead: "\u201cSmall Steps\u201d, \u201cWaves of Sleep\u201d and \u201cSlow Lights\u201d by",
    creditArtist: "Lee Rosevere",
    creditArtistUrl: "https://freemusicarchive.org/music/lee-rosevere/",
    creditJoin: ", licensed",
    creditLicense: "CC BY 4.0",
    creditLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
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
      role: "Product manager intern",
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
      role: "Business analyst intern",
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
      role: "Claude ambassador at UT Austin",
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
      summary: "Next.js 16, Tailwind, Framer Motion. Cursor-driven tile ring with shared-element flight modals, a work surface, and a living-document voice.",
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
  // width and height are the source file's pixels (checked by
  // content.test.ts); the modal sizes its image request for the cover crop.
  photos: [
    {
      src: "/photos/hsf-speaking.jpeg",
      width: 1084,
      height: 724,
      alt: "Me speaking on stage at HSF Scholars.",
      caption: "Speaking at the HSF Scholars summit. One of the first times I realized how much I love sharing what I'm learning with people earlier in the journey.",
    },
    {
      src: "/photos/drum-major.jpeg",
      width: 886,
      height: 886,
      alt: "Me in my drum major uniform during a performance.",
      caption: "Drum major days. Leading a band is mostly about reading the room, staying calm when things break, and making sure everyone around you feels seen.",
    },
    {
      src: "/photos/capital-one.jpeg",
      width: 768,
      height: 1024,
      alt: "Me at Capital One during my internship.",
      caption: "Capital One, product manager intern. Learned how real PM decisions get made when you're accountable to a team, not just a deck.",
    },
    {
      src: "/photos/yosemite-hiking.jpeg",
      width: 666,
      height: 1182,
      alt: "Me hiking in Yosemite.",
      caption: "Yosemite. Long hikes with good people are where I do my best thinking.",
    },
    {
      src: "/photos/uncs-grad.jpeg",
      width: 627,
      height: 836,
      alt: "Me at a UNC-related graduation.",
      caption: "Family graduation moment. My roots keep me grounded.",
    },
    {
      src: "/photos/claude-hackathon.jpeg",
      width: 768,
      height: 1024,
      alt: "Me with my co-ambassadors at the Claude hackathon.",
      caption: "Me and my co-ambassadors Rohan and Jessica at the first-ever Claude hackathon in Austin. Watching students ship real AI tools in one weekend was the kind of thing that made me want to stay close to this community.",
    },
    {
      src: "/photos/misuki.jpeg",
      width: 722,
      height: 1088,
      alt: "Me with family from Maracaibo.",
      caption: "Venezuelan roots. Born in Maracaibo, raised with arepas and a lot of loud love. Carrying that into everything I build.",
    },
    // TODO: Replace placeholder with an IEEE UT Austin meeting / president photo
    {
      src: "/photos/photo-08.svg",
      width: 480,
      height: 640,
      alt: "Placeholder for an IEEE UT Austin leadership moment.",
      caption: "TODO caption: IEEE UT Austin as president. Running a student org at scale taught me more about operations than any class.",
    },
    {
      src: "/photos/traveling.jpeg",
      width: 768,
      height: 1024,
      alt: "Me traveling.",
      caption: "Traveling. Being away from home is one of the fastest ways I learn what I actually care about.",
    },
    // TODO: Replace placeholder with an Austin startup community / meetup photo
    {
      src: "/photos/photo-10.svg",
      width: 480,
      height: 640,
      alt: "Placeholder for an Austin startup community moment.",
      caption: "TODO caption: Austin startup community. Builders, late coffees, conversations that go for hours.",
    },
    // TODO: Replace placeholder with a 3D-printing / making photo
    {
      src: "/photos/photo-11.svg",
      width: 480,
      height: 640,
      alt: "Placeholder for a 3D-printed project.",
      caption: "TODO caption: 3D-printed fixes. If I can print the solution, I will.",
    },
    {
      src: "/photos/mt-fuji.jpeg",
      width: 768,
      height: 1024,
      alt: "Me with Mt. Fuji in the background.",
      caption: "Mt. Fuji. Standing in front of it reminded me how small our day-to-day loops can feel once you've looked at something that big.",
    },
    // TODO: Replace placeholder with a friends / community photo
    {
      src: "/photos/photo-13.svg",
      width: 480,
      height: 640,
      alt: "Placeholder for a friends and community photo.",
      caption: "TODO caption: The people who make building feel less lonely.",
    },
    // TODO: Replace placeholder with a reflective / portrait photo
    {
      src: "/photos/photo-14.svg",
      width: 480,
      height: 640,
      alt: "Placeholder for a reflective portrait.",
      caption: "TODO caption: Quiet moment. Keeping it close to the chest.",
    },
  ],
  // Every card the home can show, by key: photo cards reference the `photos`
  // array by src, work cards the `workItems` array by slug, so a card opens
  // the right modal. The Coil's strand (below) picks its cards from here by
  // key; placeholder SVG photos stay listed but never enter the strand or the
  // book.
  homeTiles: [
    { kind: "photo" as const, key: "hsf-speaking", src: "/photos/hsf-speaking.jpeg" },
    { kind: "work"  as const, key: "capital-one-pm", slug: "capital-one-pm" },
    { kind: "photo" as const, key: "drum-major", src: "/photos/drum-major.jpeg" },
    { kind: "photo" as const, key: "yosemite-hiking", src: "/photos/yosemite-hiking.jpeg" },
    { kind: "work"  as const, key: "claude-ambassador", slug: "claude-ambassador" },
    { kind: "photo" as const, key: "capital-one", src: "/photos/capital-one.jpeg" },
    { kind: "photo" as const, key: "uncs-grad", src: "/photos/uncs-grad.jpeg" },
    { kind: "work"  as const, key: "ieee-president", slug: "ieee-president" },
    { kind: "photo" as const, key: "claude-hackathon", src: "/photos/claude-hackathon.jpeg" },
    { kind: "photo" as const, key: "misuki", src: "/photos/misuki.jpeg" },
    { kind: "work"  as const, key: "aaronsulbaran-site", slug: "aaronsulbaran-site" },
    { kind: "photo" as const, key: "photo-08", src: "/photos/photo-08.svg" }, // PLACEHOLDER
    { kind: "photo" as const, key: "traveling", src: "/photos/traveling.jpeg" },
    { kind: "work"  as const, key: "capital-one-ba", slug: "capital-one-ba" },
    { kind: "photo" as const, key: "photo-10", src: "/photos/photo-10.svg" }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-11", src: "/photos/photo-11.svg" }, // PLACEHOLDER
    { kind: "work"  as const, key: "hackathon-builds", slug: "hackathon-builds" },
    { kind: "photo" as const, key: "mt-fuji", src: "/photos/mt-fuji.jpeg" },
    { kind: "photo" as const, key: "photo-13", src: "/photos/photo-13.svg" }, // PLACEHOLDER
    { kind: "photo" as const, key: "photo-14", src: "/photos/photo-14.svg" }, // PLACEHOLDER
  ],
} as const;

export type Photo = (typeof siteContent.photos)[number];
export type WorkItem = (typeof siteContent.workItems)[number];
export type MenuItem = (typeof siteContent.menu.items)[number];
export type Track = SoundtrackTrack;
export type HomeTile = (typeof siteContent.homeTiles)[number];
export type Definition =
  (typeof siteContent.definitions)[keyof typeof siteContent.definitions];

// O(1) lookups for the card and row resolvers (HomeController, BookRow),
// built once at module load so per-render resolution never scans the arrays.
export const photoBySrc: ReadonlyMap<string, Photo> = new Map(
  siteContent.photos.map((p) => [p.src, p]),
);
export const workItemBySlug: ReadonlyMap<WorkItem["slug"], WorkItem> = new Map(
  siteContent.workItems.map((w) => [w.slug, w]),
);

export type BookWorkRow = (typeof siteContent.book.workRows)[number];
export type BookPhotoRow = (typeof siteContent.book.photoRows)[number];
// Every target a work row may have; the literal rows above use a subset.
export type BookWorkTarget = { kind: "case"; slug: string } | { kind: "external"; href: string } | { kind: "soon" };
export function bookWorkTarget(row: BookWorkRow): BookWorkTarget {
  return row.target;
}

// Placeholder photos are clearly marked SVGs in public/photos; they never
// appear in the book or the strand.
export function isPlaceholderPhoto(src: string) {
  return src.endsWith(".svg");
}

export const homeTileByKey: ReadonlyMap<string, HomeTile> = new Map(
  siteContent.homeTiles.map((tile) => [tile.key, tile]),
);

// The Coil's strand as tiles, in order: the pattern filled from the photo and
// work key lists. Unknown keys and placeholders are dropped (the content test
// asserts none are), so the scene only ever sees real cards.
export const strandTiles: readonly HomeTile[] = (() => {
  const { pattern, photos, work } = siteContent.strand;
  let photo = 0;
  let workIndex = 0;
  const tiles: HomeTile[] = [];
  for (const slot of pattern) {
    const key = slot === "P" ? photos[photo++] : work[workIndex++];
    const tile = key ? homeTileByKey.get(key) : undefined;
    if (!tile) continue;
    if (tile.kind === "photo" && isPlaceholderPhoto(tile.src)) continue;
    tiles.push(tile);
  }
  return tiles;
})();

// Body section shapes for work detail pages. When a workItem populates its
// bodySections array, each element must match one of these. More kinds can be
// added over time (image, quote, gallery, etc.).
export type WorkBodySection =
  | { kind: "paragraph"; text: string };
