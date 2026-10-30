// How a phone's pager pages a card's words so that nothing scrolls inside a page: the pure half (components/card/CardPager measures the
// numbers, lib/gallery/plan repage lays the pages out from the result). A page's words are blocks in order (each paragraph, then the end
// block, the mentors and the card's links); the blocks of a photo's page are laid down greedily, first beside its stage, then page by page
// with the whole room. A block that does not fit beside the stage starts a page of its own, and a run of blocks that is too tall for one
// page goes on to the next, so every word shows, in order, on a page that holds it.

export const END = "end";

export interface BlockSize {
  id: string; // "w3" (word unit 3), or END
  height: number; // px
}

export interface UnitMeasure {
  photo: number; // the page's photo, which names the unit
  above: number; // px above the words when they share the stage's page: the stage, its caption, and the gap before the words
  blocks: readonly BlockSize[];
}

export interface Chunk {
  units: number[];
  end: boolean; // the end block (the mentors and the card's links) is on this page
}

// stage: what shares the stage's page (nothing when no block fits beside it); more: the pages of words after it.
export interface UnitShape {
  stage: Chunk;
  more: Chunk[];
}
export type Shape = Readonly<Record<number, UnitShape>>;

export interface PageRules {
  blockGap: number; // between the blocks of a page
  endPad: number; // under the last block of a page
}

const chunkOf = (blocks: readonly BlockSize[]): Chunk => ({
  units: blocks.filter((block) => block.id !== END).map((block) => Number(block.id.slice(1))),
  end: blocks.some((block) => block.id === END),
});

export const heightOf = (blocks: readonly BlockSize[], { blockGap, endPad }: PageRules) =>
  blocks.reduce((sum, block) => sum + block.height, 0) + blockGap * Math.max(0, blocks.length - 1) + endPad;

// Only the units that need it get a shape: one whose words all fit beside its stage keeps its page as it is.
export function paginate(units: readonly UnitMeasure[], room: number, rules: PageRules): Shape {
  const shape: Record<number, UnitShape> = {};
  for (const { photo, above, blocks } of units) {
    if (blocks.length === 0) continue;
    const pages: BlockSize[][] = [[]];
    let limit = room - above;
    for (const block of blocks) {
      const page = pages[pages.length - 1];
      if (heightOf([...page, block], rules) <= limit + 1) {
        page.push(block);
        continue;
      }
      // It does not fit here: the page it would have joined is done (the stage's page stays as it is, even with nothing on it), and it
      // opens the next, which has the whole room (and is its own page however tall it is).
      limit = room;
      pages.push([block]);
    }
    if (pages.length > 1) shape[photo] = { stage: chunkOf(pages[0]), more: pages.slice(1).map(chunkOf) };
  }
  return shape;
}

// A string that is the same for the same shape.
export const shapeKey = (shape: Shape): string =>
  Object.keys(shape)
    .map(Number)
    .sort((a, b) => a - b)
    .map((photo) => {
      const { stage, more } = shape[photo];
      const part = (chunk: Chunk) => `${chunk.units.join(".")}${chunk.end ? "+" : ""}`;
      return `${photo}:${part(stage)}|${more.map(part).join("|")}`;
    })
    .join(";");
