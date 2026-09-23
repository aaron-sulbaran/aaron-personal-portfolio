import "server-only";
import {
  EDIT_FAILED_LABEL,
  EDIT_LABEL,
  editBody,
  editTitle,
  parseEditBody,
  type FailedEdit,
  type LedgerEdit,
  type PendingEdit,
} from "./edits";

// Dashboard edits travel as GitHub issues on the private vault repo (see
// lib/recruiting/edits.ts for why). Same fine-grained token as the feed; it
// needs Issues: Read and write on aarons-second-brain in addition to Contents:
// Read-only. Both calls return { data, error } and never throw.

export const VAULT_REPO = "aaron-sulbaran/aarons-second-brain";
export const FEED_TAG = "recruiting-feed";
const OWNER = "aaron-sulbaran";
const FAILED_WINDOW_DAYS = 7;

type Result<T> = { data: T; error: null } | { data: null; error: string };

interface IssueJson {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  pull_request?: unknown;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function explain(status: number): string {
  if (status === 401) return "GitHub rejected VAULT_READ_TOKEN (expired, revoked, or mistyped).";
  if (status === 403 || status === 404)
    return "VAULT_READ_TOKEN cannot use issues on the vault repo. Edit the token on GitHub and set Issues to Read and write.";
  return `GitHub issues API ${status}`;
}

export async function fileEdit(edit: LedgerEdit, company: string): Promise<Result<{ number: number }>> {
  const token = process.env.VAULT_READ_TOKEN;
  if (!token) return { data: null, error: "VAULT_READ_TOKEN is not set, so edits cannot be filed." };
  try {
    const res = await fetch(`https://api.github.com/repos/${VAULT_REPO}/issues`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle(edit, company), body: editBody(edit), labels: [EDIT_LABEL] }),
      cache: "no-store",
    });
    if (!res.ok) return { data: null, error: explain(res.status) };
    const issue = (await res.json()) as IssueJson;
    return { data: { number: issue.number }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function listIssues(token: string, query: string): Promise<IssueJson[]> {
  const res = await fetch(`https://api.github.com/repos/${VAULT_REPO}/issues?${query}`, {
    headers: headers(token),
    next: { revalidate: 900, tags: [FEED_TAG] },
  });
  if (!res.ok) throw new Error(explain(res.status));
  return ((await res.json()) as IssueJson[]).filter((i) => !i.pull_request);
}

export interface EditsState {
  pending: PendingEdit[];
  failed: FailedEdit[];
}

// Open edits (shown as pending) and edits the applier refused in the last week.
export async function loadEdits(): Promise<Result<EditsState>> {
  const token = process.env.VAULT_READ_TOKEN;
  if (!token) return { data: { pending: [], failed: [] }, error: null };
  try {
    const since = new Date(Date.now() - FAILED_WINDOW_DAYS * 86_400_000).toISOString();
    const [open, failed] = await Promise.all([
      listIssues(token, `labels=${EDIT_LABEL}&state=open&creator=${OWNER}&per_page=50`),
      listIssues(token, `labels=${EDIT_FAILED_LABEL}&state=closed&since=${since}&per_page=20`),
    ]);
    const pending = open.flatMap((issue) => {
      const edit = parseEditBody(issue.body);
      return edit ? [{ number: issue.number, edit }] : [];
    });
    return {
      data: {
        pending,
        failed: failed.map((i) => ({ number: i.number, title: i.title, url: i.html_url })),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}
