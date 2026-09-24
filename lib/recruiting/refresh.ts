import "server-only";
import { VAULT_REPO } from "./vault-issues";

// Recruiting refresh, on demand. Deliberately recruiting-only and retirable
// with the tracker: nothing else should grow on this label or its Mac script.
// The mail pipeline (Gmail, the ledger CLI, the model runs) lives on Aaron's
// Mac, so the site cannot run it; it asks. The Refresh button files one GitHub
// issue labeled recruiting-refresh on the vault repo (reusing any still open).
// ~/.vault-git/recruiting-refresh.sh, run by the Talos minute tick
// (talos-cron), finds it with one gh call (no model when there is none), runs
// the watcher and the gmail-only ingest, comments progress, and closes it with
// a summary. The page polls the issue and reloads the data when it closes.

export const REFRESH_LABEL = "recruiting-refresh";
const OWNER = "aaron-sulbaran";

type Result<T> = { data: T; error: null } | { data: null; error: string };

export interface RefreshState {
  number: number;
  open: boolean;
  requestedAt: string;
  closedAt: string | null;
  // The Mac's latest comment, first line only ("Picked up", "Done: ...").
  status: string | null;
  statusAt: string | null;
}

interface IssueJson {
  number: number;
  state: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  comments: number;
  pull_request?: unknown;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.VAULT_READ_TOKEN;
  if (!token) throw new Error("VAULT_READ_TOKEN is not set, so refresh cannot be requested.");
  const res = await fetch(`https://api.github.com/repos/${VAULT_REPO}/${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { message?: string }) => b.message ?? "")
      .catch(() => "");
    throw new Error(`GitHub ${res.status}${detail ? ` (${detail})` : ""}`);
  }
  return (await res.json()) as T;
}

async function toState(issue: IssueJson): Promise<RefreshState> {
  let status: string | null = null;
  let statusAt: string | null = null;
  if (issue.comments > 0) {
    const comments = await gh<Array<{ body: string; created_at: string; user: { login: string } }>>(
      `issues/${issue.number}/comments?per_page=100`,
    );
    const last = comments.filter((c) => c.user.login === OWNER).at(-1);
    if (last) {
      status = last.body.split("\n")[0].trim().slice(0, 200);
      statusAt = last.created_at;
    }
  }
  return {
    number: issue.number,
    open: issue.state === "open",
    requestedAt: issue.created_at,
    closedAt: issue.closed_at,
    status,
    statusAt,
  };
}

async function findOpen(): Promise<IssueJson | null> {
  const open = await gh<IssueJson[]>(`issues?labels=${REFRESH_LABEL}&state=open&creator=${OWNER}&per_page=5`);
  return open.find((i) => !i.pull_request) ?? null;
}

// The refresh in flight, if any, so a page load (on any device) shows it.
export async function openRefresh(): Promise<RefreshState | null> {
  if (!process.env.VAULT_READ_TOKEN) return null;
  try {
    const issue = await findOpen();
    return issue ? await toState(issue) : null;
  } catch {
    return null;
  }
}

export async function requestRefresh(): Promise<Result<RefreshState>> {
  try {
    const existing = await findOpen();
    if (existing) return { data: await toState(existing), error: null };
    const created = await gh<IssueJson>("issues", {
      method: "POST",
      body: JSON.stringify({
        title: "Recruiting refresh requested",
        body: "Filed by the Refresh button on aaronsulbaran.com/recruiting. The Mac's recruiting-refresh job reads new mail, updates the ledger, comments its progress here, and closes this issue.",
        labels: [REFRESH_LABEL],
      }),
    });
    return { data: await toState(created), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function refreshState(number: number): Promise<Result<RefreshState>> {
  try {
    return { data: await toState(await gh<IssueJson>(`issues/${number}`)), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}
