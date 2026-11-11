import { describe, expect, it } from "vitest";
import { cards, strandOrder } from "@/lib/content/cards";
import { quickYears } from "@/lib/content/quick";
import { AGENT_URLS, buildLlmsFullTxt, buildLlmsTxt } from "./llms";
import { inlineToPlain } from "./markup";

const llms = buildLlmsTxt();
const full = buildLlmsFullTxt();
// Markdown links and bold as the words a reader sees.
const readable = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*(?=\S)(.+?)\*\*/g, "$1");

describe("llms.txt", () => {
  it("opens with the name and a summary", () => {
    expect(llms.startsWith("# Aaron Sulbaran\n\n> ")).toBe(true);
  });

  it("names every card", () => {
    for (const key of strandOrder) expect(llms, key).toContain(cards[key].book.title);
  });

  it("carries the three sections", () => {
    for (const heading of ["## Pages", "## Experience", "## Contact"]) expect(llms).toContain(heading);
  });

  it("lists every link the Connect section shows", () => {
    for (const href of [
      "https://cal.com/aaron-sulbaran",
      "https://www.linkedin.com/in/aaron-sulbaran/",
      "https://github.com/aaron-sulbaran",
      "mailto:aarondsulbaran@gmail.com",
      "https://www.instagram.com/aaron.sulbaran/",
      "https://x.com/imaaronsulbaran",
    ]) expect(llms, href).toContain(href);
  });
});

describe("llms-full.txt", () => {
  it("opens with the same header", () => {
    const header = llms.split("\n## ")[0];
    expect(full.startsWith(header)).toBe(true);
  });

  it("holds every card's first block as plain words", () => {
    const text = readable(full);
    for (const key of strandOrder) {
      expect(text, key).toContain(inlineToPlain(cards[key].modal.blocks[0]));
    }
  });

  it("holds the mentors, the job tips and the year lines", () => {
    for (const person of cards.mentorship.mentors.people) expect(full).toContain(person.name);
    for (const job of cards.jobs.timeline) expect(full).toContain(job.employer);
    for (const { year, line } of quickYears) {
      expect(full).toContain(`### ${year}`);
      expect(full).toContain(line);
    }
  });
});

describe("both files", () => {
  it("leave no inline markup behind", () => {
    for (const text of [llms, full]) {
      expect(text).not.toMatch(/\]\((?:pop|def|tip):/);
      expect(text).not.toMatch(/\b(?:pop|def|tip):[a-z0-9-]+/);
    }
  });

  it("use no em dash", () => {
    for (const text of [llms, full]) expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it("name only the published aaronsulbaran.com URLs", () => {
    const allowed = new Set<string>(Object.values(AGENT_URLS));
    for (const text of [llms, full]) {
      const found = text.match(/https?:\/\/(?:[a-z0-9-]+\.)*aaronsulbaran\.com[^\s)\]>"]*/gi) ?? [];
      for (const url of found) expect(allowed.has(url) || url === "https://aaronsulbaran.com", url).toBe(true);
    }
  });
});
