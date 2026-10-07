import { siteContent } from "@/lib/content";
import { loadSeries } from "@/lib/metrics/github";
import { MetricsChart } from "./MetricsChart";
import { MetricsStats } from "./MetricsStats";

export async function Metrics() {
  const series = await loadSeries("github", "6mo");
  return (
    <div role="group" aria-label={siteContent.metrics.groupLabel} className="grid gap-10 md:grid-cols-12">
      <div className="min-w-0 md:col-span-9">
        <MetricsChart series={series} />
      </div>
      <div className="md:col-span-3 md:pt-12">
        <MetricsStats series={series} />
      </div>
    </div>
  );
}
