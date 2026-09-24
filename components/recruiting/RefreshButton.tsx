"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { siteContent } from "@/lib/content";

// Recruiting refresh: asks the Mac to read new mail and update the ledger now
// instead of at the next hourly or overnight run (lib/recruiting/refresh.ts).
// Shows the Mac's progress from the request's issue comments and reloads the
// page's data when the request closes. A request already in flight (from any
// device) is picked up on load.

export interface RefreshStatus {
  number: number;
  open: boolean;
  requestedAt: string;
  closedAt: string | null;
  status: string | null;
  statusAt: string | null;
}

type Result = { data: RefreshStatus; error: null } | { data: null; error: string };

const copy = siteContent.recruiting.refresh;
const POLL_MS = 8000;
const STALLED_MS = 3 * 60 * 1000;
const DONE_SHOWN_MS = 30 * 1000;

export function RefreshButton({ initial }: { initial: RefreshStatus | null }) {
  const router = useRouter();
  const [state, setState] = useState<RefreshStatus | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reloaded = useRef<number | null>(null);

  const poll = useCallback(async (number: number) => {
    const res = await fetch(`/recruiting/refresh?number=${number}`, { cache: "no-store" });
    const result = (await res.json().catch(() => null)) as Result | null;
    if (!result || result.error !== null) {
      setError(result?.error ?? `Status check failed (${res.status})`);
      return;
    }
    setError(null);
    setState(result.data);
  }, []);

  // Poll while the request is open; tick a clock so "stalled" can show.
  useEffect(() => {
    if (!state?.open) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      void poll(state.number);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [state?.open, state?.number, poll]);

  // When it closes, pull the fresh ledger into the page once.
  useEffect(() => {
    if (state && !state.open && reloaded.current !== state.number) {
      reloaded.current = state.number;
      router.refresh();
      const id = window.setTimeout(() => setNow(Date.now()), DONE_SHOWN_MS);
      return () => window.clearTimeout(id);
    }
  }, [state, router]);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/recruiting/refresh", { method: "POST" });
      const result = (await res.json().catch(() => null)) as Result | null;
      if (!result || result.error !== null) setError(result?.error ?? `Request failed (${res.status})`);
      else {
        setState(result.data);
        setNow(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const running = Boolean(state?.open);
  const justDone = state && !state.open && state.closedAt && now - Date.parse(state.closedAt) < DONE_SHOWN_MS;
  const stalled = Boolean(state && state.open && !state.status && now - Date.parse(state.requestedAt) > STALLED_MS);

  let line: string | null = null;
  if (error) line = error;
  else if (running) line = stalled ? copy.stalled : state?.status ?? copy.queued;
  else if (justDone) line = state?.status ?? copy.done;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        onClick={() => void request()}
        disabled={busy || running}
        aria-label={running ? copy.running : copy.button}
        title={copy.hint}
        data-cursor-hover
        className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-border bg-glass px-2.5 text-[11px] font-medium normal-case tracking-normal text-foreground transition-colors duration-200 hover:border-accent hover:text-accent disabled:opacity-70"
      >
        <RefreshCw aria-hidden="true" className={`h-3 w-3 ${running || busy ? "motion-safe:animate-spin" : ""}`} />
        {running ? copy.running : copy.button}
      </button>
      {line && (
        <span role="status" className="normal-case tracking-normal text-muted">
          {line}
        </span>
      )}
    </span>
  );
}
