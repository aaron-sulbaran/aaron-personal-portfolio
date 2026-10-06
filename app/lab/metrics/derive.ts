import type { ContributionData } from "./data";

// Figures derived from the loaded data, pure, for the numbers row and copy.

export const accountMonths = (d: ContributionData) => {
  const a = new Date(d.since);
  const b = new Date(d.fetched + "T00:00:00Z");
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
};

export const sinceLabel = (d: ContributionData) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(d.since));

export const yearOf = (d: ContributionData) => d.range.from.slice(0, 4);

export const activeDays = (d: ContributionData) => d.days.filter((x) => x.count > 0).length;

export const rangeTotal = (d: ContributionData) => d.days.reduce((sum, x) => sum + x.count, 0);
