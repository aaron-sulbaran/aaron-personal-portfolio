import "server-only";
import { z } from "zod";
import type { GithubSeries, Series } from "./series";
import { snapshotSeries } from "./snapshot";
import { summarize, windowStart, type SeriesWindow } from "./window";

// The contribution calendar through GitHub's GraphQL API, with a token that
// has no repository access: private counts appear because Aaron's profile
// setting shares them, never repository names. The home route revalidates
// daily (app/page.tsx), the /recruiting pattern: a failure serves the last
// good copy this instance saw, else the committed snapshot, both stamped
// stale; it never throws and never renders blank.

const LOGIN = "aaron-sulbaran";
const QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) { contributionsCollection(from: $from, to: $to) {
    contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;

const Calendar = z.object({
  data: z.object({
    user: z
      .object({
        contributionsCollection: z.object({
          contributionCalendar: z.object({
            weeks: z.array(
              z.object({
                contributionDays: z.array(
                  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), contributionCount: z.number().int().nonnegative() }),
                ),
              }),
            ),
          }),
        }),
      })
      .nullable(),
  }),
});

export type Result<T> = { data: T; error: null } | { data: null; error: string };

const explain = (status: number) =>
  status === 401
    ? "GitHub rejected GITHUB_CONTRIB_TOKEN (expired, revoked, or mistyped)."
    : status === 403
      ? "GitHub refused the request (rate limit)."
      : `GitHub GraphQL answered ${status}.`;

export async function fetchGithubSeries(
  token: string,
  today: string,
  window: SeriesWindow = "6mo",
  fetchImpl: typeof fetch = fetch,
): Promise<Result<GithubSeries>> {
  const from = windowStart(today, window);
  try {
    const res = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { login: LOGIN, from: `${from}T00:00:00Z`, to: `${today}T23:59:59Z` } }),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { data: null, error: explain(res.status) };
    const parsed = Calendar.safeParse(await res.json());
    if (!parsed.success) return { data: null, error: "GitHub's calendar did not have the expected shape." };
    const user = parsed.data.data.user;
    if (!user) return { data: null, error: `GitHub has no user ${LOGIN}.` };
    const raw = user.contributionsCollection.contributionCalendar.weeks
      .flatMap((w) => w.contributionDays)
      .map((d) => ({ date: d.date, count: d.contributionCount }));
    return { data: { kind: "github", window, range: { from, to: today }, ...summarize(raw, from, today), stale: false }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

let lastGood: GithubSeries | null = null;

async function loadGithub(window: SeriesWindow, now: Date): Promise<GithubSeries> {
  const token = process.env.GITHUB_CONTRIB_TOKEN;
  if (!token) return snapshotSeries();
  const { data, error } = await fetchGithubSeries(token, now.toISOString().slice(0, 10), window);
  if (data) {
    lastGood = data;
    return data;
  }
  console.error("[metrics] contribution refresh failed:", error);
  return lastGood && lastGood.window === window ? { ...lastGood, stale: true } : snapshotSeries();
}

export async function loadSeries(kind: "github", window: SeriesWindow = "6mo", now = new Date()): Promise<Series> {
  switch (kind) {
    case "github":
      return loadGithub(window, now);
  }
}
