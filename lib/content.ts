import { register } from "./content/register";
import { bookPeopleOrder, bookWorkOrder, cards, strandOrder } from "./content/cards";
import type { SoundtrackTrack, WhoIAmBlock } from "./content/types";
import { liveTracks } from "./content/tracks";
import { bookRow, type BookColumn } from "./content/strand";

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
      "I'm a product-focused engineer at UT Austin. I build for people, and I love leading them towards building great things.",
    url: "https://aaronsulbaran.com",
  },
  // Every inline link the copy may point at (lib/content/register.ts).
  register,
  // The inline links' own words (components/inline).
  inline: {
    // The accessible name of a link whose words are only a symbol (Connect's footnote).
    symbolLabel: "Footnote",
  },
  // The fourteen launch cards (lib/content/cards.ts). C3 moves the Coil and the
  // book onto them; until then the legacy strand and rows below drive both.
  cards,
  // The soundtrack band under the book (components/soundtrack): the one place
  // the music is offered and controlled, with the waveform running through
  // it. Each note describes what is on screen when it shows (docs/content/
  // connect-footer-band.md, approved 2026-10-08).
  listen: {
    ariaLabel: "Soundtrack",
    line: "Want some music while you scroll?",
    body: "Yeah, I put [music](tip:music-note) on my website. It moves with you.",
    accept: "Play it",
    decline: "Not now",
    acceptedNote: "Enjoy! Control it from the [evolving isle](tip:evolving-isle).",
    // Phones have no pill, so there is no isle to point at.
    acceptedNotePhone: "Enjoy!",
    declinedNote: "No problem, it's here if you change your mind.",
    pausedNote: "Paused. Resume whenever you like.",
    pause: "Pause",
    resume: "Resume",
    freeze: "Freeze the wave",
    unfreeze: "Let the wave move",
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
    // One name for the note; aria-pressed says whether it plays.
    listenAriaLabel: "Play my soundtrack",
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
    // The card modal's gallery (components/card): the pager on a phone and the photos
    // that take turns, the gallery lab's words (2026-10-09).
    gallery: {
      pagerLabel: (count: number) => `Photos and their stories, ${count}`,
      pageLabel: (page: number, count: number) => `${page} of ${count}`,
      previousPage: "Previous page",
      nextPage: "Next page",
      pageNumber: (page: number, count: number) => `Page ${page} of ${count}`,
      rotatorLabel: (count: number) => `Photos taking turns, ${count}`,
      photoOf: (photo: number, count: number) => `Photo ${photo} of ${count}`,
      announce: (photo: number, count: number, caption: string) => `Photo ${photo} of ${count}${caption ? `: ${caption}` : ""}`,
      pausePhotos: "Pause the photos",
      playPhotos: "Play the photos",
      groupStep: (photo: number, count: number) => `Photo ${photo} of ${count}. Show the next photo`,
      // aria-roledescription: a group of photos taking turns, and one page of the pager.
      roleCarousel: "carousel",
      roleSlide: "slide",
    },
  },
  // The Coil hero. The heading is the server-rendered h1; greeting and name
  // are the two parts the scene draws, together, in the canvas.
  hero: {
    heading: "Hi, I'm Aaron.",
    greeting: "Hi, I'm",
    name: "Aaron",
    coilControl: "Coil",
    // The Coil and Band toggle: the group's name and its two halves
    // (approved copy; words and no glyphs per Aaron's pick).
    shapeToggle: { ariaLabel: "Hero layout", coil: "Coil", band: "Band" },
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
    // The still page's notice (no scene can run): why the page is still, by
    // cause, and its dismiss. Approved copy.
    still: {
      noWebgl: "I can see your browser has graphics acceleration off, so you'll miss the best part of this page.",
      unavailable: "Your browser couldn't start the moving scene, so you'll miss the best part of this page.",
      reducedMotion: "Your system asks for less motion, so you're seeing the still version of this page.",
      dismiss: "Got it",
    },
  },
  // The Coil's loader: the name it fills while the page loads (the same word
  // the scene draws, so the exit hands one to the other) and the progress
  // bar's accessible name. The number itself carries no status word.
  loader: {
    name: "Aaron",
    progressLabel: "Loading the site",
  },
  // The book under the Coil hero (#work): two columns of cards, Work then People
  // (workOrder and peopleOrder through bookColumns), text first; a row's key is
  // its card's, so "seen" is shared with the Coil.
  book: {
    ariaLabel: "Experience and Fun",
    workHeading: "Experience",
    peopleHeading: "Fun Stuff",
    workOrder: bookWorkOrder,
    peopleOrder: bookPeopleOrder,
    seenLabel: "opened",
    externalLabel: "opens in a new tab",
  },
  // The fourteen cards in Coil order, lead card first.
  strand: {
    order: strandOrder,
  },
  notFound: {
    title: "Nothing here.",
    body: "I moved things around while building this out. The page you're looking for doesn't exist.",
    cta: "Back to home",
  },
  errorPage: {
    title: "Something went wrong.",
    body: "That one's on me, not you. Try again, and if it keeps breaking, let me know.",
    retry: "Try again",
  },
  // The #about section (docs/content/who-i-am.md, approved 2026-10-08): four
  // labeled blocks, the third with a sub-block. Parentheses and the lowercase
  // labels are how I typed them. Link markup is lib/content/links.ts.
  whoIAm: {
    label: "about me",
    heading: "about me",
    blocks: [
      {
        label: "what I do",
        body: "I'm a [product](def:product)-focused engineer. I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for. I like products that bend for the person using them, not the other way around.",
      },
      {
        label: "what I love (to work on)",
        body: "I tend to gravitate towards [leadership positions](pop:leadership-award) because I love getting a group of people with very different skillsets working towards one goal. I learned it as a drum major in high school, continued doing it in my orgs on campus, and want to do the same in my full-time work.",
      },
      {
        label: "what I love (outside of work)",
        body: "I love people ([family](pop:family) & [friends](pop:friends)) outside of work too. I strive to surround myself with people who lift each other up and help me grow every day. Most of my favorite experiences involve spending time with others!",
        sub: {
          label: "(hobbies)",
          body: "I love to travel, tinker on personal projects, and getting active. I love credit card-maxxing since it allows me to fulfill my wanderlust, recently got into [3D printing](pop:3d-printing) because it lets me work on the engineering I don't get to do in class, and love [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
        },
      },
      {
        label: "where I'm from",
        body: "I was born in Maracaibo, [Venezuela](pop:venezuela-flag), and moved to the U.S. when I was around 4. I grew up in Texas, mostly in Katy, watching my dad figure out a business as he went. I worked in it too, which is where I learned to wear a lot of hats.",
      },
    ] as readonly WhoIAmBlock[],
    smallPrint: "Fourth-year Electrical and Computer Engineering student at UT Austin (and a business minor from McCombs)",
  },
  // The numbers strip under Who I am (components/metrics): the GitHub chart
  // and its figures. The slots are for a figure of my own beside the chart
  // (docs/content/right-now-and-metrics.md); both are null since the LinkedIn
  // figure came off on 2026-10-13, and a null slot renders nothing. title is the strip's big heading and groupLabel the
  // line under it, which also names the GitHub group; title is the wording
  // Aaron suggested on 2026-10-09 ("Proof of Work or something else"), lowercase
  // to match "who I am" and "wanna chat?"; approved. groupLabel reads for both
  // views of the chart (Commits and Tokens); Aaron's wording, 2026-10-13. Only
  // the tool key and the tooltip's split name the tools; every other line says
  // tokens, agents or agentic.
  metrics: {
    title: "proof of work",
    groupLabel: "What I shipped on GitHub, and the agentic tokens behind those commits",
    statsLabel: "Contribution figures",
    streakLabel: "Current streak of contributions",
    day: "day",
    days: "days",
    since: "since",
    totalLabel: "contributions in the last 6 months",
    activeLabel: "days I shipped something",
    // The stale stamp, over the first figure: "Updated Oct 13".
    updated: "Updated",
    slots: {
      linkedin: null as MetricsSlot | null,
      fun: null as MetricsSlot | null,
    },
    chart: {
      viewGroup: "Chart view",
      flat: "Flat",
      skyline: "Skyline",
      seriesGroup: "What the chart counts",
      commits: "Commits",
      tokens: "Tokens",
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
    // The Tokens view of the same chart: total tokens (cache reads and writes
    // included, as Claude Code counts them) from Claude Code and Codex, stacked
    // with Claude from the base. Cursor is not on this toggle.
    tokens: {
      statsLabel: "Token figures",
      totalLabel: "tokens in the last 6 months",
      activeLabel: "days I built with agents",
      peakLabel: "my biggest day",
      // The toolkit band under the Tokens chart: the whole agent setup as one
      // figure, then four groups, each with its count and the tools I may name.
      toolkitLabel: "tools in my agent setup",
      toolkitGroupsLabel: "Tools in my agent setup, by group",
      groups: { written: "Skills I wrote", used: "Skills I use", plugin: "Plugins", mcp: "MCP servers" },
      // Only some of a group's tools are named; the rest are counted.
      toolkitMore: (n: number) => `+${n} more`,
      unit: "token",
      units: "tokens",
      none: "No tokens",
      levels: ["No tokens", "Light", "Moderate", "Heavy", "Heaviest"],
      // The tooltip's names for each tool's share, and the legend's key.
      claude: "Claude",
      codex: "Codex",
      keyLabel: "Agents",
      keyClaude: "Claude Code",
      keyCodex: "Codex",
      tip: (total: string, day: string, parts: string) => `${total} tokens on ${day}${parts ? `: ${parts}` : ""}`,
      label: (total: string, from: string, to: string, skyline: boolean) =>
        `${total} agentic tokens from ${from} to ${to}, stacked by agent, shown as a ${skyline ? "3D skyline" : "heat map"}. Use the arrow keys to read individual days.`,
    },
  },
  // Connect (docs/content/connect-footer-band.md, approved 2026-10-08): the
  // body carries the calendar link, the matcha pop and the killer-drones
  // footnote; "Book some time" is the one big link; handle is what a link shows
  // beside its name; icon is the brand mark the row draws in place of the name, which stays
  // in the row for assistive tech.
  connect: {
    label: "Connect",
    heading: "wanna chat?",
    body: "I check everything (or Talos does) so take your pick. If you want to talk screen to screen, [grab a time on my calendar](https://cal.com/aaron-sulbaran). If you're in my city, let's grab a coffee ([or matcha](pop:matcha)). I take coffee chats with anyone, no matter what you're building[*](tip:killer-drones).",
    primary: { label: "Book some time", href: "https://cal.com/aaron-sulbaran" },
    links: [
      { key: "linkedin", icon: "linkedin" as const, label: "LinkedIn", handle: "in/aaron-sulbaran", href: "https://www.linkedin.com/in/aaron-sulbaran/" },
      { key: "github", icon: "github" as const, label: "GitHub", handle: "aaron-sulbaran", href: "https://github.com/aaron-sulbaran" },
      { key: "email", icon: "mail" as const, label: "Email", handle: "aarondsulbaran@gmail.com", href: "mailto:aarondsulbaran@gmail.com" },
      { key: "instagram", icon: "instagram" as const, label: "Instagram", handle: "aaron.sulbaran", href: "https://www.instagram.com/aaron.sulbaran/" },
      { key: "x", icon: "x" as const, label: "X", handle: "@imaaronsulbaran", href: "https://x.com/imaaronsulbaran" },
    ],
  },
  // Holding page (components/Holding.tsx), served at / only when
  // NEXT_PUBLIC_SITE_MODE=holding opts in (see lib/holding.ts); the full site is the default.
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
    // The giant wordmark (docs/content/connect-footer-band.md) and the name
    // of the button over its period (the footer lab's egg). The month comes
    // from the build (lib/buildDate.ts).
    wordmark: "build.stuff",
    dropPeriod: "Drop the period",
    tagline: (month: string) => `Last updated ${month}`,
    copyright: "© 2026 Aaron Sulbaran",
  },
  soundtrack: {
    invite: "Play the soundtrack",
    coverAlt: "Cover art for",
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
    // The panel chip's one name; aria-pressed says whether I'm opted in.
    menuAriaLabel: "Soundtrack",
    ariaOpen: "Open soundtrack player",
    ariaCollapse: "Collapse player",
    ariaSeek: "Seek track position",
    ariaPrevious: "Previous track",
    ariaPlay: "Play",
    ariaPause: "Pause",
    ariaNext: "Next track",
    ariaVolume: "Volume",
    // The band's lower-right line (public/audio/CREDITS.md has each track's
    // credit; the player card shows the title, artist and Spotify link).
    creditLine: "Songs I like, as instrumentals, credited to their artists in the player.",
    tracks: liveTracks,
  },
  // The holding page's deck (components/HoldingDeck.tsx) draws these five; nothing else reads them.
  photos: [
    { src: "/photos/cards/mentorship-picture.jpg", width: 1200, height: 1600 },
    { src: "/photos/cards/band-picture.jpg", width: 1200, height: 1600 },
    { src: "/photos/cards/capital-one-1-2024.jpg", width: 1200, height: 1600 },
    { src: "/photos/cards/travel-picture.jpg", width: 1200, height: 1600 },
    { src: "/photos/uncs-grad.jpeg", width: 627, height: 836 },
  ],
  // The mark's card (components/mark/MarkCard.tsx), opened by holding the
  // top-left mark. The subtitle is lowercase as I typed it. The title and the
  // four paragraphs are mine verbatim; the inline links are in the register.
  mark: {
    dialogLabel: "The mark",
    title: "I made myself a logo",
    subtitle: "good job, you found my easter egg!",
    lines: [
      "Here's my thought process behind the logo. The A is me. The bolt (which forms the S in my last name) is a nod to a few things:",
      "My gamer tag growing up: [VoltaageArc](tip:voltaage) ([Voltage](def:voltage) + [two A's](tip:two-as) + [Arc](def:arc))",
      "[Catatumbo Lightning](pop:catatumbo-lightning), also known as \"The Everlasting Storm\", is an atmospheric phenomenon that occurs over [Lake Maracaibo](pop:lake-maracaibo) (where I was born), causing persistent lightning storms year-round. Hope you learned something new.",
      "My major: [Electrical and Computer Engineering](pop:ut-ece-logo)... this one is pretty self explanatory.",
    ],
    button: "Keep exploring!",
  },
} as const;

export type MenuItem = (typeof siteContent.menu.items)[number];
export type Track = SoundtrackTrack;
export type {
  CardContent, CardGroup, CardKey, CardLink, CardModal, CardModalKind, CardPicture, Cards, CardVisual, DefinitionEntry, ImageRef,
  InlineRegister, InspiredBy, LogoRef, Mentor, MentorsList, ModalPhoto, PhotoCrop, PhotoRef, PopEntry, SoundtrackTrack, TimelineEntry,
  TipEntry, TrackLicenseKind, WhoIAmBlock,
} from "./content/types";
export { bookRow, strandCardByKey, strandCardOf, strandCards } from "./content/strand";
export type { BookColumn, BookRowEntry, StrandCard, StrandFace } from "./content/strand";

// The book's two columns of cards (components/book/Book.tsx and the unwound list).
export const bookColumns: readonly BookColumn[] = [
  { heading: siteContent.book.workHeading, rows: siteContent.book.workOrder.map(bookRow) },
  { heading: siteContent.book.peopleHeading, rows: siteContent.book.peopleOrder.map(bookRow) },
];
export { tipText } from "./content/tracks";
