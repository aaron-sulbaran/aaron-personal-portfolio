"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import {
  EDIT_STATUSES,
  EDIT_TIERS,
  ledgerEditSchema,
  type LedgerEdit,
  type PendingEdit,
} from "@/lib/recruiting/edits";
import { laneLabel, statusLabel } from "@/lib/recruiting/format";
import {
  useBodyScrollLock,
  useEscapeKey,
  useFocusTrap,
  modalBackdropBlurVariants,
  modalBackdropTintVariants,
} from "@/lib/modal";
import { LANES, isReferral, type Application, type Season } from "@/lib/recruiting/types";

// Edit dialog for the applications table: update any field a row shows, add an
// application, or remove one. Built on the site's own modal primitives
// (lib/modal) and portaled to body at z-50, under the custom cursor (z-100);
// a native <dialog> would sit in the browser's top layer and hide the cursor.
// Submitting files the edit through POST /recruiting/edit; on success the
// parent overlays it at once as pending.

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

type Draft = {
  company: string;
  role: string;
  lane: string;
  season: string;
  tier: string;
  applied: string;
  nextWhat: string;
  nextDue: string;
  status: string;
  referral: boolean;
};

function initialDraft(app: Application | null, defaultSeason: Season): Draft {
  return {
    company: app?.company ?? "",
    role: app?.role ?? "",
    lane: app?.lane ?? "internship",
    season: app?.season ?? defaultSeason,
    tier: app?.tier ?? "target",
    applied: app?.applied ?? "",
    nextWhat: app?.next?.what ?? "",
    nextDue: app?.next?.due ?? "",
    status: app?.status ?? "applied",
    referral: app ? isReferral(app) : false,
  };
}

// Only what changed goes into an update, so the ledger records exactly that.
function updateFrom(app: Application, d: Draft, date: string, note: string) {
  const edit: Record<string, unknown> = { v: 1, op: "update", id: app.id, date, note };
  if (d.company.trim() !== app.company) edit.company = d.company;
  if (d.role.trim() !== app.role) edit.role = d.role;
  if (d.lane !== app.lane) edit.lane = d.lane;
  if (d.season !== app.season) edit.season = d.season;
  if (d.tier !== app.tier) edit.tier = d.tier;
  if (d.applied && d.applied !== app.applied) edit.applied = d.applied;
  if (d.status !== app.status) edit.status = d.status;
  if (d.referral !== isReferral(app)) edit.referral = d.referral;
  const nextWhat = d.nextWhat.trim();
  const nextDue = d.nextDue || undefined;
  if (!nextWhat && app.next) edit.next = null;
  else if (nextWhat && (nextWhat !== app.next?.what || nextDue !== app.next?.due))
    edit.next = { what: nextWhat, ...(nextDue ? { due: nextDue } : {}) };
  return edit;
}

export function EditDialog({ target, seasons, defaultSeason, onClose, onFiled }: EditDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // The portal attaches after mount, so the focus trap starts once the panel exists.
  const [panelMounted, setPanelMounted] = useState(false);
  const app = target.kind === "update" ? target.app : null;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(app, defaultSeason));
  const [date, setDate] = useState(localToday);
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, panelMounted);

  const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function file(raw: Record<string, unknown>) {
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
        body: JSON.stringify({ edit, company: app ? app.company : draft.company }),
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (app) {
      void file(updateFrom(app, draft, date, note));
    } else {
      const { company, role, lane, season, tier, status, referral } = draft;
      void file({ v: 1, op: "create", company, role, lane, season, tier, status, referral, date, note });
    }
  }

  const statusOptions = app && !(EDIT_STATUSES as readonly string[]).includes(app.status)
    ? [app.status, ...EDIT_STATUSES]
    : [...EDIT_STATUSES];
  const tierOptions: string[] = [...EDIT_TIERS];

  return (
    <Portal>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-heading"
        initial="hidden"
        animate="visible"
        variants={modalBackdropBlurVariants(0)}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      >
        <motion.div
          aria-hidden="true"
          variants={modalBackdropTintVariants(0)}
          className="pointer-events-none absolute inset-0 bg-background/70"
        />
        <motion.div
          ref={(el) => {
            panelRef.current = el;
            if (el && !panelMounted) setPanelMounted(true);
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } }}
          onMouseDown={(e) => e.stopPropagation()}
          className="relative max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/60 bg-background/90 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cancel}
            data-cursor-hover
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground transition-colors duration-200 hover:text-accent"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>

          {confirmRemove && app ? (
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <h2 id="edit-heading" className="pr-10 font-serif text-2xl italic leading-tight">
                {copy.removeHeading(app.company)}
              </h2>
              <p className="text-sm leading-relaxed text-muted">{copy.removeBody}</p>
              <Field label={copy.note}>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.removeReason} className={fieldClass} />
              </Field>
              {error && <ErrorLine text={error} />}
              <div className="flex justify-end gap-2">
                <SecondaryButton onClick={() => setConfirmRemove(false)}>{copy.keep}</SecondaryButton>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void file({ v: 1, op: "remove", id: app.id, date: localToday(), note })}
                  data-cursor-hover
                  className="min-h-[40px] rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity duration-200 disabled:opacity-50"
                >
                  {submitting ? copy.submitting : copy.removeConfirm}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4 p-5 md:p-6">
              <div className="flex flex-col gap-1 pr-10">
                <h2 id="edit-heading" className="font-serif text-2xl italic leading-none">
                  {app ? copy.updateHeading : copy.addHeading}
                </h2>
                {app && <p className="text-sm text-muted">{copy.updateHint}</p>}
              </div>

              <Field label={copy.company}>
                <input required value={draft.company} onChange={set("company")} className={fieldClass} />
              </Field>
              <Field label={copy.role}>
                <input required value={draft.role} onChange={set("role")} className={fieldClass} />
              </Field>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label={copy.lane} className="col-span-2 sm:col-span-1">
                  <select value={draft.lane} onChange={set("lane")} className={fieldClass}>
                    {LANES.map((l) => (
                      <option key={l} value={l}>{laneLabel(l)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.season}>
                  <select value={draft.season} onChange={set("season")} className={fieldClass}>
                    {seasons.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.tier}>
                  <select value={draft.tier} onChange={set("tier")} className={fieldClass}>
                    {(app ? tierOptions : tierOptions.slice(0, 2)).map((t) => (
                      <option key={t} value={t}>{copy.tiers[t as keyof typeof copy.tiers]}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={copy.status}>
                  <select value={draft.status} onChange={set("status")} className={fieldClass}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{statusLabel(s)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={app ? copy.applied : copy.date}>
                  {app ? (
                    <input type="date" value={draft.applied} onChange={set("applied")} className={fieldClass} />
                  ) : (
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
                  )}
                </Field>
              </div>

              <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm text-foreground" data-cursor-hover>
                <input
                  type="checkbox"
                  checked={draft.referral}
                  onChange={(e) => setDraft((d) => ({ ...d, referral: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                {copy.referral}
              </label>

              {app && (
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label={copy.next}>
                    <input value={draft.nextWhat} onChange={set("nextWhat")} placeholder={copy.nextPlaceholder} className={fieldClass} />
                  </Field>
                  <Field label={copy.due}>
                    <input type="date" value={draft.nextDue} onChange={set("nextDue")} className={fieldClass} />
                  </Field>
                </div>
              )}

              <Field label={copy.note}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={copy.notePlaceholder}
                  className={`${fieldClass} py-2 leading-snug`}
                />
              </Field>
              {app && (
                <Field label={copy.when}>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
                </Field>
              )}

              {error && <ErrorLine text={error} />}

              <div className="flex flex-wrap items-center justify-between gap-2">
                {app ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmRemove(true);
                    }}
                    data-cursor-hover
                    className="min-h-[40px] rounded-full px-1 text-sm font-medium text-muted underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-accent"
                  >
                    {copy.remove}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <SecondaryButton onClick={onClose}>{copy.cancel}</SecondaryButton>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-cursor-hover
                    className="min-h-[40px] rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity duration-200 disabled:opacity-50"
                  >
                    {submitting ? copy.submitting : copy.submit}
                  </button>
                </div>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </Portal>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-lg border border-border bg-glass px-3 py-2 text-[13px] text-foreground">
      {text}
    </p>
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cursor-hover
      className="min-h-[40px] rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}
