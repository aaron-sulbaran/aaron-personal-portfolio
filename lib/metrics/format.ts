import { siteContent } from "@/lib/content";
import type { DayValue, Series, UsageDay } from "./series";
import { DEFAULT_LABELS, type MetricsLabels } from "./labels";
import type { Toolkit } from "./usageSchema";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekdayMonthDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const number = new Intl.NumberFormat("en-US");

const utc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const shortDate = (day: string) => monthDay.format(utc(day));
export const formatCount = (n: number) => number.format(n);

// Compact counts for token figures: 950, 1.2K, 74.6M, 3.5B, 120M. One decimal
// under a hundred of a unit, none from a hundred; a trailing ".0" is dropped.
const SCALES = [
  { at: 1e9, suffix: "B" },
  { at: 1e6, suffix: "M" },
  { at: 1e3, suffix: "K" },
] as const;
export type CompactScale = { at: number; suffix: string };

// 999,600 reads 1M, not 1000K: a count within rounding of the next unit takes it.
export const compactScale = (n: number): CompactScale => SCALES.find((s) => Math.abs(n) >= s.at * 0.9995) ?? { at: 1, suffix: "" };

export const formatCompact = (n: number, scale: CompactScale = compactScale(n)): string => {
  if (scale.at === 1) return number.format(Math.round(n));
  const v = n / scale.at;
  const digits = Math.abs(v) >= 100 ? 0 : 1;
  return v.toFixed(digits).replace(/\.0$/, "") + scale.suffix;
};

// A tool's share in the tooltip: in the day total's unit ("Codex 0.1B" beside
// "3.5B"), unless it is under a tenth of that unit, then in its own ("Codex 74.6M").
const partOf = (n: number, scale: CompactScale) => (scale.at > 1 && n / scale.at < 0.1 ? formatCompact(n) : formatCompact(n, scale));

// "3.5B tokens on Monday, September 28: Claude 3.4B, Codex 0.1B". A tool with
// nothing that day is left out; a day with nothing reads "No tokens on ...".
export function tokenTip(day: UsageDay): string {
  const t = siteContent.metrics.tokens;
  const when = weekdayMonthDay.format(utc(day.date));
  if (day.count <= 0) return `${t.none} ${siteContent.metrics.chart.on} ${when}`;
  const scale = compactScale(day.count);
  const parts = [
    day.claude > 0 ? `${t.claude} ${partOf(day.claude, scale)}` : "",
    day.codex > 0 ? `${t.codex} ${partOf(day.codex, scale)}` : "",
  ].filter(Boolean);
  return t.tip(formatCompact(day.count, scale), when, parts.join(", "));
}

// The busiest day, the earliest of a tie; null when every day is empty.
export function peakDay(days: readonly DayValue[]): DayValue | null {
  let best: DayValue | null = null;
  for (const d of days) if (d.count > 0 && (!best || d.count > best.count)) best = d;
  return best;
}

export type Stat = { key: string; value: string; unit?: string; label: string; sub?: string };

// Everything in the agent setup: skills written and installed, plugins, MCP servers.
export const toolkitTotal = (t: Toolkit): number => t.customSkills + t.installedSkills + t.plugins + t.mcpServers;

// The strip's figures, worded by `labels` (the lab edits them). The current
// streak leads Commits (it is the figure that describes now); the longest
// streak stays in the data and is never shown. Tokens lead with the total,
// then the active days and the biggest day: three each. The agent setup lives
// in the toolkit band, not here.
export function seriesStats(s: Series, labels: MetricsLabels = DEFAULT_LABELS): Stat[] {
  const c = siteContent.metrics;
  if (s.kind === "usage") {
    const peak = peakDay(s.days);
    return [
      { key: "total", value: formatCompact(s.total), label: labels.tokensTotal },
      { key: "active", value: formatCount(s.activeDays), label: labels.tokensActive },
      { key: "peak", value: peak ? formatCompact(peak.count) : "0", label: labels.tokensPeak, sub: peak ? shortDate(peak.date) : undefined },
    ];
  }
  return [
    {
      key: "streak",
      value: formatCount(s.streak.days),
      unit: s.streak.days === 1 ? c.day : c.days,
      label: labels.commitsStreak,
      sub: s.streak.start ? `${c.since} ${shortDate(s.streak.start)}` : undefined,
    },
    { key: "total", value: formatCount(s.total), label: labels.commitsTotal },
    { key: "active", value: formatCount(s.activeDays), label: labels.commitsActive },
  ];
}

// "Updated Oct 13": over the first figure of a stale series.
export const staleStamp = (s: Series, labels: MetricsLabels = DEFAULT_LABELS): string | null => (s.stale ? `${labels.updated} ${shortDate(s.range.to)}` : null);

// My own figures that are not GitHub's (none today): a null slot renders nothing.
export function slotStats(): Stat[] {
  return Object.entries(siteContent.metrics.slots).flatMap(([key, slot]) => (slot ? [{ key, ...slot }] : []));
}
