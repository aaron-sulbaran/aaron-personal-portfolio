import { createElement, Fragment, type ReactNode } from "react";
import { inlineRuns, type InlineRun } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { inlineLinkElement } from "@/lib/inline/attrs";

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
  return (
    <>
      {inlineRuns(source, registerHas).map((run, index) => {
        const link = inlineLinkElement(run);
        return <Fragment key={index}>{emphasize(run, link ? createElement(link.tag, link.props, run.text) : run.text)}</Fragment>;
      })}
    </>
  );
}
