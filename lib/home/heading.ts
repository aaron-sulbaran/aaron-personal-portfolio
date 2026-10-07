// The hero heading ("Hi, I'm Aaron.") in the lockup's parts: the greeting,
// the gap before the name, the name, and what follows it (the period), all
// from lib/content.ts, so the h1 (components/home/HeroText.tsx) draws the
// greeting over the name and still reads as the whole heading.

export type HeadingCopy = { heading: string; greeting: string; name: string };
export type HeadingParts = { greeting: string; between: string; name: string; after: string };

export function headingParts({ heading, greeting, name }: HeadingCopy): HeadingParts {
  const rest = heading.startsWith(greeting) ? heading.slice(greeting.length) : null;
  const at = rest?.indexOf(name) ?? -1;
  if (rest === null || at < 0) throw new Error(`The hero heading "${heading}" is not the greeting then the name`);
  return { greeting, between: rest.slice(0, at), name, after: rest.slice(at + name.length) };
}
