import { isPrivatePath } from "@/lib/analytics";

// One channel for errors a visitor's browser hits: a Vercel Web Analytics
// custom event. This module is pure; components/SiteAnalytics.tsx owns the
// vendor import and hands the sender in.

export const CLIENT_ERROR_EVENT = "client_error";
export const MAX_ERROR_REPORTS = 3;
const MESSAGE_MAX = 120;

type ErrorLike = { name?: unknown; message?: unknown; digest?: unknown };

const asText = (value: unknown) => (typeof value === "string" ? value : "");

// A URL inside a message loses its query string and fragment; a stack is never read.
const stripUrlQueries = (text: string) => text.replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, "$1");

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
      name = asText(like.name) || "Error";
      message = like.message;
    }
    digest = asText(like.digest);
  }
  const cut = stripUrlQueries(message).slice(0, MESSAGE_MAX);
  return `${name}: ${cut}${digest ? ` (digest ${digest})` : ""}`;
}

// A cross-origin script failure reaches window.onerror as a bare "Script error."
// with no error object; it says nothing, so it is dropped.
export function windowErrorValue(event: { error?: unknown; message?: string }): unknown {
  if (event.error != null) return event.error;
  const message = event.message ?? "";
  return message === "" || message === "Script error." ? null : message;
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
