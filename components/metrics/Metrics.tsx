import { loadSeries } from "@/lib/metrics/github";
import { SKYLINE } from "@/lib/metrics/settings";
import { MetricsChart } from "./MetricsChart";
import { MetricsSlots, MetricsStats } from "./MetricsStats";

// The id of the strip's visible label (a Kicker in app/page.tsx), which names
// the GitHub group.
export const METRICS_LABEL_ID = "metrics-label";

// The GitHub group is the chart and its figures, named by the strip's label.
// My own figures sit beside it, under the figures column, outside the group.
export async function Metrics() {
  const series = await loadSeries("github", SKYLINE.window);
  return (
    <div className="grid gap-10 md:grid-cols-12">
      <div role="group" aria-labelledby={METRICS_LABEL_ID} className="grid gap-10 md:col-span-12 md:grid-cols-12">
        <div className="min-w-0 md:col-span-9">
          <MetricsChart series={series} />
        </div>
        <div className="md:col-span-3 md:pt-12">
          <MetricsStats series={series} />
        </div>
      </div>
      <div className="md:col-span-3 md:col-start-10">
        <MetricsSlots />
      </div>
    </div>
  );
}
