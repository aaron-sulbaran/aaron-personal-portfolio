"use client";

import { useEffect, useState } from "react";
import { dispatchDeal } from "@/lib/home/deal";
import { KNOB_SPEC, getKnobs, resetKnobs, setKnobs, useKnobs, type NumericKnob } from "@/lib/home/dealKnobs";
import { DEAL_LAB_KNOBS, applyStoredDealKnobs, dealLabValues, writeStoredDealKnobs } from "@/lib/home/dealLab";

// The deal's lab panel, dev only (DealLabMount never loads it in production, so
// the build holds none of it): a collapsed chip at the bottom right that opens
// the knobs Aaron tunes by hand, a "Replay the deal" button and a "Copy values"
// one (the JSON the other labs copy). The values persist in localStorage here,
// in this browser, and override the constants' defaults at runtime
// (lib/home/dealLab.ts, shared with the hero lab's frames).

export default function DealLab() {
  const knobs = useKnobs();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => applyStoredDealKnobs(), []);

  const change = (key: NumericKnob, value: number) => {
    setKnobs({ [key]: value });
    writeStoredDealKnobs(dealLabValues(getKnobs()));
  };

  const copy = async () => {
    const json = JSON.stringify({ lab: "deal", round: 1, ...dealLabValues(getKnobs()) }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copy the values", json);
    }
  };

  const replay = () => {
    // The page goes back to the top first (the section must be out of the
    // deal's zone when it resets), then the per-load flag resets (idle: the
    // section closes, the Coil waits), and scrolling down or "Deal me in" deals
    // again.
    window.scrollTo({ top: 0, behavior: "instant" });
    dispatchDeal({ type: "reset" });
  };

  const groups = ["Deal", "Columns"].map((group) => ({ group, keys: DEAL_LAB_KNOBS.filter((key) => KNOB_SPEC[key].group === group) }));
  return (
    <div data-deal-lab="" className="fixed bottom-4 right-4 z-[90] font-label text-label-sm text-foreground">
      {open ? (
        <div role="group" aria-label="Deal lab" className="w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-label">Deal lab</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-sm px-1 text-muted hover:text-foreground">
              Close
            </button>
          </div>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {groups.map(({ group, keys }) => (
              <fieldset key={group} className="space-y-2">
                <legend className="mb-1 text-muted">{group}</legend>
                {keys.map((key) => {
                  const spec = KNOB_SPEC[key];
                  return (
                    <label key={key} className="block">
                      <span className="flex justify-between">
                        <span>{spec.label}</span>
                        <span className="tabular-nums text-muted">
                          {knobs[key]}
                          {spec.unit ?? ""}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        value={knobs[key]}
                        onChange={(event) => change(key, Number(event.target.value))}
                        className="w-full accent-[var(--color-accent)]"
                      />
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={replay} className="rounded-full border border-border px-3 py-1.5 hover:border-accent">
              Replay the deal
            </button>
            <button type="button" onClick={() => void copy()} className="rounded-full border border-border px-3 py-1.5 hover:border-accent">
              {copied ? "Copied" : "Copy values"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetKnobs();
                writeStoredDealKnobs(dealLabValues(getKnobs()));
              }}
              className="rounded-full px-3 py-1.5 text-muted hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <button type="button" aria-expanded="false" onClick={() => setOpen(true)} className="rounded-full border border-border bg-background px-3 py-1.5 shadow-md hover:border-accent">
          Deal lab
        </button>
      )}
    </div>
  );
}
