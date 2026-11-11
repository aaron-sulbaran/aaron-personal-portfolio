import type { GlyphKey, ScenarioKey } from "@/lib/hive-story/glyphs";
import type { NodeKey } from "@/lib/hive-story/flow";

// /hive-story: the public, 60-second story of FH08 Hive. Draft copy, 2026-11-10,
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
      "Seven of us are building a bee swarm art exhibit, and our real thinking happens in bursts: a hundred Discord messages in an hour, then a doc comes together and gets submitted. Decisions, owners, and numbers end up scattered across chats and docs, and everyone's AI starts from zero.",
      "I wanted one place that keeps the whole team, and every teammate's AI, on the same page, without anyone changing how they work or having to maintain it.",
    ],
  },

  steps: {
    heading: "How one fact gets in",
    items: [
      { glyph: "message", title: "Someone says it.", body: "A teammate posts in Discord or edits a doc in Drive. Nobody tags anything or fills out a form." },
      { glyph: "quote", title: "AI pulls out the fact and its exact words.", body: "One model reads what's new and proposes facts, each with a quote from its source." },
      { glyph: "check", title: "Code checks the quote is really there.", body: "If the words aren't in the cited message or doc, the fact never lands." },
      { glyph: "judge", title: "A stronger model checks that it follows.", body: "It turns away jokes, guesses, and plans written up as if they were done." },
      { glyph: "link", title: "It lands with a link back.", body: "Every fact in the Hive links to the exact message or doc section it came from." },
      { glyph: "question", title: "Disagreements become questions.", body: "When two sources say different things, the Hive keeps both and asks the team instead of picking a winner." },
    ] satisfies { glyph: GlyphKey; title: string; body: string }[],
    proof: "After the first round of fixes, a hand check of 15 random facts found none wrong.",
  },

  status: {
    heading: "Running now, and next",
    now: {
      label: "Running now",
      items: [
        { title: "The hourly copy", body: "Beekeeper, a read-only bot, and a Drive reader copy new messages and doc changes into a private archive every hour. Only teammates who said yes are stored.", why: "Nobody changes how they work." },
        { title: "The nightly check", body: "Every night the archive becomes cited facts, checked the way above.", why: "Facts I can put in a report with a link next to them." },
      ],
    },
    next: {
      label: "Next",
      items: [
        { title: "The team page", body: "A private page with what's due, who owns what, the open questions, and recent decisions.", why: "One place to look before a meeting or a deadline." },
        { title: "A connector for everyone's AI", body: "Teammates' assistants search the Hive directly, and add notes from their own sessions: a benchmark, a finding, a decision, a blocker.", why: "Work done in an AI chat doesn't vanish when the chat closes." },
        { title: "The fast lane", body: "A new note is readable by every teammate's AI within seconds and checked within minutes.", why: "A sprint the night before a deadline can't wait for the nightly run." },
        { title: "Beekeeper asks the author", body: "One post per batch, mentioning only the note's author. A tap confirms, a reply corrects, and the correction wins.", why: "AI writes the note, and the person whose work it was has the final say." },
      ],
    },
  },

  scenarios: {
    heading: "Several people at once",
    intro: "The Hive rewards trying things in parallel, and people stay in charge of what's true.",
    items: [
      { key: "prototypes", title: "Three prototypes of one part", body: "Three of us try three versions of the same part at once. Each session's notes land side by side, marked unconfirmed, so the comparison is already written down when we pick one." },
      { key: "ideas", title: "Two ideas in parallel", body: "Two people chase two different ideas. Their findings stay separate, each linked to its own session, and nothing merges until a person decides." },
      { key: "sprint", title: "The night before a deadline", body: "Five people working at once see each other's results within minutes, not the next morning. Beekeeper asks each author once, and a tap is all it takes." },
    ] satisfies { key: ScenarioKey; title: string; body: string }[],
  },

  calls: {
    heading: "The calls I made",
    items: [
      { title: "Read only.", body: "Beekeeper reads and never writes back to our docs, and it only speaks in its own channel. The cost: it can point at a problem but never fix it." },
      { title: "Consent first.", body: "Only teammates who said yes are stored, and removing someone erases them on the next run." },
      { title: "A question instead of a guess.", body: "When sources disagree, the Hive asks. It's slower than picking a winner, but it's never confidently wrong about who decided what." },
      { title: "Nothing ranks anyone.", body: "A person's page holds their role and what they own. No message counts, no activity scores." },
      { title: "Schedules, not servers.", body: "Everything runs on a timer on free tiers. The trade is that facts can lag by up to a day, which is what the fast lane is for." },
      { title: "People have the final say.", body: "AI notes never post to Discord and never overwrite a fact. The author confirms or corrects." },
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
    heading: "More of what I build",
    links: [
      { label: "My site", href: "/", external: false },
      { label: "The MVP, my 30-second version", href: "/quick", external: false },
      { label: "min/Max", href: "https://getminmax.com", external: true },
      { label: "Muse Friends", href: "https://musefriends.tech", external: true },
    ],
  },
} as const;
