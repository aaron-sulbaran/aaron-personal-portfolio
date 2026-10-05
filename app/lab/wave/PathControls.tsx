"use client";

import { Choice, Group, Slider, Toggle } from "./panelParts";
import { PATH_RANGES, type HeadMode, type HeadStyle, type PathSettings, type TailMode } from "./settings";
import { SPINES, spineById } from "./spines";

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
const TAILS: { id: TailMode; label: string }[] = [
  { id: "all", label: "Stays drawn" },
  { id: "train", label: "Finite train" },
];

export function PathControls({ path, onChange }: { path: PathSettings; onChange: (patch: Partial<PathSettings>) => void }) {
  const R = PATH_RANGES;
  return (
    <Group title="Path">
      <Choice options={SPINES} value={path.spine} onChange={(spine) => onChange({ spine })} />
      <p className="mt-1 text-xs leading-snug text-muted">{spineById(path.spine).note}</p>

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
      <Toggle label="Line only (no amplitude)" checked={path.lineOnly} onChange={(lineOnly) => onChange({ lineOnly })} />
      <Toggle label="Debug: draw the spine and its points" checked={path.debug} onChange={(debug) => onChange({ debug })} />
    </Group>
  );
}
