import { siteContent } from "@/lib/content";
import { agentsCopy } from "@/lib/content/agents";
import { cards, strandOrder } from "@/lib/content/cards";
import { DEFAULT_NEXT_ID, quickEntries, quickNextVariants, quickSubtitle, quickYears } from "@/lib/content/quick";
import type { CardKey, CardLink } from "@/lib/content/types";
import { inlineToMarkdown } from "./markup";

const BASE = siteContent.meta.url;

// The pages this site publishes for agents; the only aaronsulbaran.com URLs the
// two files may name (llms.test.ts).
export const AGENT_URLS = {
  home: `${BASE}/`,
  quick: `${BASE}/quick`,
  full: `${BASE}/llms-full.txt`,
  llms: `${BASE}/llms.txt`,
  sitemap: `${BASE}/sitemap.xml`,
} as const;

const link = ({ label, href }: CardLink) => `[${label}](${href})`;

function header(): string[] {
  const next = quickNextVariants.find((variant) => variant.id === DEFAULT_NEXT_ID) ?? quickNextVariants[0];
  const outside = siteContent.intro.blocks.find((block) => block.key === "outside");
  const about = [agentsCopy.voice, outside ? inlineToMarkdown(outside.sentences.join(" ")) : ""].filter(Boolean).join(" ");
  return [
    `# ${siteContent.meta.title}`,
    "",
    `> ${siteContent.meta.description}`,
    "",
    about,
    "",
    `${agentsCopy.nextLead} ${next.full}`,
    "",
  ];
}

// The quick entries that belong to a card (the jobs card has five, Capital One three).
function quickFor(key: CardKey) {
  return quickEntries.filter((entry) => entry.id === key);
}

function experienceLines(key: CardKey): string[] {
  const { book } = cards[key];
  const entries = quickFor(key);
  const head = `- **${book.title}**: ${inlineToMarkdown(book.meta)}`;
  if (entries.length === 0) return [head];
  if (entries.length === 1) return [`${head}. ${entries[0].line}`];
  return [head, ...entries.map((entry) => `  - ${entry.title}, ${quickSubtitle(entry)}: ${entry.line}`)];
}

export function buildLlmsTxt(): string {
  const { pages, experience, contact } = agentsCopy;
  const { connect } = siteContent;
  const lines = [
    ...header(),
    `## ${pages.heading}`,
    "",
    `- [Home](${AGENT_URLS.home}): ${pages.home}`,
    `- [MVP](${AGENT_URLS.quick}): ${pages.quick}`,
    `- [Full text](${AGENT_URLS.full}): ${pages.full}`,
    "",
    `## ${experience.heading}`,
    "",
    experience.note,
    "",
    ...strandOrder.flatMap(experienceLines),
    "",
    `## ${contact.heading}`,
    "",
    `- [${contact.book}](${connect.primary.href})`,
    ...connect.links.map((entry) => `- [${entry.label}](${entry.href}): ${entry.handle}`),
    "",
  ];
  return lines.join("\n");
}

function cardSection(key: CardKey): string[] {
  const card = cards[key];
  const { modal } = card;
  const { full } = agentsCopy;
  const out: string[] = [`## ${card.book.title}`, "", `*${inlineToMarkdown(card.book.meta)}*`, ""];
  if (modal.picture) out.push(`*${full.photoLabel} ${modal.picture.caption}*`, "");
  modal.blocks.forEach((block, index) => {
    out.push(inlineToMarkdown(block), "");
    for (const photo of modal.photos) {
      if (photo.block === index) out.push(`*${full.photoLabel} ${photo.caption}*`, "");
    }
    if (modal.video?.beside === index) {
      out.push(`*${full.videoLabel} ${modal.video.label}${modal.video.caption ? ` ${modal.video.caption}` : ""}*`, "");
    }
    if (modal.embed?.beside === index) out.push(`${full.postLabel} [${modal.embed.cta}](${modal.embed.href})`, "");
    const extra = modal.paragraphLinks?.[index];
    if (extra) out.push(...extra.map((entry) => `- ${link(entry)}`), "");
  });
  if (key === "mentorship" && "mentors" in card) {
    out.push(`### ${card.mentors.title}`, "");
    for (const person of card.mentors.people) {
      out.push(`- [${person.name}](${person.href})${person.line ? `: ${inlineToMarkdown(person.line)}` : ""}`);
    }
    out.push("");
  }
  if (key === "jobs" && "timeline" in card) {
    out.push(`### ${full.timelineJobsHeading}`, "");
    card.timeline.forEach((job, index) => {
      const role = job.role ? `${job.role}, ` : "";
      out.push(`- **${job.employer}**, ${role}${job.when}. ${inlineToMarkdown(job.tip)}`);
      for (const photo of modal.photos) {
        if (photo.timeline === index) out.push(`  - *${full.photoLabel} ${photo.caption}*`);
      }
    });
    out.push("");
  }
  if (key === "talos" && "team" in card) {
    out.push(inlineToMarkdown(card.team.next), "", inlineToMarkdown(card.team.reactions), "");
  }
  if (modal.links.length > 0) out.push(...modal.links.map((entry) => `- ${link(entry)}`), "");
  if (modal.easterEgg) out.push(modal.easterEgg.line, "");
  return out;
}

function timelineSection(): string[] {
  const { full } = agentsCopy;
  const out = [`## ${full.timelineHeading}`, "", full.timelineNote, ""];
  for (const { year, line } of [...quickYears].reverse()) {
    out.push(`### ${year}`, "", line, "");
    for (const entry of quickEntries.filter((candidate) => candidate.start.slice(0, 4) === year)) {
      out.push(`- **${entry.title}**, ${quickSubtitle(entry)}: ${entry.line}`);
    }
    out.push("");
  }
  return out;
}

export function buildLlmsFullTxt(): string {
  return [...header(), ...strandOrder.flatMap(cardSection), ...timelineSection()].join("\n");
}
