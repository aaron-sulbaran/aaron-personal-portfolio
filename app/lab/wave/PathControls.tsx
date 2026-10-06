"use client";

import { useSyncExternalStore } from "react";
import { getDecision, getServerDecision, setDecision, subscribeDecision, type Decision } from "./decisionStore";
import { Choice, Group, Slider, Toggle } from "./panelParts";
import { PATH_RANGES, type HeadMode, type HeadStyle, type PathSettings, type TailMode } from "./settings";
import type { SpineChoice } from "./spineChoice";
import type { RuleReport } from "./spineRules";
import { SPINES } from "./spines";
import { Generator, RuleControls, RulesReadout, StretchEditor } from "./SpineTools";

// Every spine, the parked ones last, then the editable and generated slots.
const SPINE_OPTIONS = [
  ...SPINES.filter((s) => !s.parked),
  { id: "custom", label: "Custom" },
  { id: "generated", label: "Generated" },
  ...SPINES.filter((s) => s.parked),
];

// The Path placement's group in the panel: the spine, the head and the tail,
// the shape along the spine and the two optional motion layers. Amplitude,
// rows, spacing and alphas stay in the shared groups below.

const HEAD_MODES: { id: HeadMode; label: string }[] = [
  { id: "viewport", label: "Head at a viewport line" },
  { id: "progress", label: "Head by page progress" },
];
const HEAD_STYLES: { id: HeadStyle; label: string }[] = [
  { id: "taper", label: "Taper" },
  { id: "spark", label: "Spark" },
  { id: "swell", label: "Swell" },
  { id: "none", label: "None" },
];
const DECISIONS: { id: Decision; label: string }[] = [
  { id: "undecided", label: "Undecided" },
  { id: "play", label: "Play it" },
  { id: "decline", label: "Not now" },
];
const TAILS: { id: TailMode; label: string }[] = [
  { id: "all", label: "Stays drawn" },
  { id: "train", label: "Finite train" },
];

export function PathControls(props: { path: PathSettings; choice: SpineChoice; report: RuleReport | null; onChange: (patch: Partial<PathSettings>) => void }) {
  const { path, choice, onChange } = props;
  const R = PATH_RANGES;
  const decision = useSyncExternalStore(subscribeDecision, getDecision, getServerDecision);
  return (
    <Group title="Path">
      <p className="text-xs text-muted">The band&apos;s question</p>
      <Choice options={DECISIONS} value={decision} onChange={setDecision} />
      <p className="mt-1 text-xs leading-snug text-muted">
        {path.bandRun
          ? "Undecided: the line is a level run across the band, breathing, and nothing follows the scroll. Play it or Not now (here or on the band) sets the head off from the run's right end; Play it also brings the music in. Undecided resets."
          : "The band run is off, so the line ignores the answer."}
      </p>
      <Toggle label="Start as a level run across the band" checked={path.bandRun} onChange={(bandRun) => onChange({ bandRun })} />

      <Choice options={SPINE_OPTIONS} value={path.spine} onChange={(spine) => onChange({ spine })} />
      <p className="mt-1 text-xs leading-snug text-muted">{choice.def.note}</p>
      {choice.def.moves && path.spine !== "custom" && (
        <button type="button" onClick={() => onChange({ spine: "custom", custom: choice.def.moves })} className="mt-1 rounded border border-border px-2 py-0.5 text-xs">
          Edit a copy of this line
        </button>
      )}
      <RulesReadout report={props.report} rules={path.rules} />
      <RuleControls rules={path.rules} onChange={(rules) => onChange({ rules })} />
      <Generator path={path} choice={choice} onChange={onChange} />
      {path.spine === "custom" && <StretchEditor moves={path.custom} onChange={(custom) => onChange({ custom })} />}

      <p className="mt-3 text-xs text-muted">Head</p>
      <Choice options={HEAD_MODES} value={path.headMode} onChange={(headMode) => onChange({ headMode })} />
      <p className="mt-1 text-xs leading-snug text-muted">
        {path.headMode === "viewport"
          ? "The head sits where the spine first reaches this line of the viewport."
          : "As the reference: the drawn share runs from the pre-drawn amount to all of it as this line passes the spine's top and bottom."}
      </p>
      <Slider label="Head line" unit="of viewport" value={path.headAt} {...R.headAt} onChange={(headAt) => onChange({ headAt })} />
      <Slider label="Drawn before any scroll" unit="of spine" value={path.preDrawn} {...R.preDrawn} onChange={(preDrawn) => onChange({ preDrawn })} />
      <Slider label="Head smoothing (0 is raw)" unit="per s" value={path.smoothing} {...R.smoothing} onChange={(smoothing) => onChange({ smoothing })} />
      <Slider label="Draw speed cap (0 is none)" unit="px/s" value={path.drawSpeed} {...R.drawSpeed} onChange={(drawSpeed) => onChange({ drawSpeed })} />
      <Toggle label="Ease the catch-up in" checked={path.drawEase === "eased"} onChange={(eased) => onChange({ drawEase: eased ? "eased" : "linear" })} />
      <Choice options={HEAD_STYLES} value={path.headStyle} onChange={(headStyle) => onChange({ headStyle })} />

      <p className="mt-3 text-xs text-muted">Tail</p>
      <Choice options={TAILS} value={path.tail} onChange={(tail) => onChange({ tail })} />
      {path.tail === "train" && (
        <Slider label="Train length" unit="px of arc" value={path.trainLength} {...R.trainLength} onChange={(trainLength) => onChange({ trainLength })} />
      )}

      <p className="mt-3 text-xs text-muted">Shape and motion</p>
      <Slider label="Wavelength" unit="px of arc" value={path.wavelength} {...R.wavelength} onChange={(wavelength) => onChange({ wavelength })} />
      <Slider label="Shape travels with scroll" value={path.shapeTravel} {...R.shapeTravel} onChange={(shapeTravel) => onChange({ shapeTravel })} />
      <Slider label="Music layer (needs Music on)" value={path.musicLayer} {...R.musicLayer} onChange={(musicLayer) => onChange({ musicLayer })} />
      <p className="mt-3 text-xs text-muted">Over the words</p>
      <Toggle label="No lone dots in word gaps" checked={path.thinInWords} onChange={(thinInWords) => onChange({ thinInWords })} />
      <Toggle label="Accent only outside text" checked={path.accentOutsideWords} onChange={(accentOutsideWords) => onChange({ accentOutsideWords })} />
      <Toggle label="Head's swell relaxes inside text" checked={path.swellOutsideWords} onChange={(swellOutsideWords) => onChange({ swellOutsideWords })} />
      <Toggle label="Soft music shimmer (size, not blink)" checked={path.shimmer === "soft"} onChange={(soft) => onChange({ shimmer: soft ? "soft" : "threshold" })} />
      <Toggle label="Head starts at the band (first scroll pulls it out)" checked={path.headFromBand} onChange={(headFromBand) => onChange({ headFromBand })} />
      <Slider label="Amplitude below 600px (0 keeps it)" unit="px" value={path.phoneAmplitude} min={0} max={120} step={1} onChange={(phoneAmplitude) => onChange({ phoneAmplitude })} />
      <Toggle label="Line only (no amplitude)" checked={path.lineOnly} onChange={(lineOnly) => onChange({ lineOnly })} />
      <Toggle label="Debug: draw the spine and its points" checked={path.debug} onChange={(debug) => onChange({ debug })} />
    </Group>
  );
}
