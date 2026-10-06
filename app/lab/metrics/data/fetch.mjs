#!/usr/bin/env node
// Refetches Aaron's contribution calendar through the logged-in GitHub CLI
// and rewrites the lab fixtures. Run from the lab worktree:
//   node app/lab/metrics/data/fetch.mjs
// Writes contributions-2026.json (January 1 to today, what the lab reads) and
// contributions-12mo.json (the rolling year GitHub's own graph shows).
// Private contributions appear only while the profile setting
// "Contribution settings > Private contributions" is on; GitHub applies that
// setting to the API as well as to logged-out visitors.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LOGIN = "aaron-sulbaran";

const QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const isoDay = (d) => d.toISOString().slice(0, 10);

function fetchRange(from, to) {
  const out = execFileSync(
    "gh",
    ["api", "graphql", "-f", `query=${QUERY}`, "-f", `login=${LOGIN}`, "-f", `from=${from}T00:00:00Z`, "-f", `to=${to}T23:59:59Z`],
    { encoding: "utf8" },
  );
  const user = JSON.parse(out).data.user;
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .filter((d) => d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
  return {
    login: LOGIN,
    fetched: to,
    range: { from, to },
    total: days.reduce((sum, d) => sum + d.count, 0),
    commits: c.totalCommitContributions,
    prs: c.totalPullRequestContributions,
    issues: c.totalIssueContributions,
    restricted: c.restrictedContributionsCount,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    since: user.createdAt,
    streaks: streaks(days),
    days,
  };
}

// Longest run of active days, and the run that ends today or yesterday.
function streaks(days) {
  let longest = { days: 0, start: null, end: null };
  let run = { days: 0, start: null, end: null };
  for (const d of days) {
    if (d.count > 0) {
      run = run.days ? { ...run, days: run.days + 1, end: d.date } : { days: 1, start: d.date, end: d.date };
      if (run.days > longest.days) longest = { ...run };
    } else {
      run = { days: 0, start: null, end: null };
    }
  }
  const last = days[days.length - 1];
  const prior = days[days.length - 2];
  const current = run.days ? run : prior && prior.count > 0 && last.count === 0 ? trailingRun(days.slice(0, -1)) : run;
  return { longest, current };
}

function trailingRun(days) {
  let n = 0;
  let start = null;
  for (let i = days.length - 1; i >= 0 && days[i].count > 0; i--) {
    n++;
    start = days[i].date;
  }
  return { days: n, start, end: n ? days[days.length - 1].date : null };
}

const today = new Date();
const to = isoDay(today);
const yearStart = `${to.slice(0, 4)}-01-01`;
const twelveMonthsAgo = new Date(today);
twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);
twelveMonthsAgo.setUTCDate(twelveMonthsAgo.getUTCDate() + 1);

const thisYear = fetchRange(yearStart, to);
const rolling = fetchRange(isoDay(twelveMonthsAgo), to);

writeFileSync(join(here, "contributions-2026.json"), JSON.stringify(thisYear, null, 1) + "\n");
writeFileSync(join(here, "contributions-12mo.json"), JSON.stringify(rolling, null, 1) + "\n");

const active = (d) => d.days.filter((x) => x.count > 0).length;
console.log(`${yearStart} to ${to}: ${thisYear.total} contributions on ${active(thisYear)} days, restricted ${thisYear.restricted}`);
console.log(`last 12 months: ${rolling.total} contributions on ${active(rolling)} days; longest streak ${rolling.streaks.longest.days} (${rolling.streaks.longest.start} to ${rolling.streaks.longest.end}); current ${rolling.streaks.current.days}`);
