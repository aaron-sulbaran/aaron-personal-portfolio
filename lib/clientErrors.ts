import { isPrivatePath } from "@/lib/analytics";

// One channel for errors a visitor's browser hits: a Vercel Web Analytics
// custom event. This module is pure; components/SiteAnalytics.tsx owns the
// vendor import and hands the sender in.

export const CLIENT_ERROR_EVENT = "client_error";
export const MAX_ERROR_REPORTS = 3;
const MESSAGE_MAX = 120;

type ErrorLike = { name?: unknown; message?: unknown; digest?: unknown };

// Anything glued to a token with "?" or "#" loses the rest of that token (URLs, paths, bracketed
// or uppercase-scheme forms alike), and so does a token that starts with one. Prose like
// "fail? Unknown" and "React error #418" has a space on one side and is untouched. A stack is never read.
const stripUrlQueries = (text: string) => text.replace(/(\S)[?#]\S+/g, "$1").replace(/^[?#]\S*/, "");

const EMAIL = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[^\s@<>()[\]]+/g;
const KEY_VALUE = /([A-Za-z0-9_.-]+)=[^\s&]+/g;
const LOCAL_PATH = /(?:\/(?:Users|home)\/[^/\s]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)\S*/gi;
const OPAQUE_TOKEN = /[A-Za-z0-9_+/=-]{24,}/g;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const DIGEST = /^[A-Za-z0-9_-]{1,32}$/;

// Browser-generated and library text can still hold an address, a secret in a key=value pair, a
// local path or a long opaque id. Order matters: the email goes first so "email=a@example.com" ends as "email=<v>".
const maskMessage = (text: string) =>
  stripUrlQueries(text)
    .replace(EMAIL, "<email>")
    .replace(KEY_VALUE, "$1=<v>")
    .replace(LOCAL_PATH, "<path>")
    .replace(OPAQUE_TOKEN, "<token>")
    .slice(0, MESSAGE_MAX);

const isErrorLike = (value: unknown): value is ErrorLike =>
  typeof value === "object" && value !== null && typeof (value as ErrorLike).message === "string";

// "Name: message (digest d)": enough to tell errors apart, nothing that identifies a visitor.
// A thrown value that is not error-like contributes only its type, never its content.
export function errorDetail(value: unknown): string {
  if (!isErrorLike(value)) {
    const kind = value === null || value === undefined ? "unknown" : typeof value;
    return `Thrown: ${kind === "string" || kind === "number" || kind === "object" ? kind : "unknown"}`;
  }
  const name = typeof value.name === "string" && IDENTIFIER.test(value.name) ? value.name : "Error";
  const digest = typeof value.digest === "string" && DIGEST.test(value.digest) ? value.digest : "";
  return `${name}: ${maskMessage(value.message as string)}${digest ? ` (digest ${digest})` : ""}`;
}

// A cross-origin script failure reaches window.onerror as a bare "Script error."
// with no error object; it says nothing, so it is dropped. So is the browser's
// benign "ResizeObserver loop ..." notice, which also arrives with no error object
// and would use up the report budget on every load.
export function windowErrorValue(event: { error?: unknown; message?: string }): unknown {
  if (event.error != null) return event.error;
  const message = event.message ?? "";
  if (message === "" || message === "Script error." || message.startsWith("ResizeObserver loop")) return null;
  return { name: "WindowError", message };
}

type ReporterOptions = {
  send: (name: string, properties: { where: string; detail: string }) => void;
  pathname: () => string;
  isPrivate?: (path: string) => boolean;
  limit?: number;
};

export function createClientErrorReporter({ send, pathname, isPrivate = isPrivatePath, limit = MAX_ERROR_REPORTS }: ReporterOptions) {
  const seen = new Set<string>();
  let sent = 0;
  function report(where: string, value: unknown) {
    try {
      if (sent >= limit || isPrivate(pathname())) return;
      const detail = errorDetail(value);
      if (seen.has(detail)) return;
      seen.add(detail);
      sent += 1;
      send(CLIENT_ERROR_EVENT, { where, detail });
    } catch {
      // Reporting must never be the next error.
    }
  }
  return report;
}
