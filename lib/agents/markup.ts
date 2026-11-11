import { parseInlineLinks } from "@/lib/content/links";

// The copy's inline markup as markdown for a reader that cannot open a popup:
// def, tip and pop links become their plain words, external https links become
// markdown links, and **bold** stays. A link whose only words are a symbol (a
// footnote asterisk) is dropped, since its note is not in the text.
export function inlineToMarkdown(source: string): string {
  return parseInlineLinks(source, () => true)
    .segments.map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "external") return `[${segment.text}](${segment.href})`;
      return segment.text.trim() === "*" ? "" : segment.text;
    })
    .join("");
}

// The same words with no markup at all: for comparisons and one-line notes.
export function inlineToPlain(source: string): string {
  return inlineToMarkdown(source)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "$1");
}
