// The framing words for the agent-readable files (lib/agents): /llms.txt,
// /llms-full.txt, robots.txt, the JSON-LD and security.txt. Everything else
// those files say is read from the site's own content, never restated here.

export const agentsCopy = {
  // The sentence after the summary: whose voice the files are in.
  voice: "This is Aaron Sulbaran's personal site, written in his own voice, so \"I\" below is Aaron.",
  // Leads the line that carries the DEFAULT_NEXT_ID variant's full text.
  nextLead: "What I'm looking for next:",
  // The role the structured data names; the first sentence of the home page.
  jobTitle: "Product-focused engineer",
  // Where I study now; affiliation, not alumniOf, until I graduate.
  university: "The University of Texas at Austin",
  pages: {
    heading: "Pages",
    home: "The home page: who I am, my cards (the experience below), proof of work, and how to reach me.",
    quick: "The MVP (Minimum Viable Portfolio): one line per role, year by year, newest first.",
    full: "This site's full text in one file: every card's whole story, the people who shaped me, and the year-by-year timeline.",
  },
  experience: {
    heading: "Experience",
    note: "Each entry is one card on the home page. The full text of each is in /llms-full.txt.",
  },
  contact: {
    heading: "Contact",
    book: "Book a time on my calendar",
  },
  full: {
    timelineHeading: "Year by year",
    timelineNote: "The same story as the MVP at /quick, newest year first.",
    timelineJobsHeading: "Timeline, newest first",
    photoLabel: "Photo:",
    videoLabel: "Video:",
    postLabel: "LinkedIn post:",
  },
  robotsComment: [
    "This site welcomes people and agents.",
    "A plain-text guide to it is at https://aaronsulbaran.com/llms.txt",
  ],
  security: {
    expires: "2027-11-11T00:00:00.000Z",
    languages: "en, es",
  },
} as const;
