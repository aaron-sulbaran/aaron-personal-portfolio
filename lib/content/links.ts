// The copy's inline link markup: [words](def:key), [words](tip:key),
// [words](pop:key) and [words](https://...). Pure and import-free, so the
// renderer and the content tests share it. A link whose key the register lacks,
// or whose target is not https, is reported and kept as its plain words; this
// never throws.

export type InlineKind = "def" | "tip" | "pop";

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: InlineKind; text: string; key: string }
  | { kind: "external"; text: string; href: string };

export interface UnknownLink { text: string; target: string }

export interface ParsedInline { segments: InlineSegment[]; unknown: UnknownLink[] }

export type KnownKey = (kind: InlineKind, key: string) => boolean;

const LINK = /\[([^[\]]*[^[\]\s][^[\]]*)\]\(([^()\s]+)\)/g;
const KEYED = /^(def|tip|pop):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXTERNAL = /^https:\/\/\S+$/;

export function parseInlineLinks(source: string, known: KnownKey): ParsedInline {
  const segments: InlineSegment[] = [];
  const unknown: UnknownLink[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === "text") last.text += text;
    else segments.push({ kind: "text", text });
  };
  let cursor = 0;
  for (const match of source.matchAll(LINK)) {
    const [whole, text, target] = match;
    const start = match.index ?? 0;
    pushText(source.slice(cursor, start));
    cursor = start + whole.length;
    const keyed = KEYED.exec(target);
    if (keyed && known(keyed[1] as InlineKind, keyed[2])) {
      segments.push({ kind: keyed[1] as InlineKind, text, key: keyed[2] });
    } else if (!keyed && EXTERNAL.test(target)) {
      segments.push({ kind: "external", text, href: target });
    } else {
      unknown.push({ text, target });
      pushText(text);
    }
  }
  pushText(source.slice(cursor));
  return { segments, unknown };
}

// Links as their words: for labels, alts and comparisons.
export function plainText(source: string): string {
  return source.replace(LINK, "$1");
}

// The words a reader sees: links as their words, paired ** and * removed; a lone * stays.
export function visibleText(source: string): string {
  return plainText(source).replace(/\*\*(?=\S)(.+?)\*\*/g, "$1").replace(/\*(?=\S)([^*]+?)\*/g, "$1");
}
