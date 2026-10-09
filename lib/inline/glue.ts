import type { InlineRun } from "@/lib/content/links";

export type GlueItem = { glue: false; run: InlineRun } | { glue: true; runs: InlineRun[] };

interface Piece { run: InlineRun; space: boolean }

// Whitespace that may break a line; a non breaking space does not.
const SPACE_RUNS = /([^\S ]+)/;

function pieces(runs: InlineRun[]): Piece[] {
  return runs.flatMap((run): Piece[] => {
    if (run.kind !== "text") return [{ run, space: false }];
    return run.text
      .split(SPACE_RUNS)
      .filter(Boolean)
      .map((text) => ({ run: { ...run, text }, space: /^[^\S ]+$/.test(text) }));
  });
}

function joinText(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && last.kind === "text" && run.kind === "text" && last.strong === run.strong && last.em === run.em) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
    } else out.push(run);
  }
  return out;
}

// A link is an atomic inline, and CSS gives a soft wrap opportunity on both
// sides of one, so "product" and "-focused" could part at a line end. This
// groups each link with the non-whitespace characters touching it, so the
// renderer can keep the group on one line. Plain runs and a link standing
// between spaces come back as they were.
export function glueRuns(runs: InlineRun[]): GlueItem[] {
  const all = pieces(runs);
  const items: GlueItem[] = [];
  const plain: InlineRun[] = [];
  const flushPlain = () => {
    for (const run of joinText(plain)) items.push({ glue: false, run });
    plain.length = 0;
  };
  let index = 0;
  while (index < all.length) {
    let end = index;
    if (!all[index].space) while (end < all.length && !all[end].space) end++;
    else end = index + 1;
    const span = all.slice(index, end);
    const glued = !all[index].space && span.length > 1 && span.some((piece) => piece.run.kind !== "text");
    if (glued) {
      flushPlain();
      items.push({ glue: true, runs: joinText(span.map((piece) => piece.run)) });
    } else plain.push(...span.map((piece) => piece.run));
    index = end;
  }
  flushPlain();
  return items;
}
