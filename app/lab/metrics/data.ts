import thisYear from "./data/contributions-2026.json";
import rolling from "./data/contributions-12mo.json";
import half from "./data/contributions-6mo.json";
import type { ContributionDay, Streak } from "./skyline/maths";

// The one door the data comes through. Today it returns one of two static
// fixtures of Aaron's calendar, private contributions included (fetched once
// by data/fetch.mjs, see `fetched`): the last six months in whole weeks (the
// default), the rolling year GitHub's own graph shows, or January 1 to today. The real page swaps the body for a daily server
// fetch with a read-only token (the /recruiting pattern) and nothing
// downstream changes.

export type ContributionWindow = "6mo" | "12mo" | "year";

export type ContributionData = {
  window: ContributionWindow;
  login: string;
  fetched: string; // YYYY-MM-DD, the last real day
  range: { from: string; to: string };
  total: number;
  commits: number;
  prs: number;
  restricted: number; // private contributions, counted without repository names
  publicRepos: number;
  since: string; // account creation, ISO
  streaks: { longest: Streak; current: Streak };
  days: ContributionDay[];
};

const FIXTURES: Record<ContributionWindow, Omit<ContributionData, "window">> = { year: thisYear, "12mo": rolling, "6mo": half };

export async function loadContributions(window: ContributionWindow): Promise<ContributionData> {
  return { window, ...FIXTURES[window] };
}
