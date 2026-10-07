import { siteContent } from "@/lib/content";
import type { GithubSeries } from "./series";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const number = new Intl.NumberFormat("en-US");

export const shortDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return monthDay.format(Date.UTC(y, m - 1, d));
};
export const formatCount = (n: number) => number.format(n);

export type Stat = { key: string; value: string; unit?: string; label: string; sub?: string };

// The current streak leads (it is the figure that describes now); the longest
// streak stays in the data and is never shown.
export function seriesStats(s: GithubSeries): Stat[] {
  const c = siteContent.metrics;
  const stats: Stat[] = [
    {
      key: "streak",
      value: formatCount(s.streak.days),
      unit: s.streak.days === 1 ? c.day : c.days,
      label: c.streakLabel,
      sub: s.streak.start ? `${c.since} ${shortDate(s.streak.start)}` : undefined,
    },
    { key: "total", value: formatCount(s.total), label: c.totalLabel },
    { key: "active", value: formatCount(s.activeDays), label: c.activeLabel },
  ];
  for (const [key, slot] of Object.entries(c.slots)) if (slot) stats.push({ key, ...slot });
  return stats;
}
