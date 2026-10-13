import { loadSeries } from "@/lib/metrics/github";
import { SKYLINE } from "@/lib/metrics/settings";
import { MetricsBoard } from "./MetricsBoard";
import { MetricsSlots } from "./MetricsStats";

// The ids of the strip's big heading and of the line under it (both in
// app/page.tsx), which together name the GitHub group.
export const METRICS_TITLE_ID = "metrics-title";
export const METRICS_LABEL_ID = "metrics-label";

// The GitHub group is the chart and its figures, named by the strip's heading
// and the line under it. My own figures sit beside it, under the figures
// column, outside the group.
export async function Metrics() {
  const [github, usage] = await Promise.all([loadSeries("github", SKYLINE.window), loadSeries("usage", SKYLINE.window)]);
  if (github.kind !== "github" || usage.kind !== "usage") throw new Error("The metrics loaders returned the wrong series.");
  return (
    <div data-wave-words className="grid gap-10 md:grid-cols-12">
      <MetricsBoard github={github} usage={usage} />
      <div className="md:col-span-3 md:col-start-10">
        <MetricsSlots />
      </div>
    </div>
  );
}
