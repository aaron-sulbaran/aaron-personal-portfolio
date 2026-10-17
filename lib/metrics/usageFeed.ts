import "server-only";
import publicList from "./toolkit-public.json";
import type { UsageSeries } from "./series";
import { loadUsage, usageSeries } from "./usage";
import { usageExportSchema, type UsageExport } from "./usageSchema";

// The daily token feed: scripts/usage-snapshot.mjs --export writes one public
// safe JSON file into the private vault, and this reads it back over the
// GitHub API with a
// fine-grained read-only token. The repo comes from VAULT_REPO and is never
// named in code. A push shows within the hour (the fetch revalidates every
// 3600 seconds). Anything that goes wrong, an unset variable included, serves
// the last good feed this instance saw, else the committed snapshot
// (lib/metrics/usage.ts); it never throws and never renders blank.

export const USAGE_FEED_PATH = "wiki/metrics/usage-export.json";
const REVALIDATE_SECONDS = 3600;
const TIMEOUT_MS = 8000;
// The daily job lands well inside this; past it the strip says when it was last updated.
const STALE_AFTER_MS = 36 * 3_600_000;
const REPO_SHAPE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type Result<T> = { data: T; error: null } | { data: null; error: string };

const explain = (status: number) =>
  status === 401
    ? "GitHub rejected VAULT_READ_TOKEN (expired, revoked, or mistyped)."
    : status === 404
      ? "VAULT_READ_TOKEN cannot see the usage feed (repo or file missing, or no Contents access)."
      : status === 403
        ? "GitHub refused the request (rate limit or missing Contents permission)."
        : `GitHub contents API answered ${status} for the usage feed.`;

export async function fetchUsageFeed(repo: string, token: string, fetchImpl: typeof fetch = fetch): Promise<Result<UsageExport>> {
  if (!REPO_SHAPE.test(repo)) return { data: null, error: "VAULT_REPO is not owner/name." };
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/contents/${USAGE_FEED_PATH}?ref=main`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, error: explain(res.status) };
    const parsed = usageExportSchema.safeParse(await res.json());
    if (!parsed.success) return { data: null, error: "The usage feed did not have the expected shape." };
    return { data: parsed.data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return { data: null, error: `GitHub did not answer within ${TIMEOUT_MS / 1000} seconds.` };
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// The day the feed was made, in the tz it was made in.
function dayIn(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// Names the public list does not carry are dropped again here, so a feed
// written by anything but the script still cannot name a private tool.
const listed = new Set(publicList.map((entry) => `${entry.group}\0${entry.name}`));

export function feedSeries(feed: UsageExport, now: Date): UsageSeries {
  const updatedAt = dayIn(feed.generatedAt, feed.tz);
  const lastData = feed.days.at(-1)?.d ?? updatedAt;
  const stale = now.getTime() - new Date(feed.generatedAt).getTime() > STALE_AFTER_MS;
  const toolkit = { ...feed.toolkit, named: feed.toolkit.named.filter((tool) => listed.has(`${tool.group}\0${tool.name}`)) };
  return usageSeries(feed.days, toolkit, lastData > updatedAt ? lastData : updatedAt, { stale, updatedAt });
}

let lastGood: UsageExport | null = null;

export async function loadUsageSeries(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<UsageSeries> {
  const repo = process.env.VAULT_REPO;
  const token = process.env.VAULT_READ_TOKEN;
  if (repo && token) {
    const { data, error } = await fetchUsageFeed(repo, token, fetchImpl);
    if (data) {
      lastGood = data;
      return feedSeries(data, now);
    }
    console.error("[metrics] usage feed refresh failed:", error);
  }
  return lastGood ? feedSeries(lastGood, now) : loadUsage();
}
