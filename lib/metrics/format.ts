import { siteContent } from "@/lib/content";
import type { DayValue, Series, UsageDay, UsageSeries } from "./series";
import { TOKENS, type FourthFigure } from "./settings";
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

// The token figures' last one (TOKENS.fourth): the skills I wrote, the whole
// agent setup with its split under it, or the lab's old current streak.
function fourthStat(s: UsageSeries, fourth: FourthFigure): Stat {
  const c = siteContent.metrics;
  const t = c.tokens;
  const kit = s.toolkit;
  if (fourth === "skills") return { key: "skills", value: formatCount(kit.customSkills), label: t.skillsLabel };
  if (fourth === "toolkit") {
    const sub = t.toolkitSub(formatCount(kit.customSkills), formatCount(kit.installedSkills), formatCount(kit.plugins), formatCount(kit.mcpServers));
    return { key: "toolkit", value: formatCount(toolkitTotal(kit)), label: t.toolkitLabel, sub };
  }
  return {
    key: "streak",
    value: formatCount(s.streak.days),
    unit: s.streak.days === 1 ? c.day : c.days,
    label: t.streakLabel,
    sub: s.streak.start ? `${c.since} ${shortDate(s.streak.start)}` : undefined,
  };
}

// The GitHub figures. The current streak leads (it is the figure that describes
// now); the longest streak stays in the data and is never shown. The token
// figures lead with the total, then the active days, the biggest day and the
// fourth.
export function seriesStats(s: Series, fourth: FourthFigure = TOKENS.fourth): Stat[] {
  const c = siteContent.metrics;
  if (s.kind === "usage") {
    const t = c.tokens;
    const peak = peakDay(s.days);
    return [
      { key: "total", value: formatCompact(s.total), label: t.totalLabel },
      { key: "active", value: formatCount(s.activeDays), label: t.activeLabel },
      { key: "peak", value: peak ? formatCompact(peak.count) : "0", label: t.peakLabel, sub: peak ? shortDate(peak.date) : undefined },
      fourthStat(s, fourth),
    ];
  }
  return [
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
}

// My own figures that are not GitHub's (the LinkedIn line): a null slot renders nothing.
export function slotStats(): Stat[] {
  return Object.entries(siteContent.metrics.slots).flatMap(([key, slot]) => (slot ? [{ key, ...slot }] : []));
}
