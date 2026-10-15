import type { Ref } from "react";
import { siteContent } from "@/lib/content";
import { toolkitTotal } from "@/lib/metrics/format";
import { GROUP_LABEL_KEYS, type MetricsLabels } from "@/lib/metrics/labels";
import { groupToolkit, toolkitCallLabel } from "@/lib/metrics/toolkitGroups";
import type { Toolkit } from "@/lib/metrics/usageSchema";

const copy = siteContent.metrics.tokens;
const TITLE_ID = "toolkit-title";

// The Tokens view's band under the chart: the whole agent setup as one big
// figure, then four groups, each with its count and the tools I may name, the
// most used first. My most-called wear how often I call them. A group's count
// is the whole setup's, so it can pass the names listed; the rest are "+N more".
export function ToolkitBand({ toolkit, labels, ref }: { toolkit: Toolkit; labels: MetricsLabels; ref?: Ref<HTMLElement> }) {
  const groups = groupToolkit(toolkit);
  return (
    <section ref={ref} data-toolkit-band="" aria-labelledby={TITLE_ID} className="grid gap-8 border-t border-border pt-8 md:col-span-12 md:grid-cols-12 md:gap-x-6">
      <h3 id={TITLE_ID} className="flex min-w-0 flex-col-reverse gap-1.5 md:col-span-3">
        <span className="font-label text-label-sm text-muted">{labels.toolkitTitle}</span>
        <span data-toolkit-total="" className="font-display text-display-sm tabular-nums text-foreground">
          {toolkitTotal(toolkit)}
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:col-span-9 md:grid-cols-4">
        {groups.map(({ group, count, names }) => {
          const more = count - names.length;
          const headingId = `toolkit-group-${group}`;
          return (
            <section key={group} data-toolkit-group={group} aria-labelledby={headingId} className="min-w-0">
              <h4 id={headingId} className="flex flex-col-reverse gap-1">
                <span className="font-label text-label-sm text-muted">{labels[GROUP_LABEL_KEYS[group]]}</span>
                <span data-toolkit-count="" className="font-display text-section tabular-nums text-foreground">
                  {count}
                </span>
              </h4>
              <ul className="mt-4 flex flex-col gap-1.5 font-label text-label-sm text-foreground">
                {names.map((tool) => (
                  <li key={tool.name} data-toolkit-name={tool.name} className="[overflow-wrap:anywhere]">
                    {tool.label}
                    {tool.marked && <span className="ml-1.5 text-muted">{toolkitCallLabel(tool.calls)}</span>}
                  </li>
                ))}
                {more > 0 && <li className="text-muted">{copy.toolkitMore(more)}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
