"use client";

import { WAIST } from "./pathFace";
import type { FooterSettings } from "./settings";
import type { PathKind, TypesetFace } from "./useTypeface";
import { variationSettings } from "./webFont";

// The wordmark's letters, written once into <defs> for the three layers that
// draw them (the field's holes, the veil, the tint). A path face's glyph is
// its own def, drawn by <use> once, or twice for the waist slice: an upper
// and a lower half clipped at the middle of the x-height, which the loop
// slides apart. A typeset face draws <text> in place.

// Where the wordmark keeps each letter's elements for its loop.
export type LetterSlot = "letters" | "texts" | "outlines" | "uppers" | "lowers";
export type BindLetter = (slot: LetterSlot, i: number) => (el: SVGElement | null) => void;

type Props = {
  id: string;
  chars: readonly string[];
  s: FooterSettings;
  size: number;
  baselineY: number;
  restXs: readonly number[];
  face: TypesetFace | null;
  fontSize: number;
  pathKind: PathKind | null;
  strokes: readonly { d: string; dots: string }[]; // the procedural skeletons
  outlines: readonly string[]; // a dynamic glyph's outline at rest, "" for a static one
  slicing: boolean;
  bind: BindLetter;
};

// The clip halves reach this far past any letter, in px.
const FAR = 100000;

export const sliceClipIds = (id: string) => ({ upper: `${id}-upper`, lower: `${id}-lower` });

export function WordLetters({ id, chars, s, size, baselineY, restXs, face, fontSize, pathKind, strokes, outlines, slicing, bind }: Props) {
  const glyphId = (i: number) => `${id}-glyph-${i}`;
  const clips = sliceClipIds(id);
  const waist = -WAIST * size;
  return (
    <>
      {pathKind &&
        chars.map((c, i) => (
          <g key={`glyph-${c}-${i}`} id={glyphId(i)}>
            {outlines[i] ? (
              <path ref={bind("outlines", i)} d={outlines[i]} stroke="none" />
            ) : (
              <>
                <path d={strokes[i].d} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={s.caps} strokeLinejoin={s.join} />
                <path d={strokes[i].dots} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={s.caps === "round" ? "round" : "square"} />
              </>
            )}
          </g>
        ))}
      {slicing && (
        <>
          <clipPath id={clips.upper} clipPathUnits="userSpaceOnUse">
            <rect x={-FAR} y={-FAR} width={2 * FAR} height={FAR + waist} />
          </clipPath>
          <clipPath id={clips.lower} clipPathUnits="userSpaceOnUse">
            <rect x={-FAR} y={waist} width={2 * FAR} height={FAR} />
          </clipPath>
        </>
      )}
      <g id={`${id}-word`}>
        {chars.map((c, i) => (
          <g
            key={`${c}-${i}`}
            ref={bind("letters", i)}
            transform={`translate(${restXs[i]} ${baselineY})`}
            strokeWidth={pathKind === "procedural" ? s.weight * size : undefined}
          >
            {face ? (
              <text
                ref={bind("texts", i)}
                x={0}
                y={0}
                fontSize={fontSize}
                stroke="none"
                style={{
                  fontFamily: face.family,
                  fontWeight: face.restWeight,
                  fontVariationSettings: variationSettings(face.rest),
                  fontVariantLigatures: "none",
                  fontSynthesis: "none",
                }}
              >
                {c}
              </text>
            ) : slicing ? (
              // Whole at rest: the upper half carries no clip and the lower one
              // hides until the halves part, so no seam shows at the waist.
              <>
                <g ref={bind("uppers", i)}>
                  <use href={`#${glyphId(i)}`} />
                </g>
                <g ref={bind("lowers", i)} display="none">
                  <use href={`#${glyphId(i)}`} />
                </g>
              </>
            ) : (
              <use href={`#${glyphId(i)}`} />
            )}
          </g>
        ))}
      </g>
    </>
  );
}
