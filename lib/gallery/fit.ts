// Which paragraphs of a phone's pager do not fit under their stage: the pure half of the pager's split (components/card/CardPager measures
// the numbers, lib/gallery/plan splitWords moves the words). A stage and its words share a page when the stage, the gap and the words'
// own height fit the room the pages have; otherwise the words get a page of their own, and nothing scrolls inside a page.

export interface UnitFit {
  photo: number; // the page's photo, which names the unit
  stage: number; // px, the stage's height (a name tag or the post card is as tall as its content)
  words: number; // px, the words' own height with the room under them
}

export function wordsToSplit(units: readonly UnitFit[], roomPx: number, gapPx: number): number[] {
  return units.filter(({ stage, words }) => stage + gapPx + words > roomPx + 1).map(({ photo }) => photo);
}
