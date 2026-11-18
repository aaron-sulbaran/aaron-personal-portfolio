"use client";

import { DEAL_CHOICE_SPEC, TITLE_MODE_NAMES, getKnobs, modeForVersion, setKnobs, startsOnLanding, useKnobs, type DealKnobs } from "@/lib/home/dealKnobs";
import { dealLabValues, writeStoredDealKnobs } from "@/lib/home/dealLab";
import { PRESET_NAMES, SPEED_PRESETS, presetOf, presetPatch, type SpeedPreset } from "@/lib/home/dealPresets";

// The deal lab's click-prompt switches: the version, the timing mode and the
// speed preset. Dev only, like the panel it sits in; every change is saved the
// same way a slider's is.

const BUTTON = "rounded-full border px-3 py-1 hover:border-accent";

function apply(patch: Partial<DealKnobs>) {
  setKnobs(patch);
  writeStoredDealKnobs(dealLabValues(getKnobs()));
}

export default function DealLabPrompt() {
  const knobs = useKnobs();
  const version = DEAL_CHOICE_SPEC.promptVersion;
  const mode = DEAL_CHOICE_SPEC.promptMode;
  const place = DEAL_CHOICE_SPEC.promptTitlePlace;
  const speed = presetOf(knobs);
  const onLanding = startsOnLanding(knobs.promptVersion);
  const titled = knobs.promptVersion === "title";
  // G's timings read by what they do to the page: the line first, or the columns first.
  const modeHint = { early: undefined, hold: "The title and the columns wait for the line and come in as it shrinks", after: "The columns come in first, then the line over them" } as const;

  const choice = (active: boolean) => `${BUTTON} ${active ? "border-accent text-foreground" : "border-border text-muted"}`;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-muted">{version.label}</span>
        <select
          value={knobs.promptVersion}
          onChange={(event) => {
            const promptVersion = event.target.value as DealKnobs["promptVersion"];
            apply({ promptVersion, promptMode: modeForVersion(promptVersion, knobs.promptMode) });
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1"
        >
          {version.options.map((option) => (
            <option key={option} value={option}>
              {version.names[option]}
            </option>
          ))}
        </select>
      </label>
      {knobs.promptVersion === "title" && (
        <div role="group" aria-label={place.label}>
          <span className="mb-1 block text-muted">{place.label}</span>
          <div className="flex flex-wrap gap-2">
            {place.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={knobs.promptTitlePlace === option}
                title={option === "column" ? "A phone always plays it in place" : "From 768 px wide; a phone plays it in place"}
                onClick={() => apply({ promptTitlePlace: option })}
                className={choice(knobs.promptTitlePlace === option)}
              >
                {place.names[option]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div role="group" aria-label={mode.label}>
        <span className="mb-1 block text-muted">{mode.label}</span>
        <div className="flex flex-wrap gap-2">
          {mode.options.map((option) => {
            const unavailable = onLanding && option === "early";
            return (
              <button
                key={option}
                type="button"
                aria-pressed={knobs.promptMode === option}
                aria-disabled={unavailable || undefined}
                title={unavailable ? "D, F and G start as the Coil lands" : titled ? modeHint[option] : undefined}
                onClick={() => !unavailable && apply({ promptMode: option })}
                className={unavailable ? `${choice(false)} cursor-not-allowed opacity-50 hover:border-border` : choice(knobs.promptMode === option)}
              >
                {titled ? TITLE_MODE_NAMES[option] : mode.names[option]}
              </button>
            );
          })}
        </div>
      </div>
      <div role="group" aria-label="Speed">
        <span className="mb-1 block text-muted">Speed{speed === "custom" ? ": Custom" : ""}</span>
        <div className="flex flex-wrap gap-2">
          {SPEED_PRESETS.map((preset: SpeedPreset) => (
            <button key={preset} type="button" aria-pressed={speed === preset} onClick={() => apply(presetPatch(preset))} className={choice(speed === preset)}>
              {PRESET_NAMES[preset]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
