import { Fragment, type CSSProperties } from "react";
import { InlineCopy } from "@/components/inline/InlineCopy";
import type { DomProps } from "@/lib/home/introDom";

// One of page 1's paragraph blocks: two to three sentences (siteContent.intro),
// composed at first paint with no staging, in the story's column. A right block
// leans across the free width (app/globals.css reads data-side and --shift,
// from lib/home/storyLayout.ts); the text keeps a measure of about 60
// characters. Its words are a wave block, so the line keeps clear of them. A
// Server Component: the markup is InlineCopy's, the behaviour one delegated
// layer.
export function StoryBlock({ id, domId, sentences, dom }: { id: string; domId: string; sentences: readonly string[]; dom: DomProps }) {
  return (
    <div id={domId} data-story-item={id} data-block="" {...dom.attrs} style={dom.vars as CSSProperties} className="px-[6vw]">
      <div className="mx-auto max-w-[1240px]">
        <p data-block-text="" data-wave-words="" className="text-pretty text-lg leading-[1.6] text-foreground sm:text-xl md:text-[22px] md:leading-[1.55]">
          {sentences.map((sentence, i) => (
            <Fragment key={sentence}>
              {i > 0 && " "}
              <InlineCopy source={sentence} />
            </Fragment>
          ))}
        </p>
      </div>
    </div>
  );
}
