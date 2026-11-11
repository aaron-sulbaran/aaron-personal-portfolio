import type { ScenarioKey } from "@/lib/hive-story/glyphs";
import type { NodeKey } from "@/lib/hive-story/flow";

// /hive-visual: the public, 60-second story of FH08 Hive. Draft copy, 2026-11-10,
// written from Aaron's own words in the Hive's design and decision records,
// for his edit. Public on purpose: no teammates, no messages or quotes, no
// company names, and nothing a reader could take for team data.

export const hiveStoryCopy = {
  title: "FH08 Hive",
  description: "A shared memory I built for my senior design team: our Discord and Drive, turned every night into facts that each link to where they were said.",
  lede: "I built a shared memory for my senior design team. It reads our Discord and Drive every hour, and every night turns them into facts that link to the exact message or doc they came from.",
  framing: "This page is a visualization. The real Hive is private and built for my team of seven.",

  flow: {
    label: "How information moves through the Hive",
    // The diagram, said in words for screen readers.
    description:
      "Every hour, new Discord messages and Drive changes are copied into an archive. Every night, a fact check turns the archive into cited facts in the Hive, and disagreements become open questions. Next: notes from teammates' AI sessions take a fast lane into the Hive within minutes, and the Hive feeds the team page, each teammate's AI, and Beekeeper, which asks the author to confirm.",
    rest: "Copied every hour, checked every night, and next, shared within minutes.",
    captions: [
      "Every hour, Beekeeper copies new Discord messages and Drive changes.",
      "Every night, facts are pulled out and checked against their sources. Disagreements become open questions.",
      "Next: in a sprint, notes from teammates' AI sessions land in minutes.",
      "Every teammate's AI can read them right away.",
      "Beekeeper asks the author. A tap confirms, a reply corrects.",
    ],
    legend: { now: "running now", next: "next" },
    nodes: {
      discord: { label: "Discord", sub: "messages", subShort: "messages" },
      drive: { label: "Drive", sub: "docs and comments", subShort: "docs" },
      notes: { label: "AI sessions", sub: "notes, next", subShort: "next" },
      archive: { label: "Archive", sub: "copied every hour", subShort: "every hour" },
      check: { label: "Fact check", sub: "every night", subShort: "every night" },
      page: { label: "Team page", sub: "next", subShort: "next" },
      ai: { label: "Your AI", sub: "connector, next", subShort: "next" },
      bee: { label: "Beekeeper", sub: "tap to confirm, next", subShort: "next" },
    } satisfies Record<NodeKey, { label: string; sub: string; subShort: string }>,
    hive: { label: "The Hive", sub: "every fact cited", subShort: "cited facts" },
    question: "open question",
    lane: { wide: "fast lane, minutes", tall: "fast lane" },
  },

  why: {
    heading: "Why I built it",
    body: [
      "Seven of us build one exhibit, and our decisions end up scattered across chats and docs.",
      "I wanted one shared memory that keeps everyone, and everyone's AI, on the same page with no extra work.",
    ],
    // The aside: what the exhibit itself is, as an illustration.
    exhibit: {
      tag: "Aside: the exhibit itself",
      body: "Our senior design project is a bee swarm art exhibit: the bees find a person, settle into their outline, and move with them.",
      note: "An illustration, not the real exhibit.",
      steps: ["The bees wander.", "Someone walks up.", "The bees settle into their outline.", "They wave, and the bees move with them."],
      description: "An illustration of the exhibit: wandering bees settle into the outline of a person, and when the person waves, the bees on the arm move with them.",
    },
  },

  steps: {
    heading: "How one fact gets in",
    items: [
      { title: "Someone says it." },
      { title: "AI pulls out the fact and its exact words." },
      { title: "Code checks the words are really there." },
      { title: "A stronger model checks it follows." },
      { title: "It lands with a link back." },
      { title: "Disagreements become questions." },
    ],
    proof: "After the first fixes, a hand check of 15 random facts found none wrong.",
    // The trip drawing's own words, and its description for screen readers.
    trip: {
      labels: { discord: "Discord", drive: "Drive", hive: "The Hive", question: "open question" },
      description: "One fact's trip: a Discord message, its quoted words, a code check and a stronger check, the fact landing in the Hive with a thread back to the message, then a Drive doc that disagrees and an open question linking both.",
    },
  },

  team: {
    heading: "What my team sees",
    body: "A private page in the same bees: honey cells are due, capped cells are decided, dashed cells wait on their author.",
    note: "Shown with a made-up team and made-up facts. The real page stays private.",
    shots: {
      desktop: { src: "/hive-story/team-page-desktop.jpg", width: 2880, height: 1580, alt: "The team page's This week view on a laptop: a dark page with a honeycomb calendar, honey cells on the days something is due, and three open questions beside the week." },
      phone: { src: "/hive-story/team-page-phone.jpg", width: 780, height: 1688, alt: "The same view on a phone, with the week's comb above the open questions and a Copy for your AI button." },
    },
  },

  status: {
    heading: "Running now, and next",
    now: {
      label: "Running now",
      items: [
        { title: "The hourly copy", body: "Discord and Drive, from teammates who said yes." },
        { title: "The nightly check", body: "Cited facts I can put in a report." },
      ],
    },
    next: {
      label: "Next",
      items: [
        { title: "The team page", body: "What's due, who owns it, what's open." },
        { title: "A connector for everyone's AI", body: "Search the Hive, add notes from a session." },
        { title: "The fast lane", body: "Notes checked in minutes, not overnight." },
        { title: "Beekeeper asks the author", body: "A tap confirms, a reply corrects." },
      ],
    },
  },

  scenarios: {
    heading: "Several people at once",
    intro: "Trying things in parallel pays off, and people still decide what's true.",
    items: [
      { key: "prototypes", title: "Three prototypes of one part", body: "Each session's notes land side by side, unconfirmed, ready to compare." },
      { key: "ideas", title: "Two ideas in parallel", body: "Findings stay apart until a person decides." },
      { key: "sprint", title: "The night before a deadline", body: "Five people see each other's results in minutes." },
    ] satisfies { key: ScenarioKey; title: string; body: string }[],
  },

  calls: {
    heading: "The calls I made",
    // The demo: a teammate's AI uses the Hive's own tool, then Beekeeper asks the author.
    loop: {
      label: "From a teammate's AI to the author's tap",
      ai: {
        title: "Any AI assistant",
        ask: "Save this benchmark to the Hive.",
        tool: "hive_add_note",
        args: "kind: finding",
        result: "Saved. Just in, not yet checked.",
      },
      discord: {
        channel: "beekeeper",
        name: "Beekeeper",
        app: "APP",
        time: "9:06 PM",
        lead: "1 fact landed from",
        author: "Ada",
        tail: "'s AI session",
        source: "AI session note",
        badges: { unconfirmed: "AI session, unconfirmed", confirmed: "Confirmed by Ada", corrected: "Corrected by Ada" },
        reply: "replied",
      },
      reacts: { pending: "Waiting on the author", confirmed: "Confirmed", corrected: "Corrected" },
      steps: [
        "A teammate's AI saves a note with the Hive's own tool.",
        "Beekeeper posts once, tagging only the author.",
        "A react is already waiting.",
        "A tap confirms.",
        "Or a reply corrects, and the correction wins.",
      ],
      note: "A mock-up with a made-up teammate and made-up messages. Only Beekeeper's avatar is real.",
      description: "A demo: an AI assistant calls hive_add_note to save a finding; within minutes Beekeeper posts once in #beekeeper, mentioning only the author, with a pending react already placed; the author's tap turns it to confirmed, or the author's reply corrects the fact.",
    },
    toolsLabel: "Built for the Hive",
    tools: {
      connector: {
        label: "The connector, for any AI assistant",
        items: [
          { name: "hive_now", body: "What's due, who owns it, what just landed" },
          { name: "hive_search", body: "Facts, each with its source" },
          { name: "hive_page", body: "A person, a doc, a requirement" },
          { name: "hive_questions", body: "Open questions, both sides" },
          { name: "hive_add_note", body: "A note from your session" },
          { name: "hive_sync", body: "Pull Discord now" },
        ],
      },
      beekeeper: {
        label: "Beekeeper, only in #beekeeper",
        items: [
          { name: "/ask", body: "Answers with sources" },
          { name: "One post per batch", body: "Tags only the author" },
          { name: "Its own reacts", body: "Waiting, confirmed, corrected" },
        ],
      },
    },
    items: [
      { title: "Read only.", body: "It points at problems, never edits." },
      { title: "Consent first.", body: "Only teammates who said yes." },
      { title: "Ask, don't guess.", body: "Disagreements become questions." },
      { title: "No rankings.", body: "Roles and owned items only." },
      { title: "Schedules, not servers.", body: "$0, nothing to keep alive." },
      { title: "People decide.", body: "AI notes wait for their author." },
    ],
  },

  numbers: {
    heading: "At last count",
    items: [
      { value: "675", label: "Discord messages read" },
      { value: "24", label: "Drive files read" },
      { value: "339", label: "automated tests" },
      { value: "$0", label: "to run each month" },
    ],
  },

  more: {
    heading: "The rest of my portfolio",
    // The home's own sections, named as the Menu names them, then the other products.
    site: [
      { label: "About me", href: "/#about" },
      { label: "Work", href: "/#work" },
      { label: "Proof of work", href: "/#numbers" },
      { label: "Connect", href: "/#connect" },
      { label: "my 30-second M(inimum) V(iable) P(ortfolio)", href: "/quick" },
    ],
    productsLabel: "Other things I've built",
    products: [
      { label: "min/Max", href: "https://getminmax.com" },
      { label: "Muse Friends", href: "https://musefriends.tech" },
    ],
  },
  // Under the hero, so the way back to the portfolio is on the first screen too.
  backLink: { label: "See the rest of my portfolio", href: "/" },
  // Every animation on the page can be stepped by hand.
  controls: { group: "step through", back: "Back", next: "Next", pause: "Pause", play: "Play", count: (n: number, total: number) => `Step ${n} of ${total}` },
} as const;
