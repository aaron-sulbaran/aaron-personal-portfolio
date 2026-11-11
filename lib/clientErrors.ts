import { isPrivatePath } from "@/lib/analytics";

// One channel for errors a visitor's browser hits: a Vercel Web Analytics
// custom event. This module is pure; components/SiteAnalytics.tsx owns the
// vendor import and hands the sender in.

export const CLIENT_ERROR_EVENT = "client_error";
export const MAX_ERROR_REPORTS = 3;

type ErrorLike = { name?: unknown; message?: unknown; digest?: unknown };

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const DIGEST = /^[A-Za-z0-9_-]{1,32}$/;

const isErrorLike = (value: unknown): value is ErrorLike =>
  typeof value === "object" && value !== null && typeof (value as ErrorLike).message === "string";

// Contract: detail carries only the error's class name and Next's digest. Message text can hold
// anything a page or a visitor put into it, so it never leaves the browser; it is only type-checked.
// A thrown value that is not error-like contributes only its type.
export function errorDetail(value: unknown): string {
  if (!isErrorLike(value)) {
    const kind = value === null || value === undefined ? "unknown" : typeof value;
    return `Thrown: ${kind === "string" || kind === "number" || kind === "object" ? kind : "unknown"}`;
  }
  const name = typeof value.name === "string" && IDENTIFIER.test(value.name) ? value.name : "Error";
  const digest = typeof value.digest === "string" && DIGEST.test(value.digest) ? value.digest : "";
  return `${name}${digest ? ` (digest ${digest})` : ""}`;
}

// A cross-origin script failure reaches window.onerror as a bare "Script error."
// with no error object; it says nothing, so it is dropped. So is the browser's
// benign "ResizeObserver loop ..." notice, which also arrives with no error object
// and would use up the report budget on every load. The message is read here only
// to drop that noise; none of it is sent.
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
  // Once a private path has been seen, nothing is sent for the rest of the page load, even
  // from work that started there and fails after the reader moved on.
  let sawPrivate = false;
  function report(where: string, value: unknown) {
    try {
      if (!sawPrivate && isPrivate(pathname())) sawPrivate = true;
      if (sawPrivate || sent >= limit) return;
      const detail = errorDetail(value);
      // Names are coarse, so the same name at a different place is a different report.
      const key = `${where}\n${detail}`;
      if (seen.has(key)) return;
      seen.add(key);
      sent += 1;
      send(CLIENT_ERROR_EVENT, { where, detail });
    } catch {
      // Reporting must never be the next error.
    }
  }
  report.visit = (path: string) => {
    try {
      if (isPrivate(path)) sawPrivate = true;
    } catch {
      // Same rule as report.
    }
  };
  return report;
}
