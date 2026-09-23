import "server-only";
import { readFile } from "node:fs/promises";
import type { RecruitingExport } from "./types";
import { FEED_TAG } from "./vault-issues";

// The feed is wiki/roles/recruiting-export.json in the private vault mirror on
// GitHub, read through the contents API with a fine-grained read-only token.
// The page is ISR (revalidate 900 in app/recruiting/page.tsx) so a healthy
// fetch happens at most every 15 minutes (Next's data cache also keeps serving
// the last good response when a background refresh fails). A failed refresh
// serves the last copy this instance saw, stamped as stale; with nothing to
// fall back on it returns null and the page renders its unavailable state
// rather than failing the build or going blank. In development without a
// token the file is read straight from the vault on disk.

const VAULT_REPO = "aaron-sulbaran/aarons-second-brain";
const EXPORT_PATH = "wiki/roles/recruiting-export.json";
const VAULT_DEV_PATH =
  "/Users/asulbaran21/Library/Mobile Documents/iCloud~md~obsidian/Documents/Aaron's Second Brain/" +
  EXPORT_PATH;

export interface RecruitingFeed {
  data: RecruitingExport;
  fetchedAt: string;
  staleSince: string | null;
  source: "github" | "vault-file";
}

let lastGood: RecruitingFeed | null = null;
let lastError: string | null = null;

// Why the last refresh failed, in words the owner can act on. The page is
// cookie-gated, so it is safe to show this to whoever can see it.
export function lastFeedError(): string | null {
  return lastError;
}

function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not set")) return "VAULT_READ_TOKEN is not set in this deployment.";
  if (/\b401\b/.test(message)) return "GitHub rejected VAULT_READ_TOKEN (expired, revoked, or mistyped).";
  if (/\b404\b/.test(message))
    return "VAULT_READ_TOKEN cannot see the vault repo. It needs read-only Contents access on aaron-sulbaran/aarons-second-brain.";
  if (/\b403\b/.test(message)) return "GitHub refused the request (rate limit or missing Contents permission).";
  return message;
}

async function fetchFromGitHub(token: string): Promise<RecruitingExport> {
  const url = `https://api.github.com/repos/${VAULT_REPO}/contents/${EXPORT_PATH}?ref=main`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 900, tags: [FEED_TAG] },
  });
  if (!res.ok) throw new Error(`GitHub contents API ${res.status} for ${EXPORT_PATH}`);
  return (await res.json()) as RecruitingExport;
}

async function readFromVault(): Promise<RecruitingExport> {
  return JSON.parse(await readFile(VAULT_DEV_PATH, "utf8")) as RecruitingExport;
}

export async function loadRecruitingFeed(): Promise<RecruitingFeed | null> {
  const token = process.env.VAULT_READ_TOKEN;
  const useVaultFile = !token && process.env.NODE_ENV === "development";
  try {
    if (!token && !useVaultFile) throw new Error("VAULT_READ_TOKEN is not set");
    const data = useVaultFile ? await readFromVault() : await fetchFromGitHub(token as string);
    lastError = null;
    lastGood = {
      data,
      fetchedAt: new Date().toISOString(),
      staleSince: null,
      source: useVaultFile ? "vault-file" : "github",
    };
    return lastGood;
  } catch (error) {
    console.error("[recruiting] feed refresh failed:", error instanceof Error ? error.message : error);
    lastError = explain(error);
    if (lastGood) return { ...lastGood, staleSince: lastGood.fetchedAt };
    return null;
  }
}
