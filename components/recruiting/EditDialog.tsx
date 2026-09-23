"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { EDIT_STATUSES, ledgerEditSchema, type LedgerEdit, type PendingEdit } from "@/lib/recruiting/edits";
import { laneLabel, statusLabel } from "@/lib/recruiting/format";
import { LANES, type Application, type Season } from "@/lib/recruiting/types";

// One native <dialog> for both edits: update a row (status, date, note) or add
// an application. Submitting files the edit through POST /recruiting/edit; on
// success the parent overlays it at once as pending.

export type EditTarget = { kind: "update"; app: Application } | { kind: "create" };

const copy = siteContent.recruiting.edit;

function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

const fieldClass =
  "min-h-[40px] w-full rounded-lg border border-border bg-glass px-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-accent";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-caps text-muted">{label}</span>
      {children}
    </label>
  );
}

interface EditDialogProps {
  target: EditTarget;
  seasons: ReadonlyArray<Season>;
  defaultSeason: Season;
  onClose: () => void;
  onFiled: (edit: PendingEdit) => void;
}

export function EditDialog({ target, seasons, defaultSeason, onClose, onFiled }: EditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const app = target.kind === "update" ? target.app : null;
  const [status, setStatus] = useState<string>(app ? "" : "applied");
  const [date, setDate] = useState(localToday);
  const [note, setNote] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [lane, setLane] = useState<string>("internship");
  const [season, setSeason] = useState<string>(defaultSeason);
  const [tier, setTier] = useState<"target" | "opportunistic">("target");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const raw = app
      ? { v: 1, op: "update", id: app.id, status: status || undefined, date, note }
      : { v: 1, op: "create", company, role, lane, season, tier, status, date, note };
    const parsed = ledgerEditSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the fields");
      return;
    }
    const edit: LedgerEdit = parsed.data;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/recruiting/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit, company: app ? app.company : company }),
      });
      const result = (await res.json().catch(() => null)) as
        | { data: { number: number }; error: null }
        | { data: null; error: string }
        | null;
      if (!result || result.error !== null) {
        setError(result?.error ?? `Request failed (${res.status})`);
        return;
      }
      onFiled({ number: result.data.number, edit });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="edit-heading"
      className="w-[min(92vw,30rem)] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="edit-heading" className="font-serif text-2xl italic leading-none">
            {app ? copy.updateHeading : copy.addHeading}
          </h2>
          {app && (
            <p className="text-sm text-muted">
              {app.company} · {app.role} · {statusLabel(app.status)}
            </p>
          )}
        </div>

        {!app && (
          <>
            <Field label={copy.company}>
              <input required value={company} onChange={(e) => setCompany(e.target.value)} className={fieldClass} />
            </Field>
            <Field label={copy.role}>
              <input required value={role} onChange={(e) => setRole(e.target.value)} className={fieldClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={copy.lane} className="col-span-2 sm:col-span-1">
                <select value={lane} onChange={(e) => setLane(e.target.value)} className={fieldClass}>
                  {LANES.map((l) => (
                    <option key={l} value={l}>{laneLabel(l)}</option>
                  ))}
                </select>
              </Field>
              <Field label={copy.season}>
                <select value={season} onChange={(e) => setSeason(e.target.value)} className={fieldClass}>
                  {seasons.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label={copy.tier}>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as "target" | "opportunistic")}
                  className={fieldClass}
                >
                  <option value="target">{copy.tiers.target}</option>
                  <option value="opportunistic">{copy.tiers.opportunistic}</option>
                </select>
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.status}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
              {app && <option value="">{copy.keepStatus}</option>}
              {EDIT_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </Field>
          <Field label={copy.date}>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </Field>
        </div>

        <Field label={copy.note}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={copy.notePlaceholder}
            className={`${fieldClass} py-2 leading-snug`}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-lg border border-border bg-glass px-3 py-2 text-[13px] text-foreground">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            data-cursor-hover
            className="min-h-[40px] rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            data-cursor-hover
            className="min-h-[40px] rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity duration-200 disabled:opacity-50"
          >
            {submitting ? copy.submitting : copy.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
