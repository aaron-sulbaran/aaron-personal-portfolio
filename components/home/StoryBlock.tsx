import { Fragment } from "react";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { arrivalStyle } from "@/lib/home/introArrival";
import type { Side } from "@/lib/home/storyLayout";

// One of the story's paragraph blocks: two to three sentences (siteContent.intro),
// composed at first paint with no staging. Which side of the page it leans to is
// data (lib/home/storyLayout.ts), and the grid in app/globals.css places it by
// data-side; the text keeps a measure of about 60 characters. Its words are a
// wave block, so the line keeps clear of them. `blockKey` is the block's key in
// intro.blocks (data-story-block). It arrives on load at its step
// (lib/home/introArrival.ts). A Server Component: the markup is
// InlineCopy's, the behaviour one delegated layer.
export function StoryBlock({ blockKey, domId, sentences, side, arrivalStep }: { blockKey: string; domId: string; sentences: readonly string[]; side: Side; arrivalStep: number }) {
  return (
    <div id={domId} data-story-block={blockKey} data-block="" data-side={side} data-arrive="block" style={arrivalStyle(arrivalStep)}>
      <p data-block-text="" data-wave-words="" className="text-pretty text-lg leading-[1.6] text-foreground sm:text-xl md:text-[22px] md:leading-[1.55]">
        {sentences.map((sentence, i) => (
          <Fragment key={sentence}>
            {i > 0 && " "}
            <InlineCopy source={sentence} />
          </Fragment>
        ))}
      </p>
    </div>
  );
}
