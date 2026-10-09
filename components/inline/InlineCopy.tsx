import { createElement, Fragment, type ReactNode } from "react";
import { inlineRuns, type InlineRun } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { glueRuns } from "@/lib/inline/glue";

function emphasize(run: InlineRun, node: ReactNode): ReactNode {
  return run.strong ? <strong>{run.em ? <em>{node}</em> : node}</strong> : run.em ? <em>{node}</em> : node;
}

// One copy string as React. A Server Component that renders only text,
// emphasis and native buttons and anchors marked with data-inline; the
// behaviour is one delegated layer (components/inline/InlineLayer), because a
// lines-split Block rebuilds its children (SplitText's revert restores
// innerHTML) and would drop any handler attached here. A key the register
// lacks arrives as plain words from the parser; this never throws.
export function InlineCopy({ source }: { source: string }) {
  const render = (run: InlineRun, index: number) => {
    const link = inlineLinkElement(run);
    return <Fragment key={index}>{emphasize(run, link ? createElement(link.tag, link.props, run.text) : run.text)}</Fragment>;
  };
  return (
    <>
      {glueRuns(inlineRuns(source, registerHas)).map((item, index) =>
        item.glue ? (
          <span key={index} className="inline-glue">
            {item.runs.map(render)}
          </span>
        ) : (
          render(item.run, index)
        ),
      )}
    </>
  );
}
