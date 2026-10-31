// A paragraph as a phone shows it on a page too short for all of it: the first `level` of its phone omissions (whole sentences, verbatim,
// in the order they go; lib/content cards' phoneOmit) taken out, with the one space that joined each to its neighbour. Every other word,
// and its inline markup, is left exactly as written. Pure.
export function phoneCopy(source: string, omit: readonly string[] | undefined, level: number): string {
  let out = source;
  for (const sentence of (omit ?? []).slice(0, Math.max(0, level))) {
    const at = out.indexOf(sentence);
    if (at < 0 || !sentence) continue;
    const end = at + sentence.length;
    // The space after it, or, at the paragraph's end, the space before it.
    out = out[end] === " " ? out.slice(0, at) + out.slice(end + 1) : out[at - 1] === " " ? out.slice(0, at - 1) + out.slice(end) : out.slice(0, at) + out.slice(end);
  }
  return out;
}
