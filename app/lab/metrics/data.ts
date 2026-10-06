import fixture from "./data/contributions-2026.json";
import type { ContributionDay } from "./skyline/maths";

// The one door the data comes through. Today it returns a static fixture of
// Aaron's public calendar for this calendar year (fetched once, see
// `fetched`); the real page swaps the body for a daily server fetch with a
// read-only token (the /recruiting pattern) and nothing downstream changes.

export type ContributionData = {
  login: string;
  fetched: string; // YYYY-MM-DD, the last real day
  range: { from: string; to: string };
  total: number;
  commits: number;
  prs: number;
  publicRepos: number;
  since: string; // account creation, ISO
  days: ContributionDay[];
};

export async function loadContributions(): Promise<ContributionData> {
  return fixture as ContributionData;
}
