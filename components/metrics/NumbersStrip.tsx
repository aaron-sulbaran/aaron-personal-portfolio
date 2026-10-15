import { SectionHeading, SectionSubline } from "@/components/sections/SectionTitle";
import { siteContent } from "@/lib/content";
import { Metrics, METRICS_LABEL_ID, METRICS_TITLE_ID } from "./Metrics";

// The numbers strip under Who I am: the chart (Commits or Tokens) with its
// figures, with the toolkit band under the Tokens view. It has
// its own big heading, set exactly as Who I am's is, and under it the line
// that names the chart's group, set as the line under Who I am's heading is
// but on one line from md up. The home page and the metrics lab both render this.
export function NumbersStrip() {
  const { title, groupLabel } = siteContent.metrics;
  return (
    <section id="numbers" data-wave-anchor="numbers" className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-6">
          <SectionHeading id={METRICS_TITLE_ID} words>{title}</SectionHeading>
          <SectionSubline id={METRICS_LABEL_ID} words wide>{groupLabel}</SectionSubline>
        </div>
        <Metrics />
      </div>
    </section>
  );
}
