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

// A run is a segment with the emphasis around it. While asterisks pair, a
// link is one opaque cell, so a link whose words are an asterisk (Connect's
// footnote, [*](tip:killer-drones)) never pairs with a marker in the text.
export type InlineRun = InlineSegment & { strong: boolean; em: boolean };
interface Cell { char: string; link: InlineSegment | null; strong: boolean; em: boolean }
const ATOM = "\uE000";
const BOLD = /\*\*(?=\S)(.+?)\*\*/g;
const ITALIC = /\*(?=\S)([^*]+?)\*/g;
const anyKey: KnownKey = () => true;
function pairMarkers(cells: Cell[], pattern: RegExp, width: number, flag: "strong" | "em"): Cell[] {
  const line = cells.map((cell) => cell.char).join("");
  const dropped = new Set<number>();
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    for (let i = 0; i < width; i++) dropped.add(start + i).add(end - 1 - i);
    for (let i = start + width; i < end - width; i++) cells[i] = flag === "strong" ? { ...cells[i], strong: true } : { ...cells[i], em: true };
  }
  return cells.filter((_, i) => !dropped.has(i));
}
export function inlineRuns(source: string, known: KnownKey): InlineRun[] {
  let cells: Cell[] = [];
  for (const segment of parseInlineLinks(source, known).segments) {
    if (segment.kind !== "text") cells.push({ char: ATOM, link: segment, strong: false, em: false });
    else for (const char of segment.text.split("")) cells.push({ char, link: null, strong: false, em: false });
  }
  cells = pairMarkers(cells, BOLD, 2, "strong");
  cells = pairMarkers(cells, ITALIC, 1, "em");
  const runs: InlineRun[] = [];
  for (const { char, link, strong, em } of cells) {
    const last = runs[runs.length - 1];
    if (link) runs.push({ ...link, strong, em });
    else if (last && last.kind === "text" && last.strong === strong && last.em === em) last.text += char;
    else runs.push({ kind: "text", text: char, strong, em });
  }
  return runs;
}
// The words a reader sees: links as their words, paired ** and * removed; a
// lone * stays, and a link's own asterisk never pairs.
export function visibleText(source: string): string {
  return inlineRuns(source, anyKey).map((run) => run.text).join("");
}
