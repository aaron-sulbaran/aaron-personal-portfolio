import { isPrivatePath } from "@/lib/analytics";

// One channel for errors a visitor's browser hits: a Vercel Web Analytics
// custom event. This module is pure; components/SiteAnalytics.tsx owns the
// vendor import and hands the sender in.

export const CLIENT_ERROR_EVENT = "client_error";
export const MAX_ERROR_REPORTS = 3;
const MESSAGE_MAX = 120;
const NAME_MAX = 40;
const DIGEST_MAX = 32;

type ErrorLike = { name?: unknown; message?: unknown; digest?: unknown };

const asText = (value: unknown) => (typeof value === "string" ? value : "");

// Anything glued to a token with "?" or "#" loses the rest of that token (URLs, paths, bracketed
// or uppercase-scheme forms alike), and so does a token that starts with one. Prose like
// "fail? Unknown" and "React error #418" has a space on one side and is untouched. A stack is never read.
const stripUrlQueries = (text: string) => text.replace(/(\S)[?#]\S+/g, "$1").replace(/^[?#]\S*/, "");

// "Name: message (digest d)": enough to tell errors apart, nothing that identifies a visitor.
export function errorDetail(value: unknown): string {
  let name = "Thrown";
  let message = "unknown";
  let digest = "";
  if (typeof value === "string") {
    message = value;
  } else if (value && typeof value === "object") {
    const like = value as ErrorLike;
    if (typeof like.message === "string") {
      name = stripUrlQueries(asText(like.name)).slice(0, NAME_MAX) || "Error";
      message = like.message;
    }
    digest = stripUrlQueries(asText(like.digest)).slice(0, DIGEST_MAX);
  }
  const cut = stripUrlQueries(message).slice(0, MESSAGE_MAX);
  return `${name}: ${cut}${digest ? ` (digest ${digest})` : ""}`;
}

// A cross-origin script failure reaches window.onerror as a bare "Script error."
// with no error object; it says nothing, so it is dropped. So is the browser's
// benign "ResizeObserver loop ..." notice, which also arrives with no error object
// and would use up the report budget on every load.
export function windowErrorValue(event: { error?: unknown; message?: string }): unknown {
  if (event.error != null) return event.error;
  const message = event.message ?? "";
  if (message === "" || message === "Script error." || message.startsWith("ResizeObserver loop")) return null;
  return message;
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
  return function report(where: string, value: unknown) {
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
  };
}
